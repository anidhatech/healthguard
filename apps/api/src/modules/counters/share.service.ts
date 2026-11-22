import { Inject, Injectable, Logger } from '@nestjs/common';
import { normalizeAbhaAddress, normalizeAbhaNumber } from '@healthguard/shared';
import { z } from 'zod';
import { APP_CONFIG, type AppConfig } from '../../config/env.js';
import { patientDisplayName } from '../../common/mapping.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { ABDM_GATEWAY, type AbdmGateway } from '../abdm/abdm.module.js';
import { abdmGenderToSex, lastTenDigits } from '../abdm/abha-enrolment.service.js';
import { AuditService } from '../audit/audit.service.js';
import { PatientRegistrationService } from '../patients/patient-registration.service.js';

const text = z.preprocess(
  (value) => (typeof value === 'number' ? String(value) : value),
  z.string().trim().min(1),
);

/**
 * A profile a patient agreed to share by scanning a counter QR code, as ABDM
 * posts it. Only what registration needs is required; anything else ABDM adds
 * is ignored.
 */
export const PatientShareSchema = z.object({
  intent: z.string().optional(),
  metaData: z.object({ hipId: text, context: text }),
  profile: z.object({
    patient: z.object({
      abhaNumber: text.optional(),
      abhaAddress: text,
      name: text,
      gender: text,
      dayOfBirth: text.optional(),
      monthOfBirth: text.optional(),
      yearOfBirth: text,
      phoneNumber: text.optional(),
      address: z
        .object({
          line: text.optional(),
          district: text.optional(),
          state: text.optional(),
          pincode: text.optional(),
        })
        .optional(),
    }),
  }),
});
export type PatientShare = z.infer<typeof PatientShareSchema>;

export type ShareOutcome =
  | { status: 'IGNORED'; reason: 'OFF' | 'UNKNOWN_FACILITY' | 'UNKNOWN_COUNTER' | 'INVALID' }
  | {
      status: 'QUEUED';
      patientId: string;
      patient: 'CREATED' | 'MATCHED';
      queueEntryId: string;
      entry: 'CREATED' | 'REUSED';
      tokenNumber: number;
      replied: boolean;
    };

const sameName = (a: string, b: string) =>
  a.trim().replace(/\s+/g, ' ').toLowerCase() === b.trim().replace(/\s+/g, ' ').toLowerCase();

/** The clinic's own calendar day, as a date with no time. */
function serviceDate(timezone: string, now: Date): Date {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now);
  return new Date(`${day}T00:00:00Z`);
}

/**
 * Scan and share: a patient scans a counter's QR code, agrees in their own
 * app, and ABDM posts their profile here. The patient is registered or matched
 * with nothing typed at the desk, joins that counter's queue, and gets a token
 * number back through ABDM.
 */
@Injectable()
export class ShareService {
  private readonly logger = new Logger(ShareService.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(ABDM_GATEWAY) private readonly gateway: AbdmGateway | null,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly registration: PatientRegistrationService,
  ) {}

  get enabled(): boolean {
    return this.config.env.ABDM_SHARE_INBOUND === 'on' && this.gateway !== null;
  }

  /** Registers or matches the patient, queues them, and replies to ABDM with the token. */
  async process(shareRequestId: string, body: unknown): Promise<ShareOutcome> {
    if (!this.enabled) return { status: 'IGNORED', reason: 'OFF' };
    const parsed = PatientShareSchema.safeParse(body);
    if (!parsed.success) return { status: 'IGNORED', reason: 'INVALID' };
    const share = parsed.data;
    const person = share.profile.patient;

    const organization = await this.prisma.db.organization.findFirst({
      where: { hfrId: share.metaData.hipId, isDemo: false, deletedAt: null },
    });
    if (!organization) return { status: 'IGNORED', reason: 'UNKNOWN_FACILITY' };
    const db = this.prisma.tenant(organization.id);
    const counter = await db.counter.findFirst({
      where: { code: { equals: share.metaData.context, mode: 'insensitive' }, active: true },
    });
    if (!counter) {
      await this.audit.record({
        actor: null,
        organizationId: organization.id,
        action: 'CREATE',
        resourceType: 'QueueEntry',
        decision: 'DENY',
        decisionReason: 'UNKNOWN_COUNTER',
      });
      return { status: 'IGNORED', reason: 'UNKNOWN_COUNTER' };
    }

    const { patientId, patient } = await this.findOrRegister(organization.id, person);

    // A repeat scan at the same counter keeps the entry and its token.
    const now = new Date();
    const expiry = this.config.env.ABDM_SHARE_TOKEN_EXPIRY;
    let entry = await db.queueEntry.findFirst({
      where: { counterId: counter.id, patientProfileId: patientId, status: 'ACTIVE' },
    });
    const reused = Boolean(entry);
    if (entry) {
      entry = await db.queueEntry.update({
        where: { id: entry.id },
        data: { lastShareRequestId: shareRequestId, replyStatus: 'PENDING' },
      });
    } else {
      const date = serviceDate(organization.timezone, now);
      for (let attempt = 0; attempt < 5 && !entry; attempt += 1) {
        const last = await db.queueEntry.findFirst({
          where: { counterId: counter.id, serviceDate: date },
          orderBy: { tokenNumber: 'desc' },
        });
        try {
          entry = await db.queueEntry.create({
            data: {
              organizationId: organization.id,
              counterId: counter.id,
              patientProfileId: patientId,
              serviceDate: date,
              tokenNumber: (last?.tokenNumber ?? 0) + 1,
              lastShareRequestId: shareRequestId,
              tokenExpiresAt: new Date(now.getTime() + expiry * 1000),
            },
          });
        } catch (error) {
          // Two patients scanned at the same moment: take the next number.
          if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
            throw error;
          }
          entry = await db.queueEntry.findFirst({
            where: { counterId: counter.id, patientProfileId: patientId, status: 'ACTIVE' },
          });
        }
      }
      if (!entry) throw new Error('A token number could not be assigned.');
      await this.audit.record({
        actor: null,
        organizationId: organization.id,
        action: 'CREATE',
        resourceType: 'QueueEntry',
        resourceId: entry.id,
        patientProfileId: patientId,
        decision: 'ALLOW',
        metadata: { source: 'ABDM_SHARE', patient },
      });
    }

    const replied = await this.reply(share, shareRequestId, entry.tokenNumber);
    await db.queueEntry.update({
      where: { id: entry.id },
      data: { replyStatus: replied ? 'SENT' : 'FAILED' },
    });
    return {
      status: 'QUEUED',
      patientId,
      patient,
      queueEntryId: entry.id,
      entry: reused ? 'REUSED' : 'CREATED',
      tokenNumber: entry.tokenNumber,
      replied,
    };
  }

  /**
   * One person, one record. The ABHA number decides first; then the ABHA
   * address; then name, gender and mobile together. Only when none of these
   * finds a record is a new one created.
   */
  private async findOrRegister(
    organizationId: string,
    person: PatientShare['profile']['patient'],
  ): Promise<{ patientId: string; patient: 'CREATED' | 'MATCHED' }> {
    const db = this.prisma.tenant(organizationId);
    const abhaNumber = person.abhaNumber ? normalizeAbhaNumber(person.abhaNumber) : null;
    const abhaAddress = normalizeAbhaAddress(person.abhaAddress);
    const sex = abdmGenderToSex(person.gender);
    const mobile = lastTenDigits(person.phoneNumber ?? null);

    let match =
      (abhaNumber
        ? await db.patientProfile.findFirst({ where: { abhaNumber, deletedAt: null } })
        : null) ?? (await db.patientProfile.findFirst({ where: { abhaAddress, deletedAt: null } }));
    if (!match && mobile.length === 10 && sex !== 'UNKNOWN') {
      const candidates = await db.patientProfile.findMany({
        where: { deletedAt: null, isSynthetic: false, sex, abhaNumber: null },
        take: 500,
      });
      const same = candidates.filter(
        (row) =>
          lastTenDigits(row.phone) === mobile && sameName(patientDisplayName(row), person.name),
      );
      // Only a single match is certain enough to link without anyone confirming.
      if (same.length === 1) match = same[0] ?? null;
    }

    if (match) {
      // The same person with another of their ABHA addresses: the record takes the new one.
      const changes: { abhaNumber?: string; abhaAddress?: string; abhaVerifiedAt?: Date } = {};
      if (abhaNumber && !match.abhaNumber) changes.abhaNumber = abhaNumber;
      if (match.abhaAddress !== abhaAddress) changes.abhaAddress = abhaAddress;
      if (Object.keys(changes).length > 0) {
        await db.patientProfile.update({
          where: { id: match.id },
          data: { ...changes, abhaVerifiedAt: new Date() },
        });
        await this.audit.record({
          actor: null,
          organizationId,
          action: 'UPDATE',
          resourceType: 'PatientProfile',
          resourceId: match.id,
          patientProfileId: match.id,
          decision: 'ALLOW',
          metadata: { source: 'ABDM_SHARE', fields: Object.keys(changes) },
        });
      }
      return { patientId: match.id, patient: 'MATCHED' };
    }

    const [givenName = person.name, ...rest] = person.name.split(/\s+/);
    // A profile can carry only the year of birth; the record then holds 1 January of it.
    const pad = (value: string | undefined) => (value ?? '1').padStart(2, '0');
    const created = await this.registration.registerFromShare(
      organizationId,
      {
        givenName,
        ...(rest.length ? { familyName: rest.join(' ') } : {}),
        dateOfBirth: `${person.yearOfBirth}-${pad(person.monthOfBirth)}-${pad(person.dayOfBirth)}`,
        sex,
        ...(mobile.length === 10 ? { phone: mobile } : {}),
        addressLine: person.address?.line,
        district: person.address?.district,
        state: person.address?.state,
        pinCode: person.address?.pincode,
      },
      abhaNumber ? { abhaNumber, abhaAddress } : undefined,
    );
    if (!abhaNumber) {
      // A share with no ABHA number still carries the ABHA address the patient shared from.
      await db.patientProfile.update({
        where: { id: created.patient.id },
        data: { abhaAddress, abhaVerifiedAt: new Date() },
      });
    }
    return {
      patientId: created.patient.id,
      patient: created.status === 'CREATED' ? 'CREATED' : 'MATCHED',
    };
  }

  /** Tells ABDM the token number, which the patient's app then shows. */
  private async reply(
    share: PatientShare,
    shareRequestId: string,
    token: number,
  ): Promise<boolean> {
    const gateway = this.gateway;
    if (!gateway) return false;
    try {
      await gateway.http.request({
        host: 'gateway',
        method: 'POST',
        path: '/api/hiecm/patient-share/v3/on-share',
        accessToken: await gateway.session.accessToken(),
        headers: { 'X-HIP-ID': share.metaData.hipId },
        body: {
          acknowledgement: {
            status: 'SUCCESS',
            abhaAddress: share.profile.patient.abhaAddress,
            profile: {
              context: share.metaData.context,
              tokenNumber: String(token),
              expiry: String(this.config.env.ABDM_SHARE_TOKEN_EXPIRY),
            },
          },
          response: { requestId: shareRequestId },
        },
      });
      return true;
    } catch (error) {
      this.logger.warn(
        { err: error instanceof Error ? error.message : 'unknown' },
        'on-share failed',
      );
      return false;
    }
  }
}

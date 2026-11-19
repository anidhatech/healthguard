import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  ABHA_OTP_RULES,
  ABHA_TEXT,
  normalizeAbhaNumber,
  type AbhaAddressResult,
  type AbhaAddressSuggestions,
  type AbhaEnrolmentView,
  type AbhaMatches,
  type AbhaMobileVerification,
  type AbhaOtpChallenge,
  type AbhaPatientMatch,
  type AbhaProfileView,
  type PatientRegistrationResult,
  type RegisterPatient,
  type SaveAbhaEnrolment,
  type StartAbhaEnrolment,
} from '@healthguard/shared';
import { requireOrganization, type ActorContext, type RequestMeta } from '../../common/actor.js';
import { patientDisplayName } from '../../common/mapping.js';
import { Problems } from '../../common/problem.js';
import { APP_CONFIG, type AppConfig } from '../../config/env.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { RedisService } from '../../infrastructure/redis/redis.service.js';
import { AuditService } from '../audit/audit.service.js';
import { PatientRegistrationService } from '../patients/patient-registration.service.js';
import {
  ABHA_ENROLLMENT_CONSENT,
  AbhaEnrollmentClient,
  type AbhaProfile,
} from './abha-enrollment.client.js';
import { AbdmApiError } from './abdm-http.client.js';
import { ABDM_GATEWAY, type AbdmGateway } from './abdm.module.js';

/** How long a journey may sit between steps before it has to start again. */
const JOURNEY_TTL_SECONDS = 30 * 60;
const KEY = (journeyId: string) => `abha:enrol:${journeyId}`;

interface OtpState {
  txnId: string;
  sentAt: number;
  resends: number;
}

/**
 * One front-desk journey, held in Redis for half an hour and never in the
 * database. It never holds an Aadhaar number or an OTP. It does hold ABDM's
 * user token and the profile until the desk saves or the journey expires.
 */
interface Journey {
  id: string;
  organizationId: string;
  userId: string;
  aadhaar: OtpState;
  mobile: OtpState | null;
  communicationMobile: string | null;
  mobileVerified: boolean;
  txnId: string;
  userToken: string | null;
  isNew: boolean | null;
  profile: AbhaProfile | null;
  savedPatientId: string | null;
}

function fullName(profile: AbhaProfile): string | null {
  const name = [profile.firstName, profile.middleName, profile.lastName]
    .filter((part): part is string => Boolean(part))
    .join(' ');
  return name.length > 0 ? name : null;
}

function profileView(profile: AbhaProfile): AbhaProfileView {
  return {
    abhaNumber: profile.abhaNumber,
    abhaAddresses: profile.abhaAddresses,
    preferredAbhaAddress: profile.preferredAbhaAddress,
    name: fullName(profile),
    dateOfBirth: profile.dateOfBirth,
    gender: profile.gender,
    mobile: profile.mobile,
    email: profile.email,
    address: profile.address,
    districtName: profile.districtName,
    stateName: profile.stateName,
    pinCode: profile.pinCode,
    photo: profile.photo,
    abhaStatus: profile.abhaStatus,
    kycVerified: profile.kycVerified,
  };
}

/** ABDM writes dates as `DD-MM-YYYY`; a bare year is not enough to register with. */
export function abdmDateToIso(value: string | null): string | null {
  const match = value ? /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(value.trim()) : null;
  if (!match) return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
  const [, day = '', month = '', year = ''] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function abdmGenderToSex(value: string | null): RegisterPatient['sex'] {
  const code = (value ?? '').trim().toUpperCase();
  if (code === 'F' || code === 'FEMALE') return 'FEMALE';
  if (code === 'M' || code === 'MALE') return 'MALE';
  if (code === 'O' || code === 'OTHER' || code === 'T') return 'OTHER';
  return 'UNKNOWN';
}

const lastTenDigits = (value: string | null) => (value ?? '').replace(/\D+/g, '').slice(-10);
const sameName = (a: string, b: string) =>
  a.trim().toLowerCase().replace(/\s+/g, ' ') === b.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * "Create ABHA by Aadhaar OTP" as the front desk walks it: consent, Aadhaar
 * OTP, communication mobile, ABHA address, profile and card, then saving to
 * the facility's own record without creating a second patient.
 */
@Injectable()
export class AbhaEnrolmentService {
  private readonly client: AbhaEnrollmentClient | null;

  constructor(
    @Inject(ABDM_GATEWAY) private readonly gateway: AbdmGateway | null,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    private readonly registration: PatientRegistrationService,
  ) {
    this.client = gateway ? new AbhaEnrollmentClient(gateway) : null;
  }

  /** Records the consent, then sends the Aadhaar OTP. Nothing is sent before the consent is in. */
  async start(
    actor: ActorContext,
    meta: RequestMeta,
    input: StartAbhaEnrolment,
  ): Promise<AbhaOtpChallenge> {
    const organizationId = await this.requireClinic(actor);
    const client = this.requireClient();
    const journeyId = randomUUID();
    await this.audit.record({
      actor,
      meta,
      organizationId,
      action: 'CONSENT_GRANT',
      resourceType: 'AbhaEnrolmentConsent',
      resourceId: journeyId,
      decision: 'ALLOW',
      // Codes only: who confirmed is the actor, when is the event time.
      metadata: {
        terms: ABHA_ENROLLMENT_CONSENT.code,
        termsVersion: ABHA_ENROLLMENT_CONSENT.version,
        declarations: ['aadhaarSharing', 'recordsLinking', 'recordsSharing', 'anonymizedUse'],
        workerConfirmed: true,
        beneficiaryConfirmed: true,
      },
    });
    const sent = await this.abdm(() => client.requestAadhaarOtp(input.aadhaarNumber));
    const journey: Journey = {
      id: journeyId,
      organizationId,
      userId: actor.userId,
      aadhaar: { txnId: sent.txnId, sentAt: Date.now(), resends: 0 },
      mobile: null,
      communicationMobile: null,
      mobileVerified: false,
      txnId: sent.txnId,
      userToken: null,
      isNew: null,
      profile: null,
      savedPatientId: null,
    };
    await this.save(journey);
    return this.challenge(journey, journey.aadhaar, sent.message);
  }

  async resendAadhaarOtp(
    actor: ActorContext,
    journeyId: string,
    aadhaarNumber: string,
  ): Promise<AbhaOtpChallenge> {
    const journey = await this.load(actor, journeyId);
    const client = this.requireClient();
    this.checkResend(journey.aadhaar);
    // The sandbox refuses a resend that carries the first transaction id (a bare
    // 400, observed 2026-11-19, 65 seconds after the send), and accepts a fresh
    // send, which returns a new id. Later calls use the newest id.
    const sent = await this.abdm(() => client.requestAadhaarOtp(aadhaarNumber));
    journey.aadhaar = {
      txnId: sent.txnId,
      sentAt: Date.now(),
      resends: journey.aadhaar.resends + 1,
    };
    journey.txnId = sent.txnId;
    await this.save(journey);
    return this.challenge(journey, journey.aadhaar, sent.message);
  }

  /** A wrong OTP keeps the journey: the same transaction takes the next attempt. */
  async verifyAadhaarOtp(
    actor: ActorContext,
    meta: RequestMeta,
    journeyId: string,
    input: { otp: string; mobile: string },
  ): Promise<AbhaEnrolmentView> {
    const journey = await this.load(actor, journeyId);
    const client = this.requireClient();
    const enrolled = await this.abdm(() =>
      client.enrolByAadhaar({ txnId: journey.aadhaar.txnId, otp: input.otp, mobile: input.mobile }),
    );
    journey.txnId = enrolled.txnId ?? journey.txnId;
    journey.userToken = enrolled.userToken;
    journey.isNew = enrolled.isNew;
    journey.profile = enrolled.profile;
    journey.communicationMobile = input.mobile;
    journey.mobileVerified = lastTenDigits(enrolled.profile.mobile) === input.mobile;
    await this.save(journey);
    await this.audit.record({
      actor,
      meta,
      organizationId: journey.organizationId,
      action: 'CREATE',
      resourceType: 'AbhaEnrolment',
      resourceId: journey.id,
      decision: 'ALLOW',
      metadata: { isNew: enrolled.isNew },
    });
    return {
      journeyId: journey.id,
      isNew: enrolled.isNew,
      message: enrolled.message,
      profile: profileView(enrolled.profile),
      mobileVerificationRequired: !journey.mobileVerified,
    };
  }

  async sendMobileOtp(actor: ActorContext, journeyId: string): Promise<AbhaOtpChallenge> {
    const journey = await this.enrolled(actor, journeyId);
    const client = this.requireClient();
    if (!journey.communicationMobile) throw Problems.conflict('No communication mobile was given.');
    if (journey.mobile) this.checkResend(journey.mobile);
    const mobile = journey.communicationMobile;
    const sent = await this.abdm(() => client.requestMobileOtp(journey.txnId, mobile));
    journey.mobile = {
      txnId: sent.txnId,
      sentAt: Date.now(),
      resends: journey.mobile ? journey.mobile.resends + 1 : 0,
    };
    await this.save(journey);
    return this.challenge(journey, journey.mobile, sent.message);
  }

  async verifyMobileOtp(
    actor: ActorContext,
    journeyId: string,
    otp: string,
  ): Promise<AbhaMobileVerification> {
    const journey = await this.enrolled(actor, journeyId);
    const client = this.requireClient();
    const challenge = journey.mobile;
    if (!challenge) throw Problems.conflict('Send the mobile OTP first.');
    const outcome = await this.abdm(() => client.verifyMobileOtp(challenge.txnId, otp));
    if (outcome.verified) {
      journey.mobileVerified = true;
      if (journey.profile) journey.profile.mobile = journey.communicationMobile;
      await this.save(journey);
    }
    return { verified: outcome.verified, message: outcome.message };
  }

  async addressSuggestions(
    actor: ActorContext,
    journeyId: string,
  ): Promise<AbhaAddressSuggestions> {
    const journey = await this.enrolled(actor, journeyId);
    const client = this.requireClient();
    const suggestions = await this.abdm(() => client.addressSuggestions(journey.txnId));
    return { suggestions, suffix: this.config.env.ABDM_CM_ID === 'sbx' ? '@sbx' : '@abdm' };
  }

  async createAddress(
    actor: ActorContext,
    journeyId: string,
    abhaAddress: string,
  ): Promise<AbhaAddressResult> {
    const journey = await this.enrolled(actor, journeyId);
    const client = this.requireClient();
    const created = await this.abdm(() => client.createAddress(journey.txnId, abhaAddress));
    if (journey.profile && created.preferredAbhaAddress) {
      const address = created.preferredAbhaAddress;
      journey.profile.preferredAbhaAddress = address;
      if (!journey.profile.abhaAddresses.includes(address)) {
        journey.profile.abhaAddresses.push(address);
      }
      await this.save(journey);
    }
    return { preferredAbhaAddress: created.preferredAbhaAddress };
  }

  /** The profile as ABDM holds it now, so the communication mobile shown is the verified one. */
  async profile(actor: ActorContext, journeyId: string): Promise<AbhaProfileView> {
    const journey = await this.enrolled(actor, journeyId);
    const client = this.requireClient();
    const token = journey.userToken;
    if (!token || !journey.profile) throw Problems.conflict('The ABHA profile is not available.');
    const fresh = await this.abdm(() => client.profile(token));
    journey.profile = {
      ...journey.profile,
      ...Object.fromEntries(
        Object.entries(fresh).filter(
          ([, value]) => value !== null && !(Array.isArray(value) && value.length === 0),
        ),
      ),
    };
    await this.save(journey);
    return profileView(journey.profile);
  }

  /** The ABHA card exactly as ABDM returned it. */
  async card(
    actor: ActorContext,
    journeyId: string,
  ): Promise<{ bytes: Buffer; contentType: string }> {
    const journey = await this.enrolled(actor, journeyId);
    const client = this.requireClient();
    const token = journey.userToken;
    if (!token) throw Problems.conflict('The ABHA card is not available.');
    const card = await this.abdm(() => client.card(token));
    return { bytes: card.bytes, contentType: card.contentType ?? 'image/png' };
  }

  /**
   * Returning patients: search the facility's own records before anything is
   * created. An ABHA number already linked, or a full match on mobile, name,
   * gender and year of birth, or the record number the patient gives.
   */
  async matches(actor: ActorContext, journeyId: string, mrn?: string): Promise<AbhaMatches> {
    const journey = await this.enrolled(actor, journeyId);
    const found = await this.findMatches(journey, mrn);
    return {
      matches: found,
      mayCreate: !found.some((row) => row.reason !== 'RECORD_NUMBER'),
    };
  }

  /** Links the ABHA to an existing record, or creates one only when no match holds. */
  async saveToRecord(
    actor: ActorContext,
    meta: RequestMeta,
    journeyId: string,
    input: SaveAbhaEnrolment,
  ): Promise<PatientRegistrationResult> {
    const journey = await this.enrolled(actor, journeyId);
    const profile = journey.profile;
    if (!profile?.abhaNumber) throw Problems.conflict('The ABHA carried no ABHA number.');
    const abha = { abhaNumber: profile.abhaNumber, abhaAddress: profile.preferredAbhaAddress };

    let result: PatientRegistrationResult;
    if (input.action === 'LINK') {
      result = await this.registration.linkAbha(actor, meta, input.patientId, abha);
    } else {
      const found = await this.findMatches(journey);
      if (found.some((row) => row.reason === 'DEMOGRAPHICS')) {
        throw Problems.conflict(
          'A patient with the same mobile, name, gender and year of birth is already registered. Link the ABHA to that record.',
        );
      }
      const dateOfBirth = abdmDateToIso(profile.dateOfBirth);
      const givenName = [profile.firstName, profile.middleName].filter(Boolean).join(' ');
      if (!dateOfBirth || !givenName) {
        throw Problems.conflict(
          'The ABHA profile has no full name or date of birth. Register the patient first, then link the ABHA.',
        );
      }
      const phone = lastTenDigits(journey.communicationMobile ?? profile.mobile);
      result = await this.registration.register(
        actor,
        meta,
        {
          givenName,
          ...(profile.lastName ? { familyName: profile.lastName } : {}),
          dateOfBirth,
          sex: abdmGenderToSex(profile.gender),
          ...(phone.length === 10 ? { phone } : {}),
          ...(input.preferredLocale ? { preferredLocale: input.preferredLocale } : {}),
        },
        abha,
      );
    }
    journey.savedPatientId = result.patient.id;
    await this.save(journey);
    // Ties the consent recorded at the start of the journey to the patient.
    await this.audit.record({
      actor,
      meta,
      organizationId: journey.organizationId,
      action: 'UPDATE',
      resourceType: 'AbhaEnrolmentConsent',
      resourceId: journey.id,
      patientProfileId: result.patient.id,
      decision: 'ALLOW',
      metadata: { linked: input.action, status: result.status },
    });
    return result;
  }

  private async findMatches(journey: Journey, mrn?: string): Promise<AbhaPatientMatch[]> {
    const profile = journey.profile;
    if (!profile) return [];
    const db = this.prisma.tenant(journey.organizationId);
    const found = new Map<string, AbhaPatientMatch>();
    const add = (
      row: {
        id: string;
        mrn: string;
        givenName: string;
        familyName: string | null;
        abhaNumber: string | null;
      },
      reason: AbhaPatientMatch['reason'],
    ) => {
      if (!found.has(row.id)) {
        found.set(row.id, {
          patientId: row.id,
          mrn: row.mrn,
          displayName: patientDisplayName(row),
          reason,
          abhaLinked: Boolean(row.abhaNumber),
        });
      }
    };

    if (profile.abhaNumber) {
      const linked = await db.patientProfile.findFirst({
        where: { abhaNumber: normalizeAbhaNumber(profile.abhaNumber), deletedAt: null },
      });
      if (linked) add(linked, 'ABHA_NUMBER');
    }

    const dateOfBirth = abdmDateToIso(profile.dateOfBirth);
    const year = dateOfBirth?.slice(0, 4) ?? /^\d{4}$/.exec(profile.dateOfBirth ?? '')?.[0];
    const mobile = lastTenDigits(journey.communicationMobile ?? profile.mobile);
    const name = fullName(profile);
    const sex = abdmGenderToSex(profile.gender);
    if (year && mobile.length === 10 && name && sex !== 'UNKNOWN') {
      const candidates = await db.patientProfile.findMany({
        where: {
          deletedAt: null,
          isSynthetic: false,
          sex,
          dateOfBirth: {
            gte: new Date(`${year}-01-01T00:00:00Z`),
            lte: new Date(`${year}-12-31T00:00:00Z`),
          },
        },
        take: 200,
      });
      for (const row of candidates) {
        const rowName = patientDisplayName(row);
        const names =
          sameName(rowName, name) ||
          sameName(rowName, [profile.firstName, profile.lastName].filter(Boolean).join(' '));
        if (names && lastTenDigits(row.phone) === mobile) add(row, 'DEMOGRAPHICS');
      }
    }

    if (mrn) {
      const byNumber = await db.patientProfile.findFirst({
        where: { mrn: { equals: mrn, mode: 'insensitive' }, deletedAt: null, isSynthetic: false },
      });
      if (byNumber) add(byNumber, 'RECORD_NUMBER');
    }
    return [...found.values()];
  }

  private challenge(journey: Journey, state: OtpState, message: string | null): AbhaOtpChallenge {
    return {
      journeyId: journey.id,
      message,
      resendsLeft: Math.max(ABHA_OTP_RULES.maxResends - state.resends, 0),
      resendAvailableAt: new Date(
        state.sentAt + ABHA_OTP_RULES.resendWaitSeconds * 1000,
      ).toISOString(),
    };
  }

  /** At most two resends, each at least 60 seconds after the last send. A refusal calls nothing. */
  private checkResend(state: OtpState): void {
    if (state.resends >= ABHA_OTP_RULES.maxResends) throw Problems.conflict(ABHA_TEXT.resendLimit);
    const wait = state.sentAt + ABHA_OTP_RULES.resendWaitSeconds * 1000 - Date.now();
    if (wait > 0) {
      throw Problems.conflict(`Resend is available in ${Math.ceil(wait / 1000)} seconds.`);
    }
  }

  private requireClient(): AbhaEnrollmentClient {
    if (!this.client) {
      throw Problems.serviceUnavailable('ABDM is not connected in this environment.');
    }
    return this.client;
  }

  /** Real identities never enter a demo organization. */
  private async requireClinic(actor: ActorContext): Promise<string> {
    const organizationId = requireOrganization(actor);
    const organization = await this.prisma.db.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
    });
    if (!organization) throw Problems.notFound('organization');
    if (organization.isDemo) {
      throw Problems.forbidden('ABHA journeys are not available in a demo organization.');
    }
    return organizationId;
  }

  private async load(actor: ActorContext, journeyId: string): Promise<Journey> {
    const organizationId = requireOrganization(actor);
    const raw = await this.redis.client.get(KEY(journeyId));
    const journey = raw ? (JSON.parse(raw) as Journey) : null;
    // Another desk's or another clinic's journey reads as not found.
    if (!journey || journey.organizationId !== organizationId || journey.userId !== actor.userId) {
      throw Problems.notFound('ABHA journey (it may have expired; start again)');
    }
    return journey;
  }

  private async enrolled(actor: ActorContext, journeyId: string): Promise<Journey> {
    const journey = await this.load(actor, journeyId);
    if (!journey.profile) throw Problems.conflict('Verify the Aadhaar OTP first.');
    return journey;
  }

  private async save(journey: Journey): Promise<void> {
    await this.redis.client.set(
      KEY(journey.id),
      JSON.stringify(journey),
      'EX',
      JOURNEY_TTL_SECONDS,
    );
  }

  /** Turns an ABDM refusal into a problem that carries ABDM's own message, unchanged. */
  private async abdm<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      if (!(error instanceof AbdmApiError)) throw error;
      if (error.status === 0) throw Problems.serviceUnavailable('ABDM could not be reached.');
      if (error.status === 401 && error.code !== 'ABDM-1017') this.gateway?.session.invalidate();
      throw Problems.abdmRefused(error.abdmMessage, error.code);
    }
  }
}

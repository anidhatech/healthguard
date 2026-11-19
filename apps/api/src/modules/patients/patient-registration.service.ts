import { Injectable } from '@nestjs/common';
import {
  normalizeAbhaAddress,
  normalizeAbhaNumber,
  resolveLocale,
  type PatientRegistrationResult,
  type RegisterPatient,
} from '@healthguard/shared';
import { requireOrganization, type ActorContext, type RequestMeta } from '../../common/actor.js';
import { patientDisplayName } from '../../common/mapping.js';
import { Problems } from '../../common/problem.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

/** An ABHA that ABDM has just verified. It never comes from a typed-in form. */
export interface VerifiedAbha {
  abhaNumber: string;
  abhaAddress?: string | null;
}

/** A starting routine for reminders; the patient or care team adjusts it later. */
const DEFAULT_DAILY_ROUTINE = {
  wake: '06:30',
  breakfast: '08:00',
  lunch: '13:30',
  dinner: '20:30',
  sleep: '22:30',
};

const MRN_ATTEMPTS = 5;

interface PatientRow {
  id: string;
  mrn: string;
  givenName: string;
  familyName: string | null;
  abhaNumber: string | null;
}

function result(status: 'CREATED' | 'EXISTING', row: PatientRow): PatientRegistrationResult {
  return {
    status,
    patient: {
      id: row.id,
      mrn: row.mrn,
      displayName: patientDisplayName(row),
      abhaLinked: Boolean(row.abhaNumber),
    },
  };
}

function uniqueViolation(error: unknown, field: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }
  return JSON.stringify(error.meta ?? {}).includes(field);
}

/** Initials of the organization's slug, as the record-number prefix: `city-care-clinic` → `CCC`. */
export function mrnPrefix(slug: string): string {
  const initials = slug
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 4);
  return initials.length > 0 ? initials : 'PT';
}

/**
 * Registers real patients at the front desk and keeps the rule that one ABHA
 * number belongs to one patient record in an organization. Demo organizations
 * hold synthetic, seeded patients only, so registration is refused there.
 */
@Injectable()
export class PatientRegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Creates a patient record. When a verified ABHA number is already linked to
   * a patient here, that patient is returned and no second record is created.
   */
  async register(
    actor: ActorContext,
    meta: RequestMeta,
    input: RegisterPatient,
    abha?: VerifiedAbha,
  ): Promise<PatientRegistrationResult> {
    const organizationId = requireOrganization(actor);
    const organization = await this.prisma.db.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
    });
    if (!organization) throw Problems.notFound('organization');
    if (organization.isDemo) {
      throw Problems.forbidden(
        'Demo organizations hold synthetic patients only. Register patients in a clinic organization.',
      );
    }
    if (new Date(`${input.dateOfBirth}T00:00:00Z`).getTime() > Date.now()) {
      throw Problems.validation([
        { path: 'dateOfBirth', message: 'The date of birth cannot be in the future.' },
      ]);
    }
    const db = this.prisma.tenant(organizationId);
    const abhaNumber = abha ? normalizeAbhaNumber(abha.abhaNumber) : null;
    const abhaAddress = abha?.abhaAddress ? normalizeAbhaAddress(abha.abhaAddress) : null;
    if (abha && !abhaNumber) throw Problems.conflict('The verified ABHA carried no ABHA number.');

    if (abhaNumber) {
      const existing = await db.patientProfile.findFirst({ where: { abhaNumber } });
      if (existing) return this.existing(actor, meta, organizationId, existing);
    }

    const prefix = mrnPrefix(organization.slug);
    let sequence = (await db.patientProfile.count()) + 1;
    for (let attempt = 0; attempt < MRN_ATTEMPTS; attempt += 1, sequence += 1) {
      try {
        const created = await db.patientProfile.create({
          data: {
            organizationId,
            mrn: `${prefix}-${String(sequence).padStart(6, '0')}`,
            givenName: input.givenName,
            familyName: input.familyName ?? null,
            dateOfBirth: new Date(`${input.dateOfBirth}T00:00:00Z`),
            sex: input.sex,
            phone: input.phone ?? null,
            preferredLocale: resolveLocale(input.preferredLocale),
            timezone: organization.timezone,
            dailyRoutine: DEFAULT_DAILY_ROUTINE,
            isSynthetic: false,
            abhaNumber,
            abhaAddress,
            abhaVerifiedAt: abhaNumber ? new Date() : null,
          },
        });
        await this.audit.record({
          actor,
          meta,
          organizationId,
          action: 'CREATE',
          resourceType: 'PatientProfile',
          resourceId: created.id,
          patientProfileId: created.id,
          decision: 'ALLOW',
          // Never the identifiers themselves.
          metadata: { abhaLinked: Boolean(abhaNumber) },
        });
        return result('CREATED', created);
      } catch (error) {
        if (uniqueViolation(error, 'mrn')) continue;
        if (abhaNumber && uniqueViolation(error, 'abhaNumber')) {
          // Another desk linked the same ABHA number a moment ago.
          const existing = await db.patientProfile.findFirst({ where: { abhaNumber } });
          if (existing) return this.existing(actor, meta, organizationId, existing);
        }
        if (uniqueViolation(error, 'abhaAddress')) {
          throw Problems.conflict('This ABHA address is already linked to another patient.');
        }
        throw error;
      }
    }
    throw Problems.conflict('A record number could not be assigned. Try again.');
  }

  /** Links a verified ABHA to a patient who is already registered. */
  async linkAbha(
    actor: ActorContext,
    meta: RequestMeta,
    patientId: string,
    abha: VerifiedAbha,
  ): Promise<PatientRegistrationResult> {
    const organizationId = requireOrganization(actor);
    const db = this.prisma.tenant(organizationId);
    const abhaNumber = normalizeAbhaNumber(abha.abhaNumber);
    if (!abhaNumber) throw Problems.conflict('The verified ABHA carried no ABHA number.');
    const abhaAddress = abha.abhaAddress ? normalizeAbhaAddress(abha.abhaAddress) : null;

    const patient = await db.patientProfile.findFirst({
      where: { id: patientId, deletedAt: null },
    });
    if (!patient) throw Problems.notFound('patient');
    if (patient.isSynthetic) {
      throw Problems.forbidden('A synthetic demo patient cannot be linked to an ABHA.');
    }
    if (patient.abhaNumber && patient.abhaNumber !== abhaNumber) {
      throw Problems.conflict('This patient is already linked to a different ABHA number.');
    }
    const holder = await db.patientProfile.findFirst({ where: { abhaNumber } });
    if (holder && holder.id !== patient.id) {
      throw Problems.conflict('This ABHA number is already linked to another patient record.');
    }
    try {
      const updated = await db.patientProfile.update({
        where: { id: patient.id },
        data: {
          abhaNumber,
          abhaAddress: abhaAddress ?? patient.abhaAddress,
          abhaVerifiedAt: new Date(),
        },
      });
      await this.audit.record({
        actor,
        meta,
        organizationId,
        action: 'UPDATE',
        resourceType: 'PatientProfile',
        resourceId: updated.id,
        patientProfileId: updated.id,
        decision: 'ALLOW',
        metadata: { abhaLinked: true },
      });
      return result('EXISTING', updated);
    } catch (error) {
      if (uniqueViolation(error, 'abhaNumber')) {
        throw Problems.conflict('This ABHA number is already linked to another patient record.');
      }
      if (uniqueViolation(error, 'abhaAddress')) {
        throw Problems.conflict('This ABHA address is already linked to another patient.');
      }
      throw error;
    }
  }

  private async existing(
    actor: ActorContext,
    meta: RequestMeta,
    organizationId: string,
    row: PatientRow,
  ): Promise<PatientRegistrationResult> {
    await this.audit.record({
      actor,
      meta,
      organizationId,
      action: 'READ',
      resourceType: 'PatientProfile',
      resourceId: row.id,
      patientProfileId: row.id,
      decision: 'ALLOW',
      decisionReason: 'ABHA_ALREADY_LINKED',
      metadata: { abhaLinked: true },
    });
    return result('EXISTING', row);
  }
}

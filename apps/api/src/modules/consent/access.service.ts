import { Injectable } from '@nestjs/common';
import type { AccessAction, AccessReason, DataCategory } from '@healthguard/shared';
import type { ActorContext } from '../../common/actor.js';
import type { PatientProfile } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

export type AccessDecisionResult =
  | {
      allowed: true;
      reason: AccessReason;
      patient: PatientProfile;
      consentId: string | null;
      purposeCode: string | null;
    }
  | {
      allowed: false;
      reason: AccessReason;
      status: 403 | 404;
      patient: PatientProfile | null;
      purposeCode: string | null;
      /**
       * For the audit trail only: the patient a cross-tenant attempt was
       * aimed at, so the patient's own access log shows it. Never returned
       * to the caller, who just gets 404.
       */
      auditPatientId?: string;
    };

/**
 * The single access decision for patient data (Security §4). Order:
 *
 * 1. the patient exists (404 otherwise);
 * 2. self: patients always see their own record;
 * 3. tenant: staff only reach patients of their active organization, and
 *    other tenants' patients look like they do not exist (404);
 * 4. role policy for the category and action (403);
 * 5. demographics are organization-scoped (find a patient to book them);
 * 6. an active patient consent covering the category and purpose (403);
 * 7. a care relationship when the policy requires one (403).
 *
 * The decision is enforced on the server for every request; the web app
 * never filters data on its own.
 */
@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  async decide(
    actor: ActorContext,
    patientId: string,
    category: DataCategory,
    action: AccessAction = 'READ',
    purposeCode: string | null = null,
  ): Promise<AccessDecisionResult> {
    const patient = await this.prisma.db.patientProfile.findUnique({ where: { id: patientId } });
    if (!patient || patient.deletedAt) {
      return {
        allowed: false,
        reason: 'PATIENT_NOT_FOUND',
        status: 404,
        patient: null,
        purposeCode,
      };
    }

    if (actor.patientProfileIds.includes(patient.id)) {
      if (action === 'SIGN') {
        return {
          allowed: false,
          reason: 'PATIENTS_CANNOT_SIGN',
          status: 403,
          patient,
          purposeCode,
        };
      }
      return { allowed: true, reason: 'SELF', patient, consentId: null, purposeCode: null };
    }

    if (!actor.memberId || patient.organizationId !== actor.activeOrganizationId) {
      return {
        allowed: false,
        reason: 'NOT_A_MEMBER',
        status: 404,
        patient: null,
        purposeCode,
        auditPatientId: patient.id,
      };
    }

    const policies = await this.prisma.db.accessPolicy.findMany({
      where: {
        isActive: true,
        category,
        role: { in: actor.memberRoles },
        actions: { has: action },
        OR: [{ organizationId: null }, { organizationId: patient.organizationId }],
      },
    });
    if (policies.some((policy) => policy.effect === 'DENY')) {
      return { allowed: false, reason: 'ROLE_NOT_PERMITTED', status: 403, patient, purposeCode };
    }
    const allows = policies.filter((policy) => policy.effect === 'ALLOW');
    if (allows.length === 0) {
      return { allowed: false, reason: 'ROLE_NOT_PERMITTED', status: 403, patient, purposeCode };
    }
    const needsCareRelationship = allows.every((policy) => policy.requiresCareRelationship);

    if (category === 'DEMOGRAPHICS' && !needsCareRelationship) {
      return {
        allowed: true,
        reason: 'DEMOGRAPHICS_ORGANIZATION_SCOPE',
        patient,
        consentId: null,
        purposeCode,
      };
    }

    const now = new Date();
    const consents = await this.prisma.db.consent.findMany({
      where: {
        patientProfileId: patient.id,
        organizationId: patient.organizationId,
        status: 'GRANTED',
        validFrom: { lte: now },
        validUntil: { gt: now },
        categories: { has: category },
        purpose: purposeCode ? { code: purposeCode } : { code: { not: 'AI_ASSISTANCE' } },
        OR: [
          { granteeType: 'ORGANIZATION' },
          ...(actor.clinicianId
            ? [{ granteeType: 'CLINICIAN' as const, granteeClinicianId: actor.clinicianId }]
            : []),
        ],
      },
      include: { purpose: true },
      orderBy: { validFrom: 'asc' },
    });
    const consent = consents[0];
    if (!consent) {
      return { allowed: false, reason: 'NO_ACTIVE_CONSENT', status: 403, patient, purposeCode };
    }

    if (needsCareRelationship && !(await this.hasCareRelationship(actor, patient))) {
      return { allowed: false, reason: 'NO_CARE_RELATIONSHIP', status: 403, patient, purposeCode };
    }
    return {
      allowed: true,
      reason: 'ALLOWED',
      patient,
      consentId: consent.id,
      purposeCode: consent.purpose.code,
    };
  }

  /** Primary clinician, an encounter or appointment, or a consent naming the clinician. */
  async hasCareRelationship(actor: ActorContext, patient: PatientProfile): Promise<boolean> {
    const clinicianId = actor.clinicianId;
    if (!clinicianId) return false;
    if (patient.primaryClinicianId === clinicianId) return true;
    const scoped = this.prisma.tenant(patient.organizationId);
    const [encounters, appointments, consents] = await Promise.all([
      scoped.encounter.count({ where: { patientProfileId: patient.id, clinicianId } }),
      scoped.appointment.count({
        where: { patientProfileId: patient.id, clinicianId, status: { not: 'CANCELLED' } },
      }),
      scoped.consent.count({
        where: { patientProfileId: patient.id, granteeClinicianId: clinicianId, status: 'GRANTED' },
      }),
    ]);
    return encounters + appointments + consents > 0;
  }

  /** The patient's active AI_ASSISTANCE consent covering every category, if any. */
  async activeAiConsent(patient: PatientProfile, categories: readonly DataCategory[]) {
    const now = new Date();
    return this.prisma.tenant(patient.organizationId).consent.findFirst({
      where: {
        patientProfileId: patient.id,
        status: 'GRANTED',
        validFrom: { lte: now },
        validUntil: { gt: now },
        purpose: { code: 'AI_ASSISTANCE' },
        categories: { hasEvery: [...categories] },
      },
    });
  }
}

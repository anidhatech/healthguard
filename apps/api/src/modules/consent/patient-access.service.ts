import { Injectable } from '@nestjs/common';
import type { AccessAction, AccessReason, DataCategory } from '@healthguard/shared';
import type { ActorContext, RequestMeta } from '../../common/actor.js';
import { Problems } from '../../common/problem.js';
import type { PatientProfile } from '../../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { AccessService } from './access.service.js';

const DENIAL_TEXT: Partial<Record<AccessReason, string>> = {
  ROLE_NOT_PERMITTED: 'Your role does not include this kind of data.',
  NO_ACTIVE_CONSENT:
    'The patient has not given (or has withdrawn) consent for this data and purpose.',
  NO_CARE_RELATIONSHIP:
    "You are not in this patient's care team. Ask the primary clinician to add you.",
  NO_AI_CONSENT: 'The patient has not consented to AI-assisted summaries.',
  PATIENTS_CANNOT_SIGN: 'Patients cannot sign clinical orders.',
};

export interface AuthorizedPatient {
  patient: PatientProfile;
  consentId: string | null;
  purposeCode: string | null;
}

/** Runs the access decision, audits it (allow and deny), and throws on deny. */
@Injectable()
export class PatientAccessService {
  constructor(
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  async authorize(
    actor: ActorContext,
    meta: RequestMeta,
    patientId: string,
    category: DataCategory,
    resourceType: string,
    action: AccessAction = 'READ',
  ): Promise<AuthorizedPatient> {
    const purpose = meta.purposeHeader;
    const decision = await this.access.decide(actor, patientId, category, action, purpose);
    await this.audit.record({
      actor,
      meta,
      action: decision.allowed ? (action === 'READ' ? 'READ' : 'UPDATE') : 'ACCESS_DENIED',
      resourceType,
      patientProfileId: decision.patient?.id ?? null,
      purposeCode: decision.purposeCode,
      consentId: decision.allowed ? decision.consentId : null,
      decision: decision.allowed ? 'ALLOW' : 'DENY',
      decisionReason: decision.reason,
      metadata: { category, action },
    });
    if (!decision.allowed) {
      if (decision.status === 404) throw Problems.notFound('patient');
      throw Problems.accessDenied(
        decision.reason,
        DENIAL_TEXT[decision.reason] ?? 'Access denied.',
      );
    }
    return {
      patient: decision.patient,
      consentId: decision.consentId,
      purposeCode: decision.purposeCode,
    };
  }

  /**
   * For views that combine categories (the timeline): returns which
   * categories the caller may see. Fails only if the patient is unreachable.
   */
  async authorizeCategories(
    actor: ActorContext,
    meta: RequestMeta,
    patientId: string,
    categories: readonly DataCategory[],
    resourceType: string,
  ): Promise<{ patient: PatientProfile; allowed: DataCategory[]; hidden: DataCategory[] }> {
    const allowed: DataCategory[] = [];
    const hidden: DataCategory[] = [];
    let patient: PatientProfile | null = null;
    for (const category of categories) {
      const decision = await this.access.decide(
        actor,
        patientId,
        category,
        'READ',
        meta.purposeHeader,
      );
      if (!decision.patient && !decision.allowed) {
        await this.audit.record({
          actor,
          meta,
          action: 'ACCESS_DENIED',
          resourceType,
          decision: 'DENY',
          decisionReason: decision.reason,
          metadata: { category },
        });
        throw Problems.notFound('patient');
      }
      patient = decision.patient;
      (decision.allowed ? allowed : hidden).push(category);
    }
    if (!patient) throw Problems.notFound('patient');
    await this.audit.record({
      actor,
      meta,
      action: allowed.length ? 'READ' : 'ACCESS_DENIED',
      resourceType,
      patientProfileId: patient.id,
      decision: allowed.length ? 'ALLOW' : 'DENY',
      decisionReason: allowed.length ? 'ALLOWED' : 'NO_ACTIVE_CONSENT',
      metadata: { allowed, hidden },
    });
    return { patient, allowed, hidden };
  }

  /** The caller must be the patient themself (patient-only actions such as revoking consent). */
  async requireSelf(
    actor: ActorContext,
    meta: RequestMeta,
    patientId: string,
    resourceType: string,
  ): Promise<void> {
    if (!actor.patientProfileIds.includes(patientId)) {
      await this.audit.record({
        actor,
        meta,
        action: 'ACCESS_DENIED',
        resourceType,
        decision: 'DENY',
        decisionReason: 'ROLE_NOT_PERMITTED',
        metadata: { patientOnly: true },
      });
      throw Problems.forbidden('Only the patient can do this.');
    }
  }
}

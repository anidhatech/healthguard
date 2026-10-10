import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  AI_TASK_DEFINITIONS,
  ClaudeProvider,
  DemoAIProvider,
  PromptRegistry,
  runDoctorBrief,
  screenAiRequest,
  type AIProvider,
  type Fact,
  type FactSheet,
} from '@healthguard/ai';
import {
  AI_TASK_NAMES,
  IMPLEMENTED_AI_TASKS,
  PROHIBITED_AI_TASKS,
  type AiRequestBody,
  type AiResultView,
  type AiStatus,
  type DataCategory,
} from '@healthguard/shared';
import type { ActorContext, RequestMeta } from '../../common/actor.js';
import { iso } from '../../common/mapping.js';
import { Problems } from '../../common/problem.js';
import { APP_CONFIG, type AppConfig } from '../../config/env.js';
import type { AIRecommendation, Prisma, SourceEntity } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AccessService } from '../consent/access.service.js';
import { FactSheetService } from './fact-sheet.service.js';

export const AI_NOTICE =
  'AI summary of recorded facts for the clinician. It may be incomplete or wrong: check every line against its sources. It does not diagnose or recommend treatment.';

const SOURCE_ENTITIES: Record<string, SourceEntity> = {
  Encounter: 'ENCOUNTER',
  Condition: 'CONDITION',
  Allergy: 'ALLERGY',
  MedicationPlan: 'MEDICATION_PLAN',
  LabResult: 'LAB_RESULT',
  Vital: 'VITAL',
  Calculation: 'CALCULATION',
};

function sourcesFor(factIds: readonly string[], sheet: FactSheet) {
  return factIds
    .map((id) => sheet.facts.find((fact) => fact.id === id))
    .filter((fact): fact is Fact => Boolean(fact))
    .map((fact) => ({
      type: fact.source.type,
      id: fact.source.id,
      label: fact.text,
      locator: { factId: fact.id },
    }));
}

@Injectable()
export class AiService {
  private readonly logger = new Logger('AI');
  private readonly prompts = new PromptRegistry();
  private readonly demo = new DemoAIProvider();
  private readonly claude: AIProvider | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly factSheets: FactSheetService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    // The Claude provider exists only when a key is configured (never stored in the database).
    this.claude = config.env.ANTHROPIC_API_KEY
      ? new ClaudeProvider({
          apiKey: config.env.ANTHROPIC_API_KEY,
          defaultModel: config.env.AI_MODEL,
          fastModel: config.env.AI_FAST_MODEL,
          timeoutMs: config.env.AI_TIMEOUT_MS,
        })
      : null;
  }

  /**
   * The provider in use: the demo console's choice (SystemSetting `ai.provider`)
   * if set, else AI_PROVIDER. Claude is only possible with a configured key.
   */
  async providers(): Promise<{ primary: AIProvider; fallback: AIProvider | null }> {
    const setting = await this.prisma.db.systemSetting.findUnique({
      where: { key: 'ai.provider' },
    });
    const chosen =
      (setting?.value as { provider?: 'DEMO' | 'ANTHROPIC' } | null)?.provider ??
      this.config.aiProvider;
    if (chosen === 'ANTHROPIC' && this.claude) {
      return {
        primary: this.claude,
        fallback: this.config.env.AI_FALLBACK_TO_DEMO ? this.demo : null,
      };
    }
    return { primary: this.demo, fallback: this.demo };
  }

  async status(): Promise<AiStatus> {
    const { primary, fallback } = await this.providers();
    return {
      provider: primary.name,
      fallbackProvider: fallback ? 'DEMO' : 'NONE',
      anthropicKeyConfigured: Boolean(this.config.env.ANTHROPIC_API_KEY),
      models: { default: this.config.env.AI_MODEL, fast: this.config.env.AI_FAST_MODEL },
      implementedTasks: [...IMPLEMENTED_AI_TASKS],
      plannedTasks: AI_TASK_NAMES.filter(
        (task) => !(IMPLEMENTED_AI_TASKS as readonly string[]).includes(task),
      ),
      prohibitedTasks: [...PROHIBITED_AI_TASKS],
      notice: AI_NOTICE,
    };
  }

  async request(
    actor: ActorContext,
    meta: RequestMeta,
    patientId: string,
    body: AiRequestBody,
  ): Promise<AiResultView> {
    // 1. Request gate: prohibited tasks and instructions are refused before any data is read.
    const gate = screenAiRequest(body.task, body.instruction);
    if (!gate.allowed) {
      await this.audit.record({
        actor,
        meta,
        action: 'AI_INVOKE',
        resourceType: 'AIInteraction',
        aiAgent: 'SAFETY',
        decision: 'DENY',
        decisionReason: gate.code,
        metadata: { task: body.task.slice(0, 64), intent: gate.intent },
      });
      if (gate.code === 'TASK_NOT_AVAILABLE' || gate.code === 'UNKNOWN_TASK')
        throw Problems.aiNotAvailable(gate.reason);
      throw Problems.aiProhibited(gate.code, gate.reason);
    }

    // 2. Access: the clinician must be able to read every category the task uses.
    const categories = gate.definition.categories as readonly DataCategory[];
    const allowed: DataCategory[] = [];
    let patient = null;
    for (const category of categories) {
      const decision = await this.access.decide(
        actor,
        patientId,
        category,
        'READ',
        body.purpose ?? null,
      );
      if (!decision.patient && !decision.allowed) throw Problems.notFound('patient');
      patient = decision.patient;
      if (decision.allowed) allowed.push(category);
    }
    if (!patient) throw Problems.notFound('patient');
    if (allowed.length === 0) {
      await this.audit.record({
        actor,
        meta,
        action: 'ACCESS_DENIED',
        resourceType: 'AIInteraction',
        patientProfileId: patient.id,
        decision: 'DENY',
        decisionReason: 'NO_CARE_RELATIONSHIP',
        aiAgent: 'DOCTOR_BRIEF',
      });
      throw Problems.accessDenied(
        'NO_CARE_RELATIONSHIP',
        'You cannot see the data this summary would use.',
      );
    }

    // 3. The patient's AI consent must cover every category sent to the model.
    const aiConsent = await this.access.activeAiConsent(patient, allowed);
    const prompt = this.prompts.load('DOCTOR_BRIEF_SYNTHESIS');
    if (!aiConsent) {
      await this.prisma.tenant(patient.organizationId).aIInteraction.create({
        data: {
          organizationId: patient.organizationId,
          patientProfileId: patient.id,
          actorUserId: actor.userId,
          agent: 'DOCTOR_BRIEF',
          task: gate.definition.task,
          purposeCode: 'AI_ASSISTANCE',
          consentIds: [],
          provider: (await this.providers()).primary.name,
          model: 'none',
          promptKey: prompt.key,
          promptVersion: prompt.version,
          promptHash: prompt.hash,
          inputFactIds: [],
          inputHash: 'not-built',
          status: 'BLOCKED_BY_CONSENT',
          requestId: meta.requestId,
          completedAt: new Date(),
        },
      });
      await this.audit.record({
        actor,
        meta,
        action: 'ACCESS_DENIED',
        resourceType: 'AIInteraction',
        patientProfileId: patient.id,
        purposeCode: 'AI_ASSISTANCE',
        decision: 'DENY',
        decisionReason: 'NO_AI_CONSENT',
        aiAgent: 'DOCTOR_BRIEF',
      });
      throw Problems.accessDenied(
        'NO_AI_CONSENT',
        'The patient has not consented to AI-assisted summaries. The recorded data is still available without AI.',
      );
    }

    // 4. Facts → provider → validation → (fallback).
    const sheet = await this.factSheets.build(patient, allowed);
    const run = await runDoctorBrief(
      { prompts: this.prompts, ...(await this.providers()) },
      sheet,
      body.instruction ?? null,
    );
    if (run.fallbackReason)
      this.logger.warn(
        { requestId: meta.requestId, reason: run.fallbackReason },
        'AI fallback used',
      );

    // 5. Persist the interaction, recommendations and provenance; audit.
    const db = this.prisma.tenant(patient.organizationId);
    const completedAt = new Date();
    const interaction = await db.aIInteraction.create({
      data: {
        organizationId: patient.organizationId,
        patientProfileId: patient.id,
        actorUserId: actor.userId,
        agent: 'DOCTOR_BRIEF',
        task: gate.definition.task,
        purposeCode: 'AI_ASSISTANCE',
        consentIds: [aiConsent.id],
        provider: run.provider,
        model: run.model,
        promptKey: run.prompt.key,
        promptVersion: run.prompt.version,
        promptHash: run.prompt.hash,
        inputFactIds: sheet.facts
          .map((item) => item.source.id)
          .filter((id): id is string => Boolean(id)),
        inputHash: run.inputHash,
        output: (run.output ?? undefined) as Prisma.InputJsonValue | undefined,
        status: run.status,
        validation: { checks: run.checks } as Prisma.InputJsonValue,
        fallbackReason: run.fallbackReason,
        confidence: run.confidence,
        latencyMs: run.latencyMs,
        inputTokens: run.inputTokens,
        outputTokens: run.outputTokens,
        requestId: meta.requestId,
        completedAt,
      },
    });
    const recommendations: AIRecommendation[] = [];
    for (const observation of run.output?.observations ?? []) {
      recommendations.push(
        await db.aIRecommendation.create({
          data: {
            organizationId: patient.organizationId,
            patientProfileId: patient.id,
            aiInteractionId: interaction.id,
            type: observation.type,
            audience: 'CLINICIAN',
            text: observation.text,
            rationale: observation.rationale,
            confidence: observation.confidence,
            expiresAt: new Date(completedAt.getTime() + 7 * 86_400_000),
          },
        }),
      );
    }
    const provenanceRows: Prisma.SourceProvenanceCreateManyInput[] = [];
    run.output?.summary.forEach((claim, index) => {
      for (const source of sourcesFor(claim.factIds, sheet)) {
        provenanceRows.push({
          organizationId: patient.organizationId,
          subjectType: 'AI_CLAIM',
          subjectId: interaction.id,
          claimKey: `summary.${index}`,
          relationType: 'SUPPORTED_BY',
          sourceType: SOURCE_ENTITIES[source.type] ?? 'CALCULATION',
          sourceId: source.id,
          sourceLocator: source.locator,
        });
      }
    });
    run.output?.observations.forEach((observation, index) => {
      const recommendation = recommendations[index];
      if (!recommendation) return;
      for (const source of sourcesFor(observation.factIds, sheet)) {
        provenanceRows.push({
          organizationId: patient.organizationId,
          subjectType: 'AI_RECOMMENDATION',
          subjectId: recommendation.id,
          relationType: 'SUPPORTED_BY',
          sourceType: SOURCE_ENTITIES[source.type] ?? 'CALCULATION',
          sourceId: source.id,
          sourceLocator: source.locator,
        });
      }
    });
    if (provenanceRows.length) await db.sourceProvenance.createMany({ data: provenanceRows });
    await this.audit.record({
      actor,
      meta,
      action: 'AI_INVOKE',
      resourceType: 'AIInteraction',
      resourceId: interaction.id,
      patientProfileId: patient.id,
      purposeCode: 'AI_ASSISTANCE',
      consentId: aiConsent.id,
      aiAgent: 'DOCTOR_BRIEF',
      decision: 'ALLOW',
      decisionReason: 'ALLOWED',
      metadata: { status: run.status, provider: run.provider, facts: sheet.facts.length },
    });

    return {
      interactionId: interaction.id,
      task: gate.definition.task,
      status: run.status,
      kind: 'AI_SUMMARY',
      notice: AI_NOTICE,
      provider: run.provider,
      model: run.model,
      promptKey: run.prompt.key,
      promptVersion: run.prompt.version,
      cached: false,
      latencyMs: run.latencyMs,
      confidence: run.confidence,
      generatedAt: iso(completedAt),
      fallbackReason: run.fallbackReason,
      summary: (run.output?.summary ?? []).map((claim, index) => ({
        claimKey: `summary.${index}`,
        text: claim.text,
        sources: sourcesFor(claim.factIds, sheet),
      })),
      observations: (run.output?.observations ?? []).flatMap((observation, index) => {
        const recommendation = recommendations[index];
        if (!recommendation) return [];
        return [
          {
            id: recommendation.id,
            kind: 'AI_RECOMMENDATION' as const,
            type: observation.type,
            text: observation.text,
            rationale: observation.rationale,
            confidence: observation.confidence,
            status: recommendation.status,
            sources: sourcesFor(observation.factIds, sheet),
          },
        ];
      }),
      validation: {
        passed: run.status === 'SUCCEEDED' || run.status === 'FALLBACK_USED',
        checks: run.checks,
      },
    };
  }

  taskDefinitions() {
    return AI_TASK_DEFINITIONS;
  }
}

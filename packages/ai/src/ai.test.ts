import { DoctorBriefSynthesisSchema, type DoctorBriefSynthesis } from '@healthguard/shared';
import { describe, expect, it } from 'vitest';
import {
  AIProviderError,
  ClaudeProvider,
  composeDoctorBrief,
  DemoAIProvider,
  extractNumbers,
  findProhibitedContent,
  PromptRegistry,
  runDoctorBrief,
  screenAiRequest,
  toProviderJsonSchema,
  validateDoctorBrief,
  type AIProvider,
  type AIRequest,
  type AIResponse,
} from './index.js';
import { HERO_FACT_SHEET } from './test-fixtures.js';

const prompts = new PromptRegistry();

class FakeProvider implements AIProvider {
  readonly name = 'ANTHROPIC' as const;
  constructor(private readonly behaviour: () => DoctorBriefSynthesis) {}
  isConfigured(): boolean {
    return true;
  }
  generate<T>(request: AIRequest<T>): Promise<AIResponse<T>> {
    try {
      const output = request.outputSchema.parse(this.behaviour());
      return Promise.resolve({
        output,
        provider: 'ANTHROPIC',
        model: 'fake-model',
        inputTokens: 100,
        outputTokens: 50,
        latencyMs: 1,
      });
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }
}

describe('request gate', () => {
  it.each([
    ['DIAGNOSE', null],
    ['PRESCRIBE', null],
    ['CHANGE_DOSAGE', null],
    ['STOP_MEDICATION', null],
    ['AUTONOMOUS_DECISION', null],
  ])('refuses the prohibited task %s', (task) => {
    const result = screenAiRequest(task);
    expect(result).toMatchObject({ allowed: false, code: 'PROHIBITED_TASK' });
  });

  it.each([
    'Please diagnose what is going on',
    'Should we increase the metformin dose to 1000 mg?',
    'Tell her to stop taking her tablets',
    'Change frequency to twice a day',
    'दवा बंद कर दें',
    'మందు ఆపి వేయండి',
    'खुराक बढ़ा दें',
  ])('refuses a prohibited instruction hidden in an allowed task: %s', (instruction) => {
    const result = screenAiRequest('DOCTOR_BRIEF_SYNTHESIS', instruction);
    expect(result).toMatchObject({ allowed: false, code: 'PROHIBITED_INSTRUCTION' });
  });

  it('allows the doctor brief with a neutral focus and explains planned and unknown tasks', () => {
    expect(
      screenAiRequest('DOCTOR_BRIEF_SYNTHESIS', 'Focus on glucose control trends').allowed,
    ).toBe(true);
    expect(screenAiRequest('TIMELINE_SUMMARY')).toMatchObject({ code: 'TASK_NOT_AVAILABLE' });
    expect(screenAiRequest('WRITE_POEM')).toMatchObject({ code: 'UNKNOWN_TASK' });
  });
});

describe('output safety validation', () => {
  it('extracts numbers with thousands separators', () => {
    expect(extractNumbers('rose from 5,200 to 7,100 and 6.8%')).toEqual([5200, 7100, 6.8]);
  });

  it.each([
    ['You should increase the Metformin dose.', 'TREATMENT_ACTION'],
    ['Consider stopping metformin.', 'TREATMENT_ACTION'],
    ['HbA1c fell because of Metformin.', 'CAUSAL_WORDING'],
    ['The pattern is consistent with diabetic nephropathy.', 'DIAGNOSTIC_STATEMENT'],
    ['There is definitely nothing to worry about.', 'EMERGENCY_CERTAINTY'],
  ])('flags "%s" as %s', (text, rule) => {
    expect(findProhibitedContent(text)).toContain(rule);
  });

  it('blocks a brief that tells the clinician to change a dose', () => {
    const report = validateDoctorBrief(
      {
        summary: [
          { text: 'You should increase the Metformin dose to 1000 mg.', factIds: ['f-02'] },
        ],
        observations: [],
        insufficientData: false,
      },
      HERO_FACT_SHEET,
    );
    expect(report.blocking).toBe(true);
    expect(report.sanitized).toBeNull();
  });

  it('blocks identifiers and drops uncited or invented numbers', () => {
    const leak = validateDoctorBrief(
      {
        summary: [{ text: 'Call 9876543210 about HbA1c 6.8%.', factIds: ['f-04'] }],
        observations: [],
        insufficientData: false,
      },
      HERO_FACT_SHEET,
    );
    expect(leak.blocking).toBe(true);

    const invented = validateDoctorBrief(
      {
        summary: [
          { text: 'Latest HbA1c is 6.8%.', factIds: ['f-04'] },
          { text: 'Latest HbA1c is 6.1%.', factIds: ['f-04'] },
          { text: 'Adherence was 92%.', factIds: ['f-99'] },
        ],
        observations: [],
        insufficientData: false,
      },
      HERO_FACT_SHEET,
    );
    expect(invented.blocking).toBe(false);
    expect(invented.droppedItems).toBe(2);
    expect(invented.sanitized?.summary).toHaveLength(1);
  });
});

describe('demo provider and composer', () => {
  it('composes the hero brief from facts only', () => {
    const brief = composeDoctorBrief(HERO_FACT_SHEET);
    expect(brief.summary.map((claim) => claim.text)).toEqual([
      'Latest HbA1c is 6.8%, down from 7.4% at the previous test.',
      'Recorded adherence since the last visit is 92% (166 of 180 doses).',
      'Over the same period, average daily steps rose from 5,200 to 7,100 and weight went from 74.2 kg to 72.9 kg.',
    ]);
    expect(brief.observations.map((item) => item.type)).toEqual([
      'DISCUSSION_POINT',
      'QUESTION_FOR_CLINICIAN',
    ]);
    const report = validateDoctorBrief(brief, HERO_FACT_SHEET);
    expect(report).toMatchObject({
      passed: true,
      blocking: false,
      droppedItems: 0,
      confidence: 'HIGH',
    });
  });

  it('says "insufficient data" instead of guessing', () => {
    const brief = composeDoctorBrief({ subjectRef: 'x', asOf: '2026-10-08', facts: [] });
    expect(brief).toEqual({ summary: [], observations: [], insufficientData: true });
  });

  it('runs end to end with the demo provider as primary', async () => {
    const demo = new DemoAIProvider();
    const run = await runDoctorBrief(
      { prompts, primary: demo, fallback: demo },
      HERO_FACT_SHEET,
      null,
    );
    expect(run.status).toBe('SUCCEEDED');
    expect(run.provider).toBe('DEMO');
    expect(run.model).toBe('demo-template-composer-v1');
    expect(run.prompt.version).toBe('v1');
    expect(run.inputHash).toMatch(/^[0-9a-f]{64}$/);
    expect(run.output?.summary).toHaveLength(3);
  });
});

describe('orchestrator fallback', () => {
  it('discards unsafe primary output and falls back to the demo provider', async () => {
    const unsafe = new FakeProvider(() => ({
      summary: [{ text: 'Consider stopping metformin now.', factIds: ['f-02'] }],
      observations: [],
      insufficientData: false,
    }));
    const run = await runDoctorBrief(
      { prompts, primary: unsafe, fallback: new DemoAIProvider() },
      HERO_FACT_SHEET,
      null,
    );
    expect(run.status).toBe('FALLBACK_USED');
    expect(run.fallbackReason).toMatch(/safety/);
    expect(run.output?.summary.some((claim) => /stop/i.test(claim.text))).toBe(false);
  });

  it('falls back when the provider is not configured, and keeps live output when valid', async () => {
    const unconfigured = new ClaudeProvider({
      apiKey: undefined,
      defaultModel: 'm',
      fastModel: 'm',
    });
    expect(unconfigured.isConfigured()).toBe(false);
    const run = await runDoctorBrief(
      { prompts, primary: unconfigured, fallback: new DemoAIProvider() },
      HERO_FACT_SHEET,
      null,
    );
    expect(run).toMatchObject({
      status: 'FALLBACK_USED',
      fallbackReason: 'Primary provider not configured',
    });

    const good = new FakeProvider(() => ({
      summary: [{ text: 'Latest HbA1c is 6.8%.', factIds: ['f-04'] }],
      observations: [],
      insufficientData: false,
    }));
    const live = await runDoctorBrief(
      { prompts, primary: good, fallback: null },
      HERO_FACT_SHEET,
      null,
    );
    expect(live).toMatchObject({ status: 'SUCCEEDED', provider: 'ANTHROPIC', model: 'fake-model' });
  });

  it('maps Claude refusals and bad JSON to provider errors', async () => {
    const fakeClient = (stop_reason: string, text: string) =>
      ({
        messages: {
          create: () =>
            Promise.resolve({
              model: 'claude-test',
              stop_reason,
              content: [{ type: 'text', text }],
              usage: { input_tokens: 1, output_tokens: 1 },
            }),
        },
      }) as unknown as ConstructorParameters<typeof ClaudeProvider>[0]['client'];
    const run = (stop: string, text: string) =>
      new ClaudeProvider({
        apiKey: undefined,
        defaultModel: 'm',
        fastModel: 'm',
        client: fakeClient(stop, text),
      }).generate({
        task: 'DOCTOR_BRIEF_SYNTHESIS',
        prompt: prompts.render('DOCTOR_BRIEF_SYNTHESIS', {
          fact_sheet: '[]',
          as_of: 'x',
          clinician_focus: '',
        }),
        factSheet: HERO_FACT_SHEET,
        instruction: null,
        outputSchema: DoctorBriefSynthesisSchema,
        inputHash: 'x',
      });
    await expect(run('refusal', '')).rejects.toMatchObject({ kind: 'REFUSAL' });
    await expect(run('end_turn', 'not json')).rejects.toBeInstanceOf(AIProviderError);
    await expect(
      run('end_turn', JSON.stringify({ summary: [], observations: [], insufficientData: true })),
    ).resolves.toMatchObject({ provider: 'ANTHROPIC', model: 'claude-test' });
  });
});

describe('prompt registry and JSON schema', () => {
  it('loads the active prompt with a stable hash and refuses unknown slots', () => {
    const rendered = prompts.render('DOCTOR_BRIEF_SYNTHESIS', {
      fact_sheet: '[]',
      as_of: '2026-10-08',
      clinician_focus: '(none)',
    });
    expect(rendered.system).toMatch(/must not/);
    expect(rendered.user).toContain('<fact_sheet as_of="2026-10-08">');
    expect(rendered.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(() => prompts.render('DOCTOR_BRIEF_SYNTHESIS', {})).toThrow(/needs a value/);
  });

  it('produces a closed JSON schema without unsupported keywords', () => {
    const schema = JSON.stringify(toProviderJsonSchema(DoctorBriefSynthesisSchema));
    expect(schema).toContain('"additionalProperties":false');
    expect(schema).not.toMatch(/maxItems|maxLength|pattern|\$schema/);
  });
});

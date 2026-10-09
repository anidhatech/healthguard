/**
 * Template-driven medication instructions (AI agents §6). The sentence that
 * carries the dose is assembled from the signed plan's structured fields and
 * reviewed phrases. No model ever writes it, so a translation can never
 * change the clinical meaning.
 *
 * Rules: digits for every quantity in every language; drug names stay in
 * Latin script as printed on the strip.
 */
export type InstructionLocale = 'en-IN' | 'hi-IN' | 'te-IN';

export const INSTRUCTION_TEMPLATE_KEY = 'oral-solid@1';

export interface InstructionPlanFields {
  drugName: string;
  /** e.g. "500 mg" */
  strength: string;
  doseQuantity: number;
  doseUnit: string;
  frequency: number;
  period: number;
  periodUnit: 'DAY' | 'WEEK' | 'MONTH';
  timingEvents: readonly string[];
  timingOffsetMinutes: number | null;
  durationDays: number | null;
}

type PhraseTable = Record<InstructionLocale, string>;

/** Reviewed timing phrases keyed by FHIR EventTiming; `{offset}` is a slot. */
const TIMING_PHRASES: Record<string, { withOffset?: PhraseTable; plain: PhraseTable }> = {
  PCM: {
    withOffset: {
      'en-IN': '{offset} minutes after breakfast',
      'hi-IN': 'नाश्ता करने के {offset} मिनट बाद',
      'te-IN': 'ఉదయం టిఫిన్ చేసిన {offset} నిమిషాల తర్వాత',
    },
    plain: {
      'en-IN': 'after breakfast',
      'hi-IN': 'नाश्ता करने के बाद',
      'te-IN': 'ఉదయం టిఫిన్ చేసిన తర్వాత',
    },
  },
  ACM: {
    withOffset: {
      'en-IN': '{offset} minutes before breakfast',
      'hi-IN': 'नाश्ता करने से {offset} मिनट पहले',
      'te-IN': 'ఉదయం టిఫిన్ చేయడానికి {offset} నిమిషాల ముందు',
    },
    plain: {
      'en-IN': 'before breakfast',
      'hi-IN': 'नाश्ता करने से पहले',
      'te-IN': 'ఉదయం టిఫిన్ చేయడానికి ముందు',
    },
  },
  MORN: {
    plain: {
      'en-IN': 'in the morning',
      'hi-IN': 'सुबह',
      'te-IN': 'ఉదయం',
    },
  },
};

const FORM_WORDS: Record<string, { singular: PhraseTable; plural: PhraseTable }> = {
  TABLET: {
    singular: { 'en-IN': 'tablet', 'hi-IN': 'टैबलेट', 'te-IN': 'టాబ్లెట్' },
    plural: { 'en-IN': 'tablets', 'hi-IN': 'टैबलेट', 'te-IN': 'టాబ్లెట్లు' },
  },
  CAPSULE: {
    singular: { 'en-IN': 'capsule', 'hi-IN': 'कैप्सूल', 'te-IN': 'క్యాప్సూల్' },
    plural: { 'en-IN': 'capsules', 'hi-IN': 'कैप्सूल', 'te-IN': 'క్యాప్సూల్స్' },
  },
};

const DAILY_FREQUENCY: Record<number, PhraseTable> = {
  1: { 'en-IN': 'Once a day', 'hi-IN': 'दिन में एक बार', 'te-IN': 'రోజుకు ఒకసారి' },
  2: { 'en-IN': 'Twice a day', 'hi-IN': 'दिन में दो बार', 'te-IN': 'రోజుకు రెండుసార్లు' },
};

export type InstructionRenderResult =
  { ok: true; text: string; templateKey: string } | { ok: false; reason: string };

function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

/** Renders the dose sentence, or explains why no reviewed template applies. */
export function renderDoseInstruction(
  plan: InstructionPlanFields,
  locale: InstructionLocale,
): InstructionRenderResult {
  const forms = FORM_WORDS[plan.doseUnit];
  if (!forms) return { ok: false, reason: `No reviewed template for dose unit ${plan.doseUnit}` };
  if (plan.period !== 1 || plan.periodUnit !== 'DAY') {
    return { ok: false, reason: 'No reviewed template for non-daily schedules' };
  }
  const frequency = DAILY_FREQUENCY[plan.frequency];
  if (!frequency) {
    return { ok: false, reason: `No reviewed template for ${plan.frequency} times a day` };
  }
  if (plan.timingEvents.length !== 1) {
    return { ok: false, reason: 'Exactly one timing event is supported by the reviewed template' };
  }
  const event = plan.timingEvents[0] ?? '';
  const timing = TIMING_PHRASES[event];
  if (!timing) return { ok: false, reason: `No reviewed phrase for timing ${event}` };
  const offset = plan.timingOffsetMinutes ?? 0;
  const phraseTable = offset > 0 ? timing.withOffset : timing.plain;
  if (!phraseTable) return { ok: false, reason: `Timing ${event} does not take an offset` };

  const timingPhrase = phraseTable[locale].replace('{offset}', String(offset));
  const quantity = formatQuantity(plan.doseQuantity);
  const form = (plan.doseQuantity === 1 ? forms.singular : forms.plural)[locale];
  const frequencyPhrase = frequency[locale];
  const days = plan.durationDays;

  let text: string;
  switch (locale) {
    case 'en-IN':
      text =
        `Take ${quantity} ${form} of ${plan.drugName} ${plan.strength}, ${timingPhrase}. ` +
        (days ? `${frequencyPhrase}, for ${days} days.` : `${frequencyPhrase}.`);
      break;
    case 'hi-IN':
      text =
        `${timingPhrase} ${plan.drugName} ${plan.strength} की ${quantity} ${form} लें। ` +
        (days ? `${frequencyPhrase}, ${days} दिनों तक।` : `${frequencyPhrase}।`);
      break;
    case 'te-IN':
      text =
        `${timingPhrase} ${plan.drugName} ${plan.strength} ${quantity} ${form} తీసుకోండి. ` +
        (days ? `${frequencyPhrase}, ${days} రోజుల పాటు.` : `${frequencyPhrase}.`);
      break;
  }
  return { ok: true, text, templateKey: INSTRUCTION_TEMPLATE_KEY };
}

/**
 * Preservation check: the rendered text must contain the drug name, strength,
 * quantity and duration, and no other digits than those the plan allows.
 */
export function checkInstructionPreservation(
  text: string,
  plan: InstructionPlanFields,
): { passed: boolean; problems: string[] } {
  const problems: string[] = [];
  if (!text.includes(plan.drugName)) problems.push('drug name missing');
  if (!text.includes(plan.strength)) problems.push('strength missing');
  const allowed = new Set<string>([
    ...(plan.strength.match(/\d+(?:\.\d+)?/g) ?? []),
    formatQuantity(plan.doseQuantity),
    ...(plan.timingOffsetMinutes ? [String(plan.timingOffsetMinutes)] : []),
    ...(plan.durationDays ? [String(plan.durationDays)] : []),
  ]);
  const found: string[] = text.match(/(?<![\p{L}\d.])\d+(?:\.\d+)?(?![\p{L}\d])/gu) ?? [];
  for (const value of found) {
    if (!allowed.has(value)) problems.push(`unexpected number ${value}`);
  }
  if (!found.includes(formatQuantity(plan.doseQuantity))) problems.push('quantity missing');
  if (plan.durationDays && !found.includes(String(plan.durationDays))) {
    problems.push('duration missing');
  }
  return { passed: problems.length === 0, problems };
}

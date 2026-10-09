import type { ProhibitedAiTask } from '@healthguard/shared';

/**
 * Request screening: free-text instructions that ask the AI to do something
 * it must never do. English, Hindi and Telugu. Deliberately broad: a false
 * refusal costs a clinician one click; a false accept could harm a patient.
 */
export interface RequestRule {
  intent: ProhibitedAiTask;
  pattern: RegExp;
}

export const REQUEST_RULES: readonly RequestRule[] = [
  // English
  {
    intent: 'DIAGNOSE',
    pattern: /\b(diagnos\w*|what (disease|condition) (does|do) (she|he|they|the patient) have)\b/i,
  },
  {
    intent: 'PRESCRIBE',
    pattern:
      /\b(prescrib\w*|write (a |an )?(prescription|rx)|which (drug|medicine|medication) should)\b/i,
  },
  {
    intent: 'CHANGE_DOSAGE',
    pattern:
      /\b(increase|decrease|reduce|raise|lower|double|halve|adjust|titrate|change)\b[^.?!]{0,40}\b(dose|dosage|mg|mcg|units?|tablets?)\b/i,
  },
  {
    intent: 'CHANGE_FREQUENCY',
    pattern:
      /\b(change|switch|increase|reduce)\b[^.?!]{0,40}\b(frequency|twice|once|times a day|how often)\b/i,
  },
  {
    intent: 'STOP_MEDICATION',
    pattern:
      /\b(stop|discontinue|quit|halt|skip|hold|cease)\b[^.?!]{0,40}\b(medicat\w*|medicine|drug|tablets?|treatment|metformin|telmisartan|insulin|pills?)\b/i,
  },
  {
    intent: 'APPROVE_TREATMENT',
    pattern: /\b(approve|sign|authori[sz]e)\b[^.?!]{0,30}\b(plan|treatment|prescription|order)\b/i,
  },
  {
    intent: 'BOOK_APPOINTMENT',
    pattern: /\b(book|schedule|confirm)\b[^.?!]{0,30}\b(appointment|visit|slot)\b/i,
  },
  {
    intent: 'AUTONOMOUS_DECISION',
    pattern: /\b(decide|make the (call|decision)|choose the treatment|what should (i|we) do)\b/i,
  },
  // Hindi
  { intent: 'DIAGNOSE', pattern: /(निदान|कौन सी बीमारी)/u },
  { intent: 'PRESCRIBE', pattern: /(दवा लिख|प्रिस्क्रिप्शन)/u },
  { intent: 'CHANGE_DOSAGE', pattern: /(खुराक|डोज़|डोज)[^।?!]{0,30}(बढ़ा|घटा|कम|बदल)/u },
  { intent: 'STOP_MEDICATION', pattern: /(दवा|दवाई|गोली)[^।?!]{0,30}(बंद|छोड़)/u },
  // Telugu
  { intent: 'DIAGNOSE', pattern: /(నిర్ధారణ|ఏ వ్యాధి)/u },
  { intent: 'PRESCRIBE', pattern: /(మందు రాయ|ప్రిస్క్రిప్షన్)/u },
  { intent: 'CHANGE_DOSAGE', pattern: /(మోతాదు|డోస్)[^.?!]{0,30}(పెంచ|తగ్గించ|మార్చ)/u },
  { intent: 'STOP_MEDICATION', pattern: /(మందు|మాత్ర)[^.?!]{0,30}(ఆపి|ఆపండి|మానేయ|ఆపేయ)/u },
];

/**
 * Output screening: wording a summary must never contain. A match blocks the
 * whole output (it is never "fixed up" and shown).
 */
export type OutputRuleId =
  'TREATMENT_ACTION' | 'CAUSAL_WORDING' | 'DIAGNOSTIC_STATEMENT' | 'EMERGENCY_CERTAINTY';

export interface OutputRule {
  id: OutputRuleId;
  description: string;
  pattern: RegExp;
}

export const OUTPUT_RULES: readonly OutputRule[] = [
  {
    id: 'TREATMENT_ACTION',
    description: 'Tells someone to start, stop or change a medicine or dose',
    pattern:
      /\b(should|must|need to|recommend(ed)?|consider|advise[ds]?|suggest(ed)?)\b[^.]{0,40}\b(start|stop|increase|decrease|reduce|double|halve|discontinue|switch|titrate|add|change)\w*\b[^.]{0,30}\b(dose|dosage|medicat\w*|medicine|drug|tablets?|mg|insulin|metformin|telmisartan|treatment)\b|\b(increase|decrease|reduce|double|halve|discontinue|stop|titrate)\b\s+(the\s+)?(dose|dosage|metformin|telmisartan|insulin|medicat\w*)/i,
  },
  {
    id: 'CAUSAL_WORDING',
    description: 'Claims one recorded change caused another',
    pattern:
      /\b(because of|caused by|due to|as a result of|thanks to|led to|resulted in|is working)\b/i,
  },
  {
    id: 'DIAGNOSTIC_STATEMENT',
    description: 'States or suggests a diagnosis',
    pattern:
      /\b(diagnos\w*|likely has|probably has|suggests? (that )?(the patient|she|he) has|consistent with|indicative of|signs? of (a |an )?\w+ (disease|disorder|condition))\b/i,
  },
  {
    id: 'EMERGENCY_CERTAINTY',
    description: 'Gives false reassurance or certainty',
    pattern:
      /\b(definitely|certainly|guaranteed|no need to (see|consult|worry)|nothing to worry|is (safe|fine) to ignore)\b/i,
  },
];

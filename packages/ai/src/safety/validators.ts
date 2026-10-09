import type {
  BriefClaim,
  BriefObservation,
  Confidence,
  DoctorBriefSynthesis,
  ValidationCheck,
} from '@healthguard/shared';
import type { FactSheet, ValidationReport } from '../types.js';
import { OUTPUT_RULES, type OutputRuleId } from './lexicons.js';

/** Numbers in a text, with thousands separators removed: "5,200 steps" → [5200]. */
export function extractNumbers(text: string): number[] {
  const matches = text.match(/-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?/g) ?? [];
  return matches.map((value) => Number(value.replaceAll(',', '')));
}

export function findProhibitedContent(text: string): OutputRuleId[] {
  return OUTPUT_RULES.filter((rule) => rule.pattern.test(text)).map((rule) => rule.id);
}

/** Identifiers that must never appear in AI output (the fact sheet has none). */
const PRIVACY_PATTERNS: readonly { name: string; pattern: RegExp }[] = [
  { name: 'email address', pattern: /[\w.+-]+@[\w-]+\.[\w.-]+/ },
  { name: 'phone number', pattern: /(?:\+91[\s-]?)?\b[6-9]\d{9}\b/ },
  { name: 'medical record number', pattern: /\b[A-Z]{2,5}-\d{5,}\b/ },
  { name: 'ABHA number', pattern: /\b\d{2}-\d{4}-\d{4}-\d{4}\b/ },
];

export function findPrivacyLeak(text: string): string | null {
  return PRIVACY_PATTERNS.find((entry) => entry.pattern.test(text))?.name ?? null;
}

/** Markup or prompt artefacts that do not belong in a clinician-facing sentence. */
export function findFormatProblem(text: string): string | null {
  if (/<\/?[a-z_]+>/i.test(text)) return 'contains markup';
  if (/```/.test(text)) return 'contains a code block';
  if (/\b(as an ai|language model|i cannot)\b/i.test(text)) return 'contains assistant chatter';
  return null;
}

export interface CitationCheck {
  ok: boolean;
  problem?: string;
}

/**
 * A claim must cite at least one known fact, and every number in it must
 * appear in one of the facts it cites.
 */
export function checkCitation(
  text: string,
  factIds: readonly string[],
  factSheet: FactSheet,
): CitationCheck {
  if (factIds.length === 0) return { ok: false, problem: 'no citation' };
  const cited = factSheet.facts.filter((fact) => factIds.includes(fact.id));
  if (cited.length !== new Set(factIds).size)
    return { ok: false, problem: 'cites an unknown fact' };
  const supported = new Set<number>();
  for (const fact of cited) {
    for (const value of extractNumbers(fact.text)) supported.add(value);
    for (const value of Object.values(fact.values)) {
      if (typeof value === 'number') supported.add(value);
      if (typeof value === 'string') for (const n of extractNumbers(value)) supported.add(n);
    }
  }
  for (const value of extractNumbers(text)) {
    if (!supported.has(value))
      return { ok: false, problem: `number ${value} is not in the cited facts` };
  }
  return { ok: true };
}

/**
 * Validates a doctor brief against its fact sheet. Unsafe wording or a
 * privacy leak blocks the whole output; an uncited or unsupported claim is
 * dropped and counted. Confidence reflects how much survived.
 */
export function validateDoctorBrief(
  output: DoctorBriefSynthesis,
  factSheet: FactSheet,
): ValidationReport<DoctorBriefSynthesis> {
  const checks: ValidationCheck[] = [];
  const allTexts = [
    ...output.summary.map((claim) => claim.text),
    ...output.observations.flatMap((item) => [item.text, item.rationale]),
  ];

  const prohibited = [...new Set(allTexts.flatMap((text) => findProhibitedContent(text)))];
  checks.push({
    name: 'no-treatment-or-diagnosis-wording',
    passed: prohibited.length === 0,
    ...(prohibited.length ? { detail: prohibited.join(', ') } : {}),
  });

  const leak = allTexts.map((text) => findPrivacyLeak(text)).find((value) => value !== null);
  checks.push({
    name: 'no-identifiers',
    passed: !leak,
    ...(leak ? { detail: `contains a ${leak}` } : {}),
  });

  const formatProblem = allTexts.map((text) => findFormatProblem(text)).find(Boolean);
  checks.push({
    name: 'plain-sentences',
    passed: !formatProblem,
    ...(formatProblem ? { detail: formatProblem } : {}),
  });

  const blocking = prohibited.length > 0 || Boolean(leak);
  if (blocking) {
    return {
      passed: false,
      blocking: true,
      checks,
      sanitized: null,
      confidence: null,
      droppedItems: 0,
    };
  }

  const problems: string[] = [];
  const summary: BriefClaim[] = output.summary.filter((claim) => {
    const result = checkCitation(claim.text, claim.factIds, factSheet);
    if (!result.ok) problems.push(`summary: ${result.problem ?? 'invalid'}`);
    return result.ok;
  });
  const observations: BriefObservation[] = output.observations.filter((item) => {
    const result = checkCitation(`${item.text} ${item.rationale}`, item.factIds, factSheet);
    if (!result.ok) problems.push(`observation: ${result.problem ?? 'invalid'}`);
    return result.ok;
  });
  const droppedItems = problems.length;
  checks.push({
    name: 'every-claim-cited-and-supported',
    passed: droppedItems === 0,
    ...(droppedItems ? { detail: `${droppedItems} item(s) removed: ${problems.join('; ')}` } : {}),
  });

  const total = output.summary.length + output.observations.length;
  const kept = summary.length + observations.length;
  const emptyWithoutReason = kept === 0 && !output.insufficientData;
  checks.push({
    name: 'has-content-or-says-insufficient-data',
    passed: !emptyWithoutReason,
  });

  let confidence: Confidence;
  if (kept === 0 || output.insufficientData) confidence = 'LOW';
  else if (droppedItems === 0 && factSheet.facts.length >= 5) confidence = 'HIGH';
  else if (kept / Math.max(total, 1) >= 0.75) confidence = 'MEDIUM';
  else confidence = 'LOW';

  return {
    passed: !emptyWithoutReason,
    blocking: false,
    checks,
    sanitized: { summary, observations, insufficientData: output.insufficientData || kept === 0 },
    confidence,
    droppedItems,
  };
}

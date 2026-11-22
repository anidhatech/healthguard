'use client';

import {
  ABHA_DECLARATION_INTRO,
  ABHA_DECLARATIONS,
  ABHA_TERMS_AND_CONDITIONS,
  abhaBeneficiaryConfirmation,
  abhaWorkerConfirmation,
  type AbhaConsent,
  type AbhaDeclarationKey,
} from '@healthguard/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';

/** The consent to send once every box is in: the "other document" declaration stays unchecked. */
export const ABHA_CONSENT_GIVEN: AbhaConsent = {
  termsAgreed: true,
  aadhaarSharing: true,
  otherDocument: false,
  recordsLinking: true,
  recordsSharing: true,
  anonymizedUse: true,
  workerConfirmed: true,
  beneficiaryConfirmed: true,
};

/**
 * ABDM's consent screen, word for word and in English: the terms with one
 * "I agree", five declarations each with its own checkbox, and the two
 * confirmations with the signed-in user's and the patient's names filled in.
 */
export function AbhaConsentForm({
  workerName,
  beneficiaryName,
  onChange,
}: {
  workerName: string;
  beneficiaryName: string;
  onChange: (complete: boolean) => void;
}) {
  const t = useTranslations('abha');
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [declared, setDeclared] = useState<Record<AbhaDeclarationKey, boolean>>({
    aadhaarSharing: false,
    otherDocument: false,
    recordsLinking: false,
    recordsSharing: false,
    anonymizedUse: false,
  });
  const [workerConfirmed, setWorkerConfirmed] = useState(false);
  const [beneficiaryConfirmed, setBeneficiaryConfirmed] = useState(false);

  function report(next: {
    terms?: boolean;
    declared?: Record<AbhaDeclarationKey, boolean>;
    worker?: boolean;
    beneficiary?: boolean;
  }) {
    const all = next.declared ?? declared;
    onChange(
      (next.terms ?? termsAgreed) &&
        all.aadhaarSharing &&
        !all.otherDocument &&
        all.recordsLinking &&
        all.recordsSharing &&
        all.anonymizedUse &&
        (next.worker ?? workerConfirmed) &&
        (next.beneficiary ?? beneficiaryConfirmed),
    );
  }

  return (
    <div className="grid gap-4 text-sm">
      <section className="rounded-lg border border-line bg-surface p-3" lang="en">
        <h3 className="mb-1 font-semibold">Terms and Conditions</h3>
        <p>{ABHA_TERMS_AND_CONDITIONS}</p>
        <label className="mt-3 flex items-start gap-2 font-medium">
          <input
            type="checkbox"
            className="mt-1"
            checked={termsAgreed}
            onChange={(event) => {
              setTermsAgreed(event.target.checked);
              report({ terms: event.target.checked });
            }}
          />
          I agree
        </label>
      </section>
      <fieldset className="grid gap-3" lang="en">
        <legend className="mb-1 font-semibold">{ABHA_DECLARATION_INTRO}</legend>
        {ABHA_DECLARATIONS.map((item) => (
          <label key={item.key} className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={declared[item.key]}
              onChange={(event) => {
                const next = { ...declared, [item.key]: event.target.checked };
                setDeclared(next);
                report({ declared: next });
              }}
            />
            <span>{item.text}</span>
          </label>
        ))}
        {declared.otherDocument ? <Alert tone="warn">{t('otherDocument')}</Alert> : null}
        <label className="ml-6 flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-1"
            checked={workerConfirmed}
            onChange={(event) => {
              setWorkerConfirmed(event.target.checked);
              report({ worker: event.target.checked });
            }}
          />
          <span>{abhaWorkerConfirmation(workerName)}</span>
        </label>
        <label className="ml-6 flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-1"
            checked={beneficiaryConfirmed}
            onChange={(event) => {
              setBeneficiaryConfirmed(event.target.checked);
              report({ beneficiary: event.target.checked });
            }}
          />
          <span>{abhaBeneficiaryConfirmation(beneficiaryName)}</span>
        </label>
      </fieldset>
    </div>
  );
}

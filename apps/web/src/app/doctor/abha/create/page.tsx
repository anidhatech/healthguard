'use client';

import {
  ABHA_TEXT,
  abhaAddressRules,
  maskAadhaar,
  type AbhaAddressResult,
  type AbhaAddressSuggestions,
  type AbhaEnrolmentView,
  type AbhaMobileVerification,
  type AbhaOtpChallenge,
  type AbhaProfileView,
  type PatientRegistrationResult,
} from '@healthguard/shared';
import { Check, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ABHA_CONSENT_GIVEN, AbhaConsentForm } from '@/components/abha/consent';
import { OtpInput, Resend } from '@/components/abha/otp';
import { AbhaProfilePanel } from '@/components/abha/profile';
import { AbhaSaveStep, AbhaSaved } from '@/components/abha/save';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ABHA_FIELD, ABHA_JOURNEYS, problemText, takeAbhaHandoff } from '@/lib/abha';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

type Step = 'details' | 'consent' | 'otp' | 'mobile' | 'address' | 'profile' | 'save' | 'done';
const STEPS: Step[] = ['details', 'consent', 'otp', 'mobile', 'address', 'profile', 'save'];

export default function CreateAbhaPage() {
  const t = useTranslations('abha');
  const { data: session } = useSession();
  // What the Verify ABHA screen already holds, when it found no ABHA for the Aadhaar.
  const [handoff] = useState(takeAbhaHandoff);
  const [step, setStep] = useState<Step>(handoff?.aadhaar ? 'consent' : 'details');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check-in details the desk already holds. The Aadhaar number stays in this
  // page's memory only, for the OTP and its resends; it is never stored.
  const [name, setName] = useState(handoff?.name ?? '');
  const [mobile, setMobile] = useState(handoff?.mobile ?? '');
  const [aadhaar, setAadhaar] = useState(handoff?.aadhaar ?? '');
  const [aadhaarFocused, setAadhaarFocused] = useState(false);
  const [aadhaarError, setAadhaarError] = useState(false);
  const [consentComplete, setConsentComplete] = useState(false);

  const [challenge, setChallenge] = useState<AbhaOtpChallenge | null>(null);
  const [otp, setOtp] = useState('');
  const [resendLimit, setResendLimit] = useState(false);
  const [enrolment, setEnrolment] = useState<AbhaEnrolmentView | null>(null);

  const [mobileChallenge, setMobileChallenge] = useState<AbhaOtpChallenge | null>(null);
  const [mobileOtp, setMobileOtp] = useState('');
  const [mobileResendLimit, setMobileResendLimit] = useState(false);

  const [suggestions, setSuggestions] = useState<AbhaAddressSuggestions | null>(null);
  const [chosen, setChosen] = useState('');
  const [custom, setCustom] = useState('');
  const [addressExists, setAddressExists] = useState(false);

  const [profile, setProfile] = useState<AbhaProfileView | null>(null);
  const [saved, setSaved] = useState<PatientRegistrationResult | null>(null);

  const journeyId = challenge?.journeyId ?? null;
  const mayUse =
    session?.roles.some((role) => ['FRONT_DESK', 'NURSE', 'CARE_COORDINATOR'].includes(role)) ??
    false;
  const isDemo = session?.activeOrganization?.isDemo ?? false;

  /** Runs one call, showing ABDM's or the API's own words when it is refused. */
  async function run<T>(call: () => Promise<T>): Promise<T | null> {
    setBusy(true);
    setError(null);
    try {
      return await call();
    } catch (caught) {
      setError(problemText(caught));
      return null;
    } finally {
      setBusy(false);
    }
  }

  function go(next: Step) {
    setError(null);
    setStep(next);
  }

  function submitDetails() {
    if (!/^[0-9]{12}$/.test(aadhaar)) {
      setAadhaarError(true);
      return;
    }
    setAadhaarError(false);
    go('consent');
  }

  async function sendOtp() {
    const sent = await run(() =>
      api<AbhaOtpChallenge>(ABHA_JOURNEYS, {
        method: 'POST',
        json: { aadhaarNumber: aadhaar, beneficiaryName: name.trim(), consent: ABHA_CONSENT_GIVEN },
      }),
    );
    if (sent) {
      setChallenge(sent);
      setOtp('');
      go('otp');
    }
  }

  async function resendOtp() {
    if (!challenge) return;
    if (challenge.resendsLeft <= 0) {
      setResendLimit(true);
      return;
    }
    const sent = await run(() =>
      api<AbhaOtpChallenge>(`${ABHA_JOURNEYS}/${challenge.journeyId}/resend`, {
        method: 'POST',
        json: { aadhaarNumber: aadhaar },
      }),
    );
    if (sent) setChallenge(sent);
  }

  async function verifyOtp() {
    if (!journeyId) return;
    const result = await run(() =>
      api<AbhaEnrolmentView>(`${ABHA_JOURNEYS}/${journeyId}/verify`, {
        method: 'POST',
        json: { otp, mobile },
      }),
    );
    if (!result) {
      // The same transaction takes the next attempt: only the OTP is re-entered.
      setOtp('');
      return;
    }
    setEnrolment(result);
    setProfile(result.profile);
    setAadhaar('');
    if (result.mobileVerificationRequired) {
      go('mobile');
    } else {
      await openAddress(result.journeyId);
    }
  }

  async function sendMobileOtp() {
    if (!journeyId) return;
    if (mobileChallenge && mobileChallenge.resendsLeft <= 0) {
      setMobileResendLimit(true);
      return;
    }
    const sent = await run(() =>
      api<AbhaOtpChallenge>(`${ABHA_JOURNEYS}/${journeyId}/mobile-otp`, { method: 'POST' }),
    );
    if (sent) setMobileChallenge(sent);
  }

  async function verifyMobileOtp() {
    if (!journeyId) return;
    const result = await run(() =>
      api<AbhaMobileVerification>(`${ABHA_JOURNEYS}/${journeyId}/mobile-otp/verify`, {
        method: 'POST',
        json: { otp: mobileOtp },
      }),
    );
    if (!result) return;
    if (!result.verified) {
      setError(result.message ?? t('otpWrong'));
      setMobileOtp('');
      return;
    }
    await openAddress(journeyId);
  }

  async function openAddress(id: string) {
    go('address');
    setAddressExists(false);
    const found = await run(() =>
      api<AbhaAddressSuggestions>(`${ABHA_JOURNEYS}/${id}/address-suggestions`),
    );
    if (found) setSuggestions(found);
  }

  async function createAddress(handle: string) {
    if (!journeyId) return;
    setAddressExists(false);
    setBusy(true);
    setError(null);
    try {
      await api<AbhaAddressResult>(`${ABHA_JOURNEYS}/${journeyId}/address`, {
        method: 'POST',
        json: { abhaAddress: handle },
      });
      await openProfile();
    } catch (caught) {
      const text = problemText(caught);
      if (/already exist/i.test(text)) setAddressExists(true);
      else setError(text);
    } finally {
      setBusy(false);
    }
  }

  async function openProfile() {
    if (!journeyId) return;
    go('profile');
    const fresh = await run(() => api<AbhaProfileView>(`${ABHA_JOURNEYS}/${journeyId}/profile`));
    if (fresh) setProfile(fresh);
  }

  if (isDemo || !mayUse) {
    return (
      <div className="grid max-w-2xl gap-5">
        <PageHeader title={t('title')} subtitle={session?.activeOrganization?.name} />
        <Alert tone="warn" title={isDemo ? t('demoTitle') : t('notAllowedTitle')}>
          {isDemo ? t('demoBody') : t('notAllowedBody')}
        </Alert>
      </div>
    );
  }

  const suffix = suggestions?.suffix ?? '@sbx';
  const rules = abhaAddressRules(custom, suffix);

  return (
    <div className="grid max-w-3xl gap-5">
      <PageHeader title={t('title')} subtitle={session?.activeOrganization?.name} />
      {step !== 'done' ? (
        <ol className="flex flex-wrap gap-2 text-xs" aria-label={t('progress')}>
          {STEPS.map((value, index) => (
            <li
              key={value}
              aria-current={value === step ? 'step' : undefined}
              className={`rounded-full px-2.5 py-1 ${value === step ? 'bg-brand-700 text-white' : STEPS.indexOf(step) > index ? 'bg-brand-50 text-brand-700' : 'bg-surface text-muted'}`}
            >
              {index + 1}. {t(`steps.${value}`)}
            </li>
          ))}
        </ol>
      ) : null}

      {step === 'details' ? (
        <Card>
          <CardHeader title={t('detailsTitle')} subtitle={t('method')} />
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              submitDetails();
            }}
          >
            <div className="grid items-start gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="font-medium">{t('patientName')}</span>
                <input
                  required
                  maxLength={200}
                  autoComplete="off"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className={ABHA_FIELD}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">{t('mobile')}</span>
                <input
                  required
                  inputMode="numeric"
                  autoComplete="off"
                  pattern="[0-9]{10}"
                  maxLength={10}
                  value={mobile}
                  onChange={(event) =>
                    setMobile(event.target.value.replace(/\D+/g, '').slice(0, 10))
                  }
                  className={ABHA_FIELD}
                />
                <span className="text-xs text-muted">{t('mobileHint')}</span>
              </label>
              <label className="grid gap-1 text-sm sm:col-span-2">
                <span className="font-medium">{t('aadhaar')}</span>
                <input
                  // Typed as digits, shown masked once the field is left.
                  inputMode="numeric"
                  autoComplete="off"
                  aria-invalid={aadhaarError}
                  aria-describedby="aadhaar-error"
                  value={aadhaarFocused || aadhaar.length !== 12 ? aadhaar : maskAadhaar(aadhaar)}
                  onFocus={() => setAadhaarFocused(true)}
                  onBlur={() => setAadhaarFocused(false)}
                  onChange={(event) => {
                    setAadhaar(event.target.value.trim());
                    setAadhaarError(false);
                  }}
                  className={`${ABHA_FIELD} max-w-xs font-mono`}
                />
                {aadhaarError ? (
                  <span id="aadhaar-error" role="alert" className="text-sm text-danger">
                    {ABHA_TEXT.aadhaarInvalid}
                  </span>
                ) : (
                  <span id="aadhaar-error" className="text-xs text-muted">
                    {t('aadhaarHint')}
                  </span>
                )}
              </label>
            </div>
            <div>
              <Button type="submit">{t('continue')}</Button>
            </div>
          </form>
        </Card>
      ) : null}

      {step === 'consent' ? (
        <Card>
          <CardHeader title={t('consentTitle')} subtitle={t('consentSubtitle')} />
          <div className="grid gap-4 text-sm">
            {handoff ? <Alert tone="info">{t('handoffNote')}</Alert> : null}
            <AbhaConsentForm
              workerName={session?.user.displayName ?? ''}
              beneficiaryName={name.trim()}
              onChange={setConsentComplete}
            />
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={!consentComplete || busy}
                onClick={() => void sendOtp()}
              >
                {t('sendOtp')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => go('details')}
              >
                {t('back')}
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {step === 'otp' && challenge ? (
        <Card>
          <CardHeader title={t('otpTitle')} />
          <form
            className="grid gap-4 text-sm"
            onSubmit={(event) => {
              event.preventDefault();
              void verifyOtp();
            }}
          >
            {challenge.message ? <Alert tone="info">{challenge.message}</Alert> : null}
            <label className="grid gap-1" htmlFor="aadhaar-otp">
              <span className="font-medium">{t('otpLabel')}</span>
              <OtpInput id="aadhaar-otp" value={otp} onChange={setOtp} />
            </label>
            <label className="grid gap-1">
              <span className="font-medium">{t('communicationMobile')}</span>
              <input
                required
                inputMode="numeric"
                pattern="[0-9]{10}"
                maxLength={10}
                value={mobile}
                onChange={(event) => setMobile(event.target.value.replace(/\D+/g, '').slice(0, 10))}
                className={`${ABHA_FIELD} w-48`}
              />
              <span className="text-xs text-muted">{t('communicationMobileHint')}</span>
            </label>
            {error ? (
              <Alert tone="danger" title={t('abdmSaid')}>
                {error}
              </Alert>
            ) : null}
            <div>
              <Button type="submit" disabled={busy || otp.length !== 6 || mobile.length !== 10}>
                {t('verify')}
              </Button>
            </div>
            <Resend
              challenge={challenge}
              busy={busy}
              onResend={() => void resendOtp()}
              limitReached={resendLimit}
            />
          </form>
        </Card>
      ) : null}

      {step === 'mobile' ? (
        <Card>
          <CardHeader title={t('mobileTitle')} subtitle={t('mobileSubtitle')} />
          <div className="grid gap-4 text-sm">
            {mobileChallenge ? (
              <form
                className="grid gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void verifyMobileOtp();
                }}
              >
                {mobileChallenge.message ? (
                  <Alert tone="info">{mobileChallenge.message}</Alert>
                ) : null}
                <label className="grid gap-1" htmlFor="mobile-otp">
                  <span className="font-medium">{t('otpLabel')}</span>
                  <OtpInput id="mobile-otp" value={mobileOtp} onChange={setMobileOtp} />
                </label>
                {error ? (
                  <Alert tone="danger" title={t('abdmSaid')}>
                    {error}
                  </Alert>
                ) : null}
                <div>
                  <Button type="submit" disabled={busy || mobileOtp.length !== 6}>
                    {t('verify')}
                  </Button>
                </div>
                <Resend
                  challenge={mobileChallenge}
                  busy={busy}
                  onResend={() => void sendMobileOtp()}
                  limitReached={mobileResendLimit}
                />
              </form>
            ) : (
              <>
                {error ? <Alert tone="danger">{error}</Alert> : null}
                <div>
                  <Button type="button" disabled={busy} onClick={() => void sendMobileOtp()}>
                    {t('sendMobileOtp')}
                  </Button>
                </div>
              </>
            )}
          </div>
        </Card>
      ) : null}

      {step === 'address' ? (
        <Card>
          <CardHeader title={t('addressTitle')} />
          <div className="grid gap-4 text-sm">
            {enrolment && !enrolment.isNew && enrolment.message ? (
              <Alert tone="info">{enrolment.message}</Alert>
            ) : null}
            {profile?.abhaAddresses.length ? (
              <p>
                {t('currentAddresses')}:{' '}
                <span className="font-mono">{profile.abhaAddresses.join(', ')}</span>
              </p>
            ) : null}
            <fieldset className="grid gap-2">
              <legend className="mb-1 font-medium">{t('suggested')}</legend>
              {(suggestions?.suggestions ?? []).map((value) => (
                <label
                  key={value}
                  className="flex min-h-10 items-center gap-2 rounded-lg border border-line px-3"
                >
                  <input
                    type="radio"
                    name="abha-address"
                    checked={chosen === value}
                    onChange={() => {
                      setChosen(value);
                      setCustom('');
                    }}
                  />
                  <span className="font-mono">
                    {value}
                    {value.includes('@') ? '' : suffix}
                  </span>
                </label>
              ))}
              {suggestions && suggestions.suggestions.length === 0 ? (
                <p className="text-muted">{t('noSuggestions')}</p>
              ) : null}
            </fieldset>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="grid content-start gap-1">
                <span className="font-medium">{t('ownAddress')}</span>
                <span className="flex items-center gap-1">
                  <input
                    autoComplete="off"
                    value={custom}
                    onChange={(event) => {
                      setCustom(event.target.value.trim());
                      setChosen('');
                    }}
                    className={`${ABHA_FIELD} w-full font-mono`}
                  />
                  <span className="font-mono text-muted">{suffix}</span>
                </span>
              </label>
              <ul className="grid content-start gap-1" aria-label={t('rulesTitle')}>
                {rules.map((rule) => (
                  <li
                    key={rule.key}
                    className={`flex items-start gap-1.5 ${rule.met ? 'text-ok' : 'text-danger'}`}
                  >
                    {rule.met ? (
                      <Check aria-hidden className="mt-0.5 size-4 shrink-0" />
                    ) : (
                      <X aria-hidden className="mt-0.5 size-4 shrink-0" />
                    )}
                    <span>
                      <span className="sr-only">{rule.met ? t('ruleMet') : t('ruleNotMet')}: </span>
                      {t(`rules.${rule.key}`, { suffix })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            {addressExists ? (
              <Alert tone="warn" title={ABHA_TEXT.addressExists}>
                <span className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={!profile?.abhaAddresses.length}
                    onClick={() => void openProfile()}
                  >
                    {t('useExisting')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setAddressExists(false);
                      setCustom('');
                      setChosen('');
                    }}
                  >
                    {t('createNew')}
                  </Button>
                </span>
              </Alert>
            ) : null}
            {error ? (
              <Alert tone="danger" title={t('abdmSaid')}>
                {error}
              </Alert>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busy || !(chosen || (custom && rules.every((rule) => rule.met)))}
                onClick={() => void createAddress(chosen || custom)}
              >
                {t('createAddress')}
              </Button>
              {profile?.abhaAddresses.length ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void openProfile()}
                >
                  {t('keepAddress')}
                </Button>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      {step === 'profile' && profile && journeyId ? (
        <Card>
          <CardHeader title={t('profileTitle')} />
          <div className="grid gap-4 text-sm">
            <AbhaProfilePanel journeyId={journeyId} profile={profile} />
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <div>
              <Button type="button" disabled={busy} onClick={() => go('save')}>
                {t('continueToSave')}
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {step === 'save' && journeyId ? (
        <Card>
          <CardHeader title={t('saveTitle')} subtitle={t('saveSubtitle')} />
          <AbhaSaveStep
            journeyId={journeyId}
            profile={profile}
            onSaved={(result) => {
              setSaved(result);
              go('done');
            }}
          />
        </Card>
      ) : null}

      {step === 'done' && saved ? (
        <Card>
          <AbhaSaved saved={saved} />
        </Card>
      ) : null}
    </div>
  );
}

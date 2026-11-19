'use client';

import {
  ABHA_DECLARATION_INTRO,
  ABHA_DECLARATIONS,
  ABHA_OTP_RULES,
  ABHA_TERMS_AND_CONDITIONS,
  ABHA_TEXT,
  API_BASE_PATH,
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  abhaAddressRules,
  abhaBeneficiaryConfirmation,
  abhaWorkerConfirmation,
  maskAadhaar,
  type AbhaAddressResult,
  type AbhaAddressSuggestions,
  type AbhaDeclarationKey,
  type AbhaEnrolmentView,
  type AbhaMatches,
  type AbhaMobileVerification,
  type AbhaOtpChallenge,
  type AbhaProfileView,
  type PatientRegistrationResult,
  type SupportedLocale,
} from '@healthguard/shared';
import { Check, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';

type Step = 'details' | 'consent' | 'otp' | 'mobile' | 'address' | 'profile' | 'save' | 'done';
const STEPS: Step[] = ['details', 'consent', 'otp', 'mobile', 'address', 'profile', 'save'];
const FIELD = 'min-h-11 rounded-lg border border-line px-3 text-sm';
const BASE = '/abha/enrolments';

/** What ABDM or the API said, shown as it came. */
function problemText(error: unknown): string {
  if (error instanceof ApiError) {
    return error.problem.errors?.[0]?.message ?? error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

/** Seconds left until `until`, ticking once a second. */
function useCountdown(until: string | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [until]);
  return until ? Math.max(Math.ceil((Date.parse(until) - now) / 1000), 0) : 0;
}

function OtpInput({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  id: string;
}) {
  return (
    <input
      id={id}
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={ABHA_OTP_RULES.otpLength}
      value={value}
      onChange={(event) => onChange(event.target.value.replace(/\D+/g, '').slice(0, 6))}
      className={`${FIELD} w-40 font-mono tracking-widest`}
    />
  );
}

/** Resend with a visible counter: disabled for 60 seconds, two resends at most. */
function Resend({
  challenge,
  busy,
  onResend,
  limitReached,
}: {
  challenge: AbhaOtpChallenge;
  busy: boolean;
  onResend: () => void;
  limitReached: boolean;
}) {
  const t = useTranslations('abha');
  const seconds = useCountdown(challenge.resendAvailableAt);
  return (
    <div className="grid gap-1 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy || seconds > 0}
          onClick={onResend}
        >
          {t('resend')}
        </Button>
        <span aria-live="polite" className="text-muted">
          {seconds > 0 ? t('resendIn', { seconds }) : t('resendReady')} ·{' '}
          {t('resendsLeft', { count: challenge.resendsLeft })}
        </span>
      </div>
      {limitReached ? <p className="text-danger">{ABHA_TEXT.resendLimit}</p> : null}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="col-span-2 font-medium break-words">{children ?? '—'}</dd>
    </div>
  );
}

export default function CreateAbhaPage() {
  const t = useTranslations('abha');
  const { data: session } = useSession();
  const [step, setStep] = useState<Step>('details');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check-in details the desk already holds. The Aadhaar number stays in this
  // page's memory only, for the OTP and its resends; it is never stored.
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [aadhaarFocused, setAadhaarFocused] = useState(false);
  const [aadhaarError, setAadhaarError] = useState(false);

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
  const [matches, setMatches] = useState<AbhaMatches | null>(null);
  const [mrn, setMrn] = useState('');
  const [locale, setLocale] = useState<SupportedLocale>('en-IN');
  const [saved, setSaved] = useState<PatientRegistrationResult | null>(null);

  const journeyId = challenge?.journeyId ?? null;
  const workerName = session?.user.displayName ?? '';
  const mayUse =
    session?.roles.some((role) => ['FRONT_DESK', 'NURSE', 'CARE_COORDINATOR'].includes(role)) ??
    false;
  const isDemo = session?.activeOrganization?.isDemo ?? false;
  const consentComplete =
    termsAgreed &&
    declared.aadhaarSharing &&
    !declared.otherDocument &&
    declared.recordsLinking &&
    declared.recordsSharing &&
    declared.anonymizedUse &&
    workerConfirmed &&
    beneficiaryConfirmed;

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
      api<AbhaOtpChallenge>(BASE, {
        method: 'POST',
        json: {
          aadhaarNumber: aadhaar,
          beneficiaryName: name.trim(),
          consent: {
            termsAgreed: true,
            aadhaarSharing: true,
            otherDocument: false,
            recordsLinking: true,
            recordsSharing: true,
            anonymizedUse: true,
            workerConfirmed: true,
            beneficiaryConfirmed: true,
          },
        },
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
      api<AbhaOtpChallenge>(`${BASE}/${challenge.journeyId}/resend`, {
        method: 'POST',
        json: { aadhaarNumber: aadhaar },
      }),
    );
    if (sent) setChallenge(sent);
  }

  async function verifyOtp() {
    if (!journeyId) return;
    const result = await run(() =>
      api<AbhaEnrolmentView>(`${BASE}/${journeyId}/verify`, {
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
      api<AbhaOtpChallenge>(`${BASE}/${journeyId}/mobile-otp`, { method: 'POST' }),
    );
    if (sent) setMobileChallenge(sent);
  }

  async function verifyMobileOtp() {
    if (!journeyId) return;
    const result = await run(() =>
      api<AbhaMobileVerification>(`${BASE}/${journeyId}/mobile-otp/verify`, {
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
    const found = await run(() => api<AbhaAddressSuggestions>(`${BASE}/${id}/address-suggestions`));
    if (found) setSuggestions(found);
  }

  async function createAddress(handle: string) {
    if (!journeyId) return;
    setAddressExists(false);
    setBusy(true);
    setError(null);
    try {
      await api<AbhaAddressResult>(`${BASE}/${journeyId}/address`, {
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
    const fresh = await run(() => api<AbhaProfileView>(`${BASE}/${journeyId}/profile`));
    if (fresh) setProfile(fresh);
  }

  async function openSave(search?: string) {
    if (!journeyId) return;
    go('save');
    const query = search ? `?mrn=${encodeURIComponent(search)}` : '';
    const found = await run(() => api<AbhaMatches>(`${BASE}/${journeyId}/matches${query}`));
    if (found) setMatches(found);
  }

  async function save(body: { action: 'LINK'; patientId: string } | { action: 'CREATE' }) {
    if (!journeyId) return;
    const result = await run(() =>
      api<PatientRegistrationResult>(`${BASE}/${journeyId}/save`, {
        method: 'POST',
        json: body.action === 'CREATE' ? { ...body, preferredLocale: locale } : body,
      }),
    );
    if (result) {
      setSaved(result);
      go('done');
    }
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
  const cardUrl = journeyId ? `${API_BASE_PATH}${BASE}/${journeyId}/card` : '';

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
                  className={FIELD}
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
                  className={FIELD}
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
                  className={`${FIELD} max-w-xs font-mono`}
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
            <section className="rounded-lg border border-line bg-surface p-3" lang="en">
              <h3 className="mb-1 font-semibold">Terms and Conditions</h3>
              <p>{ABHA_TERMS_AND_CONDITIONS}</p>
              <label className="mt-3 flex items-start gap-2 font-medium">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={termsAgreed}
                  onChange={(event) => setTermsAgreed(event.target.checked)}
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
                    onChange={(event) =>
                      setDeclared((current) => ({ ...current, [item.key]: event.target.checked }))
                    }
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
                  onChange={(event) => setWorkerConfirmed(event.target.checked)}
                />
                <span>{abhaWorkerConfirmation(workerName)}</span>
              </label>
              <label className="ml-6 flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={beneficiaryConfirmed}
                  onChange={(event) => setBeneficiaryConfirmed(event.target.checked)}
                />
                <span>{abhaBeneficiaryConfirmation(name.trim())}</span>
              </label>
            </fieldset>
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
                className={`${FIELD} w-48`}
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
                    className={`${FIELD} w-full font-mono`}
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

      {step === 'profile' && profile ? (
        <Card>
          <CardHeader title={t('profileTitle')} />
          <div className="grid gap-4 text-sm">
            <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
              {profile.photo ? (
                // eslint-disable-next-line @next/next/no-img-element -- a data URI from ABDM, not a remote image
                <img
                  src={`data:image/jpeg;base64,${profile.photo}`}
                  alt={t('photoAlt')}
                  className="h-32 w-28 rounded-lg border border-line object-cover"
                />
              ) : null}
              <dl className="divide-y divide-line">
                <Row label={t('abhaNumber')}>
                  <span className="font-mono">{profile.abhaNumber}</span>
                </Row>
                <Row label={t('abhaAddress')}>
                  <span className="font-mono">{profile.preferredAbhaAddress}</span>
                </Row>
                <Row label={t('name')}>{profile.name}</Row>
                <Row label={t('dateOfBirth')}>{profile.dateOfBirth}</Row>
                <Row label={t('gender')}>{profile.gender}</Row>
                <Row label={t('mobile')}>{profile.mobile}</Row>
                <Row label={t('address')}>
                  {[profile.address, profile.districtName, profile.stateName, profile.pinCode]
                    .filter(Boolean)
                    .join(', ')}
                </Row>
              </dl>
            </div>
            <section className="grid gap-2">
              <h3 className="font-semibold">{t('cardTitle')}</h3>
              {profile.kycVerified === false ? (
                <Alert tone="warn">{t('cardNotKyc')}</Alert>
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- the card exactly as ABDM returned it */}
                  <img
                    src={cardUrl}
                    alt={t('cardAlt')}
                    className="max-w-full rounded-lg border border-line"
                  />
                  <div>
                    <Button asChild variant="secondary">
                      <a href={`${cardUrl}?download=1`} download="abha-card.png">
                        {t('downloadCard')}
                      </a>
                    </Button>
                  </div>
                </>
              )}
            </section>
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <div>
              <Button type="button" disabled={busy} onClick={() => void openSave()}>
                {t('continueToSave')}
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {step === 'save' ? (
        <Card>
          <CardHeader title={t('saveTitle')} subtitle={t('saveSubtitle')} />
          <div className="grid gap-4 text-sm">
            {matches?.matches.length ? (
              <ul className="grid gap-2">
                {matches.matches.map((row) => (
                  <li
                    key={row.patientId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3"
                  >
                    <span>
                      <span className="font-medium">{row.displayName}</span>{' '}
                      <span className="font-mono text-xs text-muted">{row.mrn}</span>
                      <span className="block text-muted">{t(`matchReasons.${row.reason}`)}</span>
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy}
                      onClick={() => void save({ action: 'LINK', patientId: row.patientId })}
                    >
                      {row.reason === 'ABHA_NUMBER' ? t('useThisRecord') : t('linkToThisRecord')}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : matches ? (
              <p>{t('noMatch')}</p>
            ) : null}
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void openSave(mrn.trim());
              }}
            >
              <label className="grid gap-1">
                <span className="font-medium">{t('searchByRecordNumber')}</span>
                <input
                  value={mrn}
                  maxLength={50}
                  onChange={(event) => setMrn(event.target.value)}
                  className={`${FIELD} w-56 font-mono`}
                />
              </label>
              <Button type="submit" variant="secondary" disabled={busy || !mrn.trim()}>
                {t('search')}
              </Button>
            </form>
            {matches?.mayCreate ? (
              <div className="grid gap-2 rounded-lg border border-line p-3">
                <label className="grid gap-1">
                  <span className="font-medium">{t('language')}</span>
                  <select
                    value={locale}
                    onChange={(event) => setLocale(event.target.value as SupportedLocale)}
                    className={`${FIELD} w-48`}
                  >
                    {SUPPORTED_LOCALES.map((value) => (
                      <option key={value} value={value}>
                        {LOCALE_LABELS[value].native}
                      </option>
                    ))}
                  </select>
                </label>
                <div>
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={() => void save({ action: 'CREATE' })}
                  >
                    {t('createRecord')}
                  </Button>
                </div>
              </div>
            ) : matches ? (
              <p className="text-muted">{t('createNotAllowed')}</p>
            ) : null}
            {error ? <Alert tone="danger">{error}</Alert> : null}
          </div>
        </Card>
      ) : null}

      {step === 'done' && saved ? (
        <Card>
          <Alert
            tone="ok"
            title={
              saved.status === 'CREATED'
                ? t('savedCreated', { name: saved.patient.displayName })
                : t('savedLinked', { name: saved.patient.displayName })
            }
          >
            {t('recordNumber', { mrn: saved.patient.mrn })}
          </Alert>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/doctor/patient/${saved.patient.id}`}>{t('openRecord')}</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/doctor/dashboard">{t('backToClinic')}</Link>
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

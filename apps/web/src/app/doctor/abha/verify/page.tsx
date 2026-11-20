'use client';

import {
  ABHA_TEXT,
  maskAadhaar,
  type AbhaAddressMethods,
  type AbhaLoginMethod,
  type AbhaLoginView,
  type AbhaMobileVerification,
  type AbhaOtpChallenge,
  type AbhaProfileView,
  type PatientRegistrationResult,
} from '@healthguard/shared';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ABHA_CONSENT_GIVEN, AbhaConsentForm } from '@/components/abha/consent';
import { OtpInput, Resend } from '@/components/abha/otp';
import { AbhaProfilePanel } from '@/components/abha/profile';
import { AbhaSaveStep, AbhaSaved } from '@/components/abha/save';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ABHA_FIELD, ABHA_JOURNEYS, ABHA_LOGINS, problemText, setAbhaHandoff } from '@/lib/abha';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

type Identifier = 'ABHA_NUMBER' | 'ABHA_ADDRESS' | 'AADHAAR';
type Step = 'identify' | 'consent' | 'otp' | 'noAbha' | 'profile' | 'save' | 'done';
const IDENTIFIERS: Identifier[] = ['ABHA_NUMBER', 'ABHA_ADDRESS', 'AADHAAR'];
const BOTH_METHODS: AbhaLoginMethod[] = ['AADHAAR_OTP', 'MOBILE_OTP'];

/**
 * Verify an ABHA someone already holds, by ABHA number, ABHA address or
 * Aadhaar number, then fill the registration form from it. The identifier is
 * kept in this page's memory only until the OTP is verified.
 */
export default function VerifyAbhaPage() {
  const t = useTranslations('abha');
  const router = useRouter();
  const { data: session } = useSession();
  const [step, setStep] = useState<Step>('identify');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [identifier, setIdentifier] = useState<Identifier>('ABHA_NUMBER');
  const [value, setValue] = useState('');
  const [valueFocused, setValueFocused] = useState(false);
  const [aadhaarError, setAadhaarError] = useState(false);
  const [name, setName] = useState('');
  const [deskMobile, setDeskMobile] = useState('');
  const [method, setMethod] = useState<AbhaLoginMethod | null>(null);
  const [addressMethods, setAddressMethods] = useState<AbhaAddressMethods | null>(null);
  const [consentComplete, setConsentComplete] = useState(false);

  const [challenge, setChallenge] = useState<AbhaOtpChallenge | null>(null);
  const [otp, setOtp] = useState('');
  const [resendLimit, setResendLimit] = useState(false);
  const [login, setLogin] = useState<AbhaLoginView | null>(null);
  const [profile, setProfile] = useState<AbhaProfileView | null>(null);

  const [updateChoice, setUpdateChoice] = useState<'undecided' | 'yes' | 'no' | 'done'>(
    'undecided',
  );
  const [updateChallenge, setUpdateChallenge] = useState<AbhaOtpChallenge | null>(null);
  const [updateOtp, setUpdateOtp] = useState('');
  const [updateResendLimit, setUpdateResendLimit] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState<PatientRegistrationResult | null>(null);

  const journeyId = challenge?.journeyId ?? null;
  const mayUse =
    session?.roles.some((role) => ['FRONT_DESK', 'NURSE', 'CARE_COORDINATOR'].includes(role)) ??
    false;
  const isDemo = session?.activeOrganization?.isDemo ?? false;
  // An ABHA number takes both routes. An ABHA address offers only what its search listed.
  const methods =
    identifier === 'ABHA_NUMBER'
      ? BOTH_METHODS
      : identifier === 'ABHA_ADDRESS'
        ? (addressMethods?.methods ?? [])
        : [];
  const mobileOk = deskMobile === '' || /^[0-9]{10}$/.test(deskMobile);

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

  function chooseIdentifier(next: Identifier) {
    setIdentifier(next);
    setValue('');
    setMethod(null);
    setAddressMethods(null);
    setAadhaarError(false);
    setError(null);
  }

  async function findMethods() {
    const found = await run(() =>
      api<AbhaAddressMethods>(`${ABHA_LOGINS}/address-methods`, {
        method: 'POST',
        json: { abhaAddress: value.trim() },
      }),
    );
    if (found) {
      setAddressMethods(found);
      setMethod(found.methods.length === 1 ? (found.methods[0] ?? null) : null);
    }
  }

  function submitIdentify() {
    if (identifier === 'AADHAAR') {
      if (!/^[0-9]{12}$/.test(value)) {
        setAadhaarError(true);
        return;
      }
      go('consent');
      return;
    }
    void sendOtp();
  }

  async function sendOtp() {
    const desk = deskMobile ? { deskMobile } : {};
    const json =
      identifier === 'AADHAAR'
        ? {
            identifier,
            value,
            beneficiaryName: name.trim(),
            consent: ABHA_CONSENT_GIVEN,
            ...desk,
          }
        : { identifier, value: value.trim(), method, ...desk };
    const sent = await run(() => api<AbhaOtpChallenge>(ABHA_LOGINS, { method: 'POST', json }));
    if (sent) {
      setChallenge(sent);
      setOtp('');
      setResendLimit(false);
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
      api<AbhaOtpChallenge>(`${ABHA_LOGINS}/${challenge.journeyId}/resend`, {
        method: 'POST',
        json: { value: value.trim() },
      }),
    );
    if (sent) setChallenge(sent);
  }

  async function verifyOtp() {
    if (!journeyId) return;
    const result = await run(() =>
      api<AbhaLoginView>(`${ABHA_LOGINS}/${journeyId}/verify`, { method: 'POST', json: { otp } }),
    );
    if (!result) {
      // The same transaction takes the next attempt: only the OTP is re-entered.
      setOtp('');
      return;
    }
    setLogin(result);
    if (result.outcome === 'NO_ABHA') {
      go('noAbha');
      return;
    }
    // The identifier is no longer needed once the login is verified.
    setValue('');
    setProfile(result.profile);
    go('profile');
  }

  function createInstead() {
    // Creation carries on from what this screen holds: the Aadhaar is not asked for again.
    setAbhaHandoff({ name: name.trim(), mobile: deskMobile, aadhaar: value });
    setValue('');
    router.push('/doctor/abha/create');
  }

  async function sendUpdateOtp() {
    if (!journeyId) return;
    if (updateChallenge && updateChallenge.resendsLeft <= 0) {
      setUpdateResendLimit(true);
      return;
    }
    const sent = await run(() =>
      api<AbhaOtpChallenge>(`${ABHA_LOGINS}/${journeyId}/mobile-update`, {
        method: 'POST',
        json: { mobile: deskMobile },
      }),
    );
    if (sent) {
      setUpdateChallenge(sent);
      setUpdateChoice('yes');
    }
  }

  async function verifyUpdateOtp() {
    if (!journeyId) return;
    const result = await run(() =>
      api<AbhaMobileVerification>(`${ABHA_LOGINS}/${journeyId}/mobile-update/verify`, {
        method: 'POST',
        json: { otp: updateOtp },
      }),
    );
    if (!result) return;
    if (!result.verified) {
      // Never shown as done unless ABDM said so.
      setError(result.message ?? t('otpWrong'));
      setUpdateOtp('');
      return;
    }
    setUpdateMessage(result.message);
    setUpdateChoice('done');
    const fresh = await run(() => api<AbhaProfileView>(`${ABHA_JOURNEYS}/${journeyId}/profile`));
    if (fresh) setProfile(fresh);
  }

  if (isDemo || !mayUse) {
    return (
      <div className="grid max-w-2xl gap-5">
        <PageHeader title={t('verifyTitle')} subtitle={session?.activeOrganization?.name} />
        <Alert tone="warn" title={isDemo ? t('demoTitle') : t('notAllowedTitle')}>
          {isDemo ? t('demoBody') : t('notAllowedBody')}
        </Alert>
      </div>
    );
  }

  const isAadhaar = identifier === 'AADHAAR';
  const canSend =
    value.trim().length > 0 && mobileOk && (isAadhaar ? name.trim().length > 0 : method !== null);

  return (
    <div className="grid max-w-3xl gap-5">
      <PageHeader title={t('verifyTitle')} subtitle={session?.activeOrganization?.name} />

      {step === 'identify' ? (
        <Card>
          <CardHeader title={t('identifyTitle')} subtitle={t('identifySubtitle')} />
          <form
            className="grid gap-4 text-sm"
            onSubmit={(event) => {
              event.preventDefault();
              submitIdentify();
            }}
          >
            <fieldset className="grid gap-2">
              <legend className="mb-1 font-medium">{t('identifierLabel')}</legend>
              <div className="flex flex-wrap gap-2">
                {IDENTIFIERS.map((option) => (
                  <label
                    key={option}
                    className="flex min-h-10 items-center gap-2 rounded-lg border border-line px-3"
                  >
                    <input
                      type="radio"
                      name="abha-identifier"
                      checked={identifier === option}
                      onChange={() => chooseIdentifier(option)}
                    />
                    {t(`identifiers.${option}`)}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="grid gap-1">
              <span className="font-medium">{t(`identifiers.${identifier}`)}</span>
              <input
                // An Aadhaar number is shown masked once the field is left.
                autoComplete="off"
                inputMode={identifier === 'ABHA_ADDRESS' ? 'text' : 'numeric'}
                aria-invalid={aadhaarError}
                value={
                  isAadhaar && !valueFocused && value.length === 12 ? maskAadhaar(value) : value
                }
                onFocus={() => setValueFocused(true)}
                onBlur={() => setValueFocused(false)}
                onChange={(event) => {
                  setValue(event.target.value.trim());
                  setAadhaarError(false);
                  if (identifier === 'ABHA_ADDRESS') {
                    setAddressMethods(null);
                    setMethod(null);
                  }
                }}
                className={`${ABHA_FIELD} max-w-sm font-mono`}
              />
              {aadhaarError ? (
                <span role="alert" className="text-danger">
                  {ABHA_TEXT.aadhaarInvalid}
                </span>
              ) : (
                <span className="text-xs text-muted">{t(`identifierHints.${identifier}`)}</span>
              )}
            </label>

            {identifier === 'ABHA_ADDRESS' ? (
              <div className="grid gap-2">
                <div>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy || value.trim().length < 3}
                    onClick={() => void findMethods()}
                  >
                    {t('findMethods')}
                  </Button>
                </div>
                {addressMethods && addressMethods.methods.length === 0 ? (
                  <Alert tone="warn">
                    {t('noMethods')}
                    {addressMethods.offeredByAbdm.length ? (
                      <span className="mt-1 block font-mono text-xs">
                        {addressMethods.offeredByAbdm.join(', ')}
                      </span>
                    ) : null}
                  </Alert>
                ) : null}
              </div>
            ) : null}

            {methods.length > 0 ? (
              <fieldset className="grid gap-2">
                <legend className="mb-1 font-medium">{t('methodLabel')}</legend>
                {methods.map((option) => (
                  <label
                    key={option}
                    className="flex min-h-10 items-center gap-2 rounded-lg border border-line px-3"
                  >
                    <input
                      type="radio"
                      name="abha-method"
                      checked={method === option}
                      onChange={() => setMethod(option)}
                    />
                    {t(`methods.${option}`)}
                  </label>
                ))}
              </fieldset>
            ) : null}

            <div className="grid items-start gap-4 sm:grid-cols-2">
              {isAadhaar ? (
                <label className="grid gap-1">
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
              ) : null}
              <label className="grid gap-1">
                <span className="font-medium">{t('deskMobile')}</span>
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={10}
                  value={deskMobile}
                  onChange={(event) =>
                    setDeskMobile(event.target.value.replace(/\D+/g, '').slice(0, 10))
                  }
                  className={ABHA_FIELD}
                />
                <span className="text-xs text-muted">{t('deskMobileHint')}</span>
              </label>
            </div>

            {error ? (
              <Alert tone="danger" title={t('abdmSaid')}>
                {error}
              </Alert>
            ) : null}
            <div>
              <Button type="submit" disabled={busy || !canSend}>
                {isAadhaar ? t('continue') : t('sendOtp')}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {step === 'consent' ? (
        <Card>
          <CardHeader title={t('consentTitle')} subtitle={t('consentSubtitle')} />
          <div className="grid gap-4 text-sm">
            <AbhaConsentForm
              workerName={session?.user.displayName ?? ''}
              beneficiaryName={name.trim()}
              onChange={setConsentComplete}
            />
            {error ? (
              <Alert tone="danger" title={t('abdmSaid')}>
                {error}
              </Alert>
            ) : null}
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
                onClick={() => go('identify')}
              >
                {t('back')}
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {step === 'otp' && challenge ? (
        <Card>
          <CardHeader title={t('loginOtpTitle')} />
          <form
            className="grid gap-4 text-sm"
            onSubmit={(event) => {
              event.preventDefault();
              void verifyOtp();
            }}
          >
            {challenge.message ? <Alert tone="info">{challenge.message}</Alert> : null}
            <label className="grid gap-1" htmlFor="login-otp">
              <span className="font-medium">{t('otpLabel')}</span>
              <OtpInput id="login-otp" value={otp} onChange={setOtp} />
            </label>
            {error ? (
              <Alert tone="danger" title={t('abdmSaid')}>
                {error}
              </Alert>
            ) : null}
            <div>
              <Button type="submit" disabled={busy || otp.length !== 6}>
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

      {step === 'noAbha' && login ? (
        <Card>
          <CardHeader title={t('noAbhaTitle')} />
          <div className="grid gap-4 text-sm">
            <Alert tone="warn" title={t('abdmSaid')}>
              {login.message ?? t('noAbhaFallback')}
            </Alert>
            <p>{t('noAbhaOffer')}</p>
            <div>
              <Button type="button" onClick={createInstead}>
                {t('createAbhaInstead')}
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {step === 'profile' && profile && journeyId && login ? (
        <Card>
          <CardHeader title={t('verifiedTitle')} subtitle={login.message ?? undefined} />
          <div className="grid gap-4 text-sm">
            {login.accounts > 1 ? (
              <Alert tone="info">{t('severalAccounts', { count: login.accounts })}</Alert>
            ) : null}
            <AbhaProfilePanel journeyId={journeyId} profile={profile} />

            {login.mobileUpdate === 'NOT_AVAILABLE' ? (
              <Alert tone="info" title={t('mobileDiffers')}>
                {t('mobileUpdateUnavailable')}
              </Alert>
            ) : null}
            {login.mobileUpdate === 'OFFER' ? (
              <section className="grid gap-3 rounded-lg border border-line p-3">
                <h3 className="font-semibold">{t('mobileDiffers')}</h3>
                {updateChoice === 'undecided' ? (
                  <>
                    <p>{t('mobileUpdateQuestion')}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" disabled={busy} onClick={() => void sendUpdateOtp()}>
                        {t('yes')}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => setUpdateChoice('no')}
                      >
                        {t('no')}
                      </Button>
                    </div>
                  </>
                ) : null}
                {updateChoice === 'no' ? (
                  <p className="text-muted">{t('mobileNotUpdated')}</p>
                ) : null}
                {updateChoice === 'yes' && updateChallenge ? (
                  <form
                    className="grid gap-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void verifyUpdateOtp();
                    }}
                  >
                    {updateChallenge.message ? (
                      <Alert tone="info">{updateChallenge.message}</Alert>
                    ) : null}
                    <label className="grid gap-1" htmlFor="update-otp">
                      <span className="font-medium">{t('otpLabel')}</span>
                      <OtpInput id="update-otp" value={updateOtp} onChange={setUpdateOtp} />
                    </label>
                    <div>
                      <Button type="submit" disabled={busy || updateOtp.length !== 6}>
                        {t('verify')}
                      </Button>
                    </div>
                    <Resend
                      challenge={updateChallenge}
                      busy={busy}
                      onResend={() => void sendUpdateOtp()}
                      limitReached={updateResendLimit}
                    />
                  </form>
                ) : null}
                {updateChoice === 'done' ? (
                  <Alert tone="ok" title={t('abdmSaid')}>
                    {updateMessage ?? t('mobileUpdated')}
                  </Alert>
                ) : null}
              </section>
            ) : null}

            {error ? (
              <Alert tone="danger" title={t('abdmSaid')}>
                {error}
              </Alert>
            ) : null}
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
            form={{ mobile: deskMobile || (profile?.mobile ?? '') }}
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

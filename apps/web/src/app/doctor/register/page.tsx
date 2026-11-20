'use client';

import {
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  type PatientRegistrationResult,
  type RegisterPatient,
  type SupportedLocale,
} from '@healthguard/shared';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/states';
import { api } from '@/lib/api';
import { useAction } from '@/lib/queries';
import { useSession } from '@/lib/session';

const SEXES = ['FEMALE', 'MALE', 'OTHER', 'UNKNOWN'] as const;
const FIELD = 'min-h-11 rounded-lg border border-line px-3 text-sm';

/** Front-desk registration of a real patient. Demo organizations are seeded only. */
export default function RegisterPatientPage() {
  const t = useTranslations('register');
  const { data: session } = useSession();
  const [givenName, setGivenName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [sex, setSex] = useState<(typeof SEXES)[number]>('FEMALE');
  const [phone, setPhone] = useState('');
  const [locale, setLocale] = useState<SupportedLocale>('en-IN');
  const today = new Date().toISOString().slice(0, 10);

  const register = useAction<RegisterPatient, PatientRegistrationResult>(
    (json) => api<PatientRegistrationResult>('/patients', { method: 'POST', json }),
    ['/patients'],
  );

  const mayRegister = session?.roles.some((role) =>
    ['FRONT_DESK', 'NURSE', 'CARE_COORDINATOR'].includes(role),
  );
  const isDemo = session?.activeOrganization?.isDemo ?? false;

  function reset() {
    setGivenName('');
    setFamilyName('');
    setDateOfBirth('');
    setSex('FEMALE');
    setPhone('');
    setLocale('en-IN');
    register.reset();
  }

  return (
    <div className="grid max-w-2xl gap-5">
      <PageHeader title={t('title')} subtitle={session?.activeOrganization?.name} />
      {isDemo ? (
        <Alert tone="warn" title={t('demoTitle')}>
          {t('demoBody')}
        </Alert>
      ) : !mayRegister ? (
        <Alert tone="warn" title={t('notAllowedTitle')}>
          {t('notAllowedBody')}
        </Alert>
      ) : register.data ? (
        <Card>
          <Alert tone="ok" title={t('done', { name: register.data.patient.displayName })}>
            {t('recordNumber', { mrn: register.data.patient.mrn })}
          </Alert>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/doctor/patient/${register.data.patient.id}`}>{t('openRecord')}</Link>
            </Button>
            <Button type="button" variant="secondary" onClick={reset}>
              {t('another')}
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader
              title={t('abhaTitle')}
              subtitle={t('abhaNote')}
              action={
                <span className="flex flex-wrap gap-2">
                  <Button asChild variant="secondary">
                    <Link href="/doctor/abha/verify">{t('verifyAbha')}</Link>
                  </Button>
                  <Button asChild variant="secondary">
                    <Link href="/doctor/abha/create">{t('createAbha')}</Link>
                  </Button>
                </span>
              }
            />
          </Card>
          <Card>
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                register.mutate({
                  givenName: givenName.trim(),
                  ...(familyName.trim() ? { familyName: familyName.trim() } : {}),
                  dateOfBirth,
                  sex,
                  ...(phone.trim() ? { phone: phone.replace(/[\s-]+/g, '') } : {}),
                  preferredLocale: locale,
                });
              }}
            >
              <div className="grid items-start gap-4 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">{t('givenName')}</span>
                  <input
                    required
                    maxLength={100}
                    autoComplete="off"
                    value={givenName}
                    onChange={(event) => setGivenName(event.target.value)}
                    className={FIELD}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">{t('familyName')}</span>
                  <input
                    maxLength={100}
                    autoComplete="off"
                    value={familyName}
                    onChange={(event) => setFamilyName(event.target.value)}
                    className={FIELD}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">{t('dateOfBirth')}</span>
                  <input
                    required
                    type="date"
                    max={today}
                    value={dateOfBirth}
                    onChange={(event) => setDateOfBirth(event.target.value)}
                    className={FIELD}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">{t('sex')}</span>
                  <select
                    value={sex}
                    onChange={(event) => setSex(event.target.value as (typeof SEXES)[number])}
                    className={FIELD}
                  >
                    {SEXES.map((value) => (
                      <option key={value} value={value}>
                        {t(`sexes.${value}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">{t('phone')}</span>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    pattern="\+?[0-9\s\-]{10,20}"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    aria-describedby="register-phone-hint"
                    className={FIELD}
                  />
                  <span id="register-phone-hint" className="text-xs text-muted">
                    {t('phoneHint')}
                  </span>
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">{t('language')}</span>
                  <select
                    value={locale}
                    onChange={(event) => setLocale(event.target.value as SupportedLocale)}
                    className={FIELD}
                  >
                    {SUPPORTED_LOCALES.map((value) => (
                      <option key={value} value={value}>
                        {LOCALE_LABELS[value].native}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {register.error ? <ErrorState error={register.error} /> : null}
              <div>
                <Button type="submit" disabled={register.isPending}>
                  {t('submit')}
                </Button>
              </div>
            </form>
          </Card>
        </>
      )}
    </div>
  );
}

'use client';

import {
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  type AbhaMatches,
  type AbhaProfileView,
  type PatientRegistrationResult,
  type SupportedLocale,
} from '@healthguard/shared';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ABHA_FIELD, ABHA_JOURNEYS, problemText } from '@/lib/abha';
import { api } from '@/lib/api';
import { useApi } from '@/lib/queries';

/**
 * Saving to the facility's own record. It searches for an existing patient
 * first and offers a new record only when none matches. When `form` is set,
 * the details filled from the ABHA are shown before saving: name, date of
 * birth and gender cannot be changed, the mobile can.
 */
export function AbhaSaveStep({
  journeyId,
  profile,
  form,
  onSaved,
}: {
  journeyId: string;
  profile: AbhaProfileView | null;
  /** The mobile to start the editable field with; omit to save without showing the form. */
  form?: { mobile: string };
  onSaved: (result: PatientRegistrationResult) => void;
}) {
  const t = useTranslations('abha');
  // Looked up when the step opens, and again when the desk searches by record number.
  const [recordNumber, setRecordNumber] = useState('');
  const found = useApi<AbhaMatches>(
    `${ABHA_JOURNEYS}/${journeyId}/matches${recordNumber ? `?mrn=${encodeURIComponent(recordNumber)}` : ''}`,
  );
  const matches = found.data ?? null;
  const [mrn, setMrn] = useState('');
  const [locale, setLocale] = useState<SupportedLocale>('en-IN');
  const [mobile, setMobile] = useState(form?.mobile ?? '');
  // Filled from the ABHA and editable: what the desk confirms here is what is saved.
  const [contact, setContact] = useState({
    email: profile?.email ?? '',
    addressLine: profile?.address ?? '',
    city: profile?.city ?? '',
    district: profile?.districtName ?? '',
    state: profile?.stateName ?? '',
    pinCode: profile?.pinCode ?? '',
  });
  const setField = (key: keyof typeof contact) => (value: string) =>
    setContact((current) => ({ ...current, [key]: value }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(body: { action: 'LINK'; patientId: string } | { action: 'CREATE' }) {
    setBusy(true);
    setError(null);
    try {
      const json =
        body.action === 'CREATE'
          ? {
              ...body,
              preferredLocale: locale,
              ...(form && /^[0-9]{10}$/.test(mobile) ? { phone: mobile } : {}),
              ...(form
                ? {
                    contact: Object.fromEntries(
                      Object.entries(contact).map(([key, value]) => [key, value.trim()]),
                    ),
                  }
                : {}),
            }
          : body;
      onSaved(
        await api<PatientRegistrationResult>(`${ABHA_JOURNEYS}/${journeyId}/save`, {
          method: 'POST',
          json,
        }),
      );
    } catch (caught) {
      setError(problemText(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
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
          setRecordNumber(mrn.trim());
        }}
      >
        <label className="grid gap-1">
          <span className="font-medium">{t('searchByRecordNumber')}</span>
          <input
            value={mrn}
            maxLength={50}
            onChange={(event) => setMrn(event.target.value)}
            className={`${ABHA_FIELD} w-56 font-mono`}
          />
        </label>
        <Button type="submit" variant="secondary" disabled={busy || !mrn.trim()}>
          {t('search')}
        </Button>
      </form>
      {matches?.mayCreate ? (
        <div className="grid gap-3 rounded-lg border border-line p-3">
          {form && profile ? (
            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="mb-1 font-medium">{t('formTitle')}</legend>
              <label className="grid gap-1">
                <span className="font-medium">{t('name')}</span>
                <input readOnly value={profile.name ?? ''} className={`${ABHA_FIELD} bg-surface`} />
              </label>
              <label className="grid gap-1">
                <span className="font-medium">{t('dateOfBirth')}</span>
                <input
                  readOnly
                  value={profile.dateOfBirth ?? ''}
                  className={`${ABHA_FIELD} bg-surface`}
                />
              </label>
              <label className="grid gap-1">
                <span className="font-medium">{t('gender')}</span>
                <input
                  readOnly
                  value={profile.gender ?? ''}
                  className={`${ABHA_FIELD} bg-surface`}
                />
              </label>
              <label className="grid gap-1">
                <span className="font-medium">{t('mobile')}</span>
                <input
                  inputMode="numeric"
                  maxLength={10}
                  value={mobile}
                  onChange={(event) =>
                    setMobile(event.target.value.replace(/\D+/g, '').slice(0, 10))
                  }
                  className={ABHA_FIELD}
                />
              </label>
              <label className="grid gap-1">
                <span className="font-medium">{t('email')}</span>
                <input
                  type="email"
                  autoComplete="off"
                  maxLength={254}
                  value={contact.email}
                  onChange={(event) => setField('email')(event.target.value)}
                  className={ABHA_FIELD}
                />
              </label>
              <label className="grid gap-1 sm:col-span-2">
                <span className="font-medium">{t('address')}</span>
                <input
                  autoComplete="off"
                  maxLength={500}
                  value={contact.addressLine}
                  onChange={(event) => setField('addressLine')(event.target.value)}
                  className={ABHA_FIELD}
                />
              </label>
              {(['city', 'district', 'state'] as const).map((key) => (
                <label key={key} className="grid gap-1">
                  <span className="font-medium">{t(key)}</span>
                  <input
                    autoComplete="off"
                    maxLength={100}
                    value={contact[key]}
                    onChange={(event) => setField(key)(event.target.value)}
                    className={ABHA_FIELD}
                  />
                </label>
              ))}
              <label className="grid gap-1">
                <span className="font-medium">{t('pinCode')}</span>
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={6}
                  value={contact.pinCode}
                  onChange={(event) =>
                    setField('pinCode')(event.target.value.replace(/\D+/g, '').slice(0, 6))
                  }
                  className={ABHA_FIELD}
                />
              </label>
              <p className="text-xs text-muted sm:col-span-2">{t('formNote')}</p>
            </fieldset>
          ) : null}
          <label className="grid gap-1">
            <span className="font-medium">{t('language')}</span>
            <select
              value={locale}
              onChange={(event) => setLocale(event.target.value as SupportedLocale)}
              className={`${ABHA_FIELD} w-48`}
            >
              {SUPPORTED_LOCALES.map((value) => (
                <option key={value} value={value}>
                  {LOCALE_LABELS[value].native}
                </option>
              ))}
            </select>
          </label>
          <div>
            <Button type="button" disabled={busy} onClick={() => void save({ action: 'CREATE' })}>
              {t('createRecord')}
            </Button>
          </div>
        </div>
      ) : matches ? (
        <p className="text-muted">{t('createNotAllowed')}</p>
      ) : null}
      {found.error ? <Alert tone="danger">{problemText(found.error)}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}

/** The last screen of a journey: what was saved, and where to go next. */
export function AbhaSaved({ saved }: { saved: PatientRegistrationResult }) {
  const t = useTranslations('abha');
  return (
    <>
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
    </>
  );
}

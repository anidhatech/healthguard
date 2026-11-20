'use client';

import { API_BASE_PATH, type AbhaProfileView } from '@healthguard/shared';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ABHA_JOURNEYS } from '@/lib/abha';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="col-span-2 font-medium break-words">{children ?? '—'}</dd>
    </div>
  );
}

/**
 * The ABHA number, address and profile details as ABDM returned them, and the
 * card to view and download. Nothing here can be edited: it is ABDM's record.
 */
export function AbhaProfilePanel({
  journeyId,
  profile,
}: {
  journeyId: string;
  profile: AbhaProfileView;
}) {
  const t = useTranslations('abha');
  const cardUrl = `${API_BASE_PATH}${ABHA_JOURNEYS}/${journeyId}/card`;
  return (
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
    </div>
  );
}

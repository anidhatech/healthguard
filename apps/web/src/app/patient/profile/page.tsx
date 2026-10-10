'use client';

import type { PatientProfileView } from '@healthguard/shared';
import { useLocale, useTranslations } from 'next-intl';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { OwnPatient } from '@/components/layout/own-patient';
import { PageHeader } from '@/components/layout/page-header';
import { AbdmSimulation, FhirExportButton } from '@/components/patient/connected-services';
import { Card, CardHeader } from '@/components/ui/card';
import { QueryView } from '@/components/ui/states';
import { useApi } from '@/lib/queries';
import { formatDate } from '@/lib/utils';

function Profile({ patientId }: { patientId: string }) {
  const t = useTranslations('profile');
  const locale = useLocale();
  const query = useApi<PatientProfileView>(`/patients/${patientId}`);
  return (
    <QueryView query={query}>
      {(profile) => (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title={profile.displayName} subtitle={profile.organization.name} />
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted">{t('dateOfBirth')}</dt>
              <dd>
                {formatDate(profile.dateOfBirth, locale)} ({profile.ageYears})
              </dd>
              <dt className="text-muted">{t('mrn')}</dt>
              <dd className="font-mono">{profile.mrn}</dd>
              <dt className="text-muted">{t('phone')}</dt>
              <dd>{profile.phoneMasked ?? '—'}</dd>
              <dt className="text-muted">{t('clinician')}</dt>
              <dd>{profile.primaryClinician?.displayName ?? '—'}</dd>
            </dl>
          </Card>
          <Card>
            <CardHeader title={t('language')} />
            <LanguageSwitcher />
            <CardHeader title={t('routine')} subtitle={t('routineHint')} />
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {(['wake', 'breakfast', 'lunch', 'dinner', 'sleep'] as const).map((key) =>
                profile.dailyRoutine[key] ? (
                  <div key={key} className="contents">
                    <dt className="text-muted">{t(key)}</dt>
                    <dd className="font-mono">{profile.dailyRoutine[key]}</dd>
                  </div>
                ) : null,
              )}
            </dl>
          </Card>
          <Card>
            <CardHeader title={t('shareTitle')} subtitle={t('shareHint')} />
            <FhirExportButton patientId={patientId} />
          </Card>
          <AbdmSimulation patientId={patientId} />
        </div>
      )}
    </QueryView>
  );
}

export default function ProfilePage() {
  const t = useTranslations('profile');
  return (
    <OwnPatient>
      {(patientId) => (
        <>
          <PageHeader title={t('title')} />
          <Profile patientId={patientId} />
        </>
      )}
    </OwnPatient>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { LabsPanel } from '@/components/clinical/labs-panel';
import { OwnPatient } from '@/components/layout/own-patient';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';

export default function TestsPage() {
  const t = useTranslations('tests');
  return (
    <OwnPatient>
      {(patientId) => (
        <>
          <PageHeader title={t('title')} />
          <Card>
            <LabsPanel patientId={patientId} />
          </Card>
        </>
      )}
    </OwnPatient>
  );
}

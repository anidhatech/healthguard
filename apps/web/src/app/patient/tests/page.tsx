'use client';

import { useTranslations } from 'next-intl';
import { LabsPanel } from '@/components/clinical/labs-panel';
import { OwnPatient } from '@/components/layout/own-patient';
import { PageHeader } from '@/components/layout/page-header';
import { ConfirmReport } from '@/components/patient/confirm-report';
import { Card } from '@/components/ui/card';

export default function TestsPage() {
  const t = useTranslations('tests');
  return (
    <OwnPatient>
      {(patientId) => (
        <div className="grid gap-4">
          <PageHeader title={t('title')} />
          <ConfirmReport patientId={patientId} />
          <Card>
            <LabsPanel patientId={patientId} />
          </Card>
        </div>
      )}
    </OwnPatient>
  );
}

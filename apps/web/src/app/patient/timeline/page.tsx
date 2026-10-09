'use client';

import { useTranslations } from 'next-intl';
import { TimelineList } from '@/components/clinical/timeline-list';
import { OwnPatient } from '@/components/layout/own-patient';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';

export default function TimelinePage() {
  const t = useTranslations('timeline');
  return (
    <OwnPatient>
      {(patientId) => (
        <>
          <PageHeader title={t('title')} />
          <Card>
            <TimelineList patientId={patientId} />
          </Card>
        </>
      )}
    </OwnPatient>
  );
}

'use client';

import type { AiResultView, PatientProfileView } from '@healthguard/shared';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Bot, CheckCircle2, XCircle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AllergiesList, ConditionsList } from '@/components/clinical/history-panel';
import { LabsPanel } from '@/components/clinical/labs-panel';
import { AdherenceCard, MedicationList } from '@/components/clinical/medication-list';
import { ProgressCards } from '@/components/clinical/progress-cards';
import { TimelineList } from '@/components/clinical/timeline-list';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { KindBadge } from '@/components/ui/honest';
import { ProposeAppointmentButton, StaffAppointments } from '@/components/doctor/care-queue';
import { DraftsPanel, PlanActions, PrescribeButton } from '@/components/doctor/prescribing';
import { FhirExportButton } from '@/components/patient/connected-services';
import { TodayDoses } from '@/components/patient/today-doses';
import { ErrorState, LoadingState, QueryView } from '@/components/ui/states';
import { api } from '@/lib/api';
import { useAction, useApi } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { formatDate } from '@/lib/utils';

function ObservationReview({ id, status }: { id: string; status: string }) {
  const t = useTranslations('doctor');
  const review = useAction(
    (decision: 'ACCEPTED' | 'DISMISSED') =>
      api<{ status: string }>(`/ai/recommendations/${id}/review`, {
        method: 'POST',
        json: { decision, reason: decision === 'ACCEPTED' ? 'USEFUL' : 'NOT_RELEVANT' },
      }),
    [],
  );
  const current = review.data?.status ?? status;
  if (current !== 'PROPOSED') {
    return (
      <Badge tone={current === 'ACCEPTED' ? 'ok' : 'neutral'}>{t(`reviewed.${current}`)}</Badge>
    );
  }
  return (
    <span className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="secondary"
        disabled={review.isPending}
        onClick={() => review.mutate('ACCEPTED')}
      >
        {t('noted')}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={review.isPending}
        onClick={() => review.mutate('DISMISSED')}
      >
        {t('dismiss')}
      </Button>
      {review.error ? <ErrorState error={review.error} /> : null}
    </span>
  );
}

function DoctorBrief({ patientId }: { patientId: string }) {
  const t = useTranslations('doctor');
  const brief = useMutation({
    mutationFn: () =>
      api<AiResultView>(`/patients/${patientId}/ai/requests`, {
        method: 'POST',
        json: { task: 'DOCTOR_BRIEF_SYNTHESIS' },
      }),
  });
  const result = brief.data;
  return (
    <Card className="border-ai/30">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Bot aria-hidden className="size-4 text-ai" />
            {t('brief')}
          </span>
        }
        subtitle={t('briefIntro')}
        action={
          <Button variant="ai" disabled={brief.isPending} onClick={() => brief.mutate()}>
            {t('generateBrief')}
          </Button>
        }
      />
      {brief.isPending ? <LoadingState /> : null}
      {brief.error ? <ErrorState error={brief.error} /> : null}
      {result ? (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <KindBadge kind="AI_SUMMARY" />
            <span>
              {t('briefProvider', {
                provider: result.provider,
                model: result.model,
                prompt: `${result.promptKey}@${result.promptVersion}`,
              })}
            </span>
            {result.confidence ? (
              <Badge tone="calc">{t('confidence', { level: result.confidence })}</Badge>
            ) : null}
          </div>
          {result.fallbackReason ? (
            <Alert tone="warn">{t('fallback', { reason: result.fallbackReason })}</Alert>
          ) : null}
          <ul className="grid gap-2">
            {result.summary.map((claim) => (
              <li key={claim.claimKey} className="rounded-lg bg-ai-50 p-3 text-sm">
                <p>{claim.text}</p>
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-ai">
                    {t('sources')} ({claim.sources.length})
                  </summary>
                  <ul className="mt-1 list-disc pl-5 text-xs text-muted">
                    {claim.sources.map((source, index) => (
                      <li key={index}>
                        {source.label} <span className="font-mono">[{source.type}]</span>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
          {result.observations.length ? (
            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                {t('observations')} <KindBadge kind="AI_RECOMMENDATION" />
              </p>
              <ul className="grid gap-2">
                {result.observations.map((item) => (
                  <li key={item.id} className="rounded-lg border border-ai/30 p-3 text-sm">
                    <p className="font-medium">{item.text}</p>
                    <p className="text-xs text-muted">
                      {item.rationale} · {item.type.toLowerCase().replaceAll('_', ' ')} ·{' '}
                      {item.confidence.toLowerCase()}
                    </p>
                    <div className="mt-2">
                      <ObservationReview id={item.id} status={item.status} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <details>
            <summary className="cursor-pointer text-xs text-muted">
              {t('validation')} ({result.validation.checks.filter((check) => check.passed).length}/
              {result.validation.checks.length})
            </summary>
            <ul className="mt-1 grid gap-1 text-xs">
              {result.validation.checks.map((check, index) => (
                <li key={index} className="flex items-center gap-1">
                  {check.passed ? (
                    <CheckCircle2 aria-hidden className="size-3 text-ok" />
                  ) : (
                    <XCircle aria-hidden className="size-3 text-danger" />
                  )}
                  {check.name}{' '}
                  {check.detail ? <span className="text-muted">— {check.detail}</span> : null}
                </li>
              ))}
            </ul>
          </details>
          <p className="text-xs text-muted">{result.notice}</p>
        </div>
      ) : null}
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} />
      {children}
    </Card>
  );
}

export default function DoctorPatientPage() {
  const t = useTranslations('doctor');
  const tr = useTranslations('records');
  const locale = useLocale();
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const profile = useApi<PatientProfileView>(`/patients/${id}`);
  const isDoctor = session?.roles.includes('DOCTOR') ?? false;
  const isCareTeam =
    session?.roles.some((role) => ['DOCTOR', 'NURSE', 'CARE_COORDINATOR'].includes(role)) ?? false;

  return (
    <div className="grid gap-5">
      <Link
        href="/doctor/dashboard"
        className="inline-flex items-center gap-1 text-sm text-brand-700"
      >
        <ArrowLeft aria-hidden className="size-4" /> {t('title')}
      </Link>
      <QueryView query={profile}>
        {(patient) => (
          <>
            <PageHeader
              title={patient.displayName}
              subtitle={`${patient.mrn} · ${patient.ageYears} · ${patient.sex.toLowerCase()} · ${formatDate(patient.dateOfBirth, locale)} · ${patient.preferredLocale}${patient.isSynthetic ? ' · synthetic' : ''}`}
              action={
                <span className="flex flex-wrap gap-2">
                  {isDoctor ? <PrescribeButton patientId={id} /> : null}
                  {isCareTeam ? <ProposeAppointmentButton patientId={id} /> : null}
                  {isDoctor ? <FhirExportButton patientId={id} /> : null}
                </span>
              }
            />
            {isDoctor ? <DraftsPanel patientId={id} /> : null}
            <ProgressCards patientId={id} />
            {isDoctor ? <DoctorBrief patientId={id} /> : null}
            <div className="grid gap-4 lg:grid-cols-2">
              <Section title={tr('conditions')}>
                <ConditionsList patientId={id} />
              </Section>
              <Section title={tr('allergies')}>
                <AllergiesList patientId={id} />
              </Section>
            </div>
            <Section title={t('labs')}>
              <LabsPanel patientId={id} />
            </Section>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <Section title={t('medicines')}>
                  <MedicationList
                    patientId={id}
                    actions={
                      isDoctor ? (plan) => <PlanActions patientId={id} plan={plan} /> : undefined
                    }
                  />
                </Section>
              </div>
              <AdherenceCard patientId={id} />
            </div>
            {isCareTeam ? (
              <Section title={t('appointments')}>
                <StaffAppointments patientId={id} />
              </Section>
            ) : null}
            <Section title={t('todayDoses')}>
              <TodayDoses patientId={id} readOnly />
            </Section>
            <Section title={t('timeline')}>
              <TimelineList patientId={id} limit={25} />
            </Section>
          </>
        )}
      </QueryView>
    </div>
  );
}

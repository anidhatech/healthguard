'use client';

import type {
  AuditEventView,
  MemberView,
  OrganizationStats,
  PlatformOrganizationView,
} from '@healthguard/shared';
import { useLocale, useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { ComingNextPhase, KindBadge } from '@/components/ui/honest';
import { QueryView } from '@/components/ui/states';
import { Table, Td, Th } from '@/components/ui/table';
import { useApi } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { formatDate, formatNumber, formatTime } from '@/lib/utils';

export default function AdminDashboard() {
  const t = useTranslations('admin');
  const locale = useLocale();
  const { data: session } = useSession();
  const orgAdmin =
    session?.roles.some((role) => role === 'ORG_ADMIN' || role === 'AUDITOR') ?? false;
  const platform = session?.roles.includes('PLATFORM_ADMIN') ?? false;
  const stats = useApi<OrganizationStats>(orgAdmin ? '/organizations/current/stats' : null);
  const members = useApi<MemberView[]>(
    session?.roles.includes('ORG_ADMIN') ? '/organizations/current/members' : null,
  );
  const audit = useApi<AuditEventView[]>(orgAdmin ? '/audit-events?limit=25' : null);
  const tenants = useApi<PlatformOrganizationView[]>(platform ? '/platform/organizations' : null);

  return (
    <div className="grid gap-5">
      <PageHeader title={t('title')} subtitle={session?.activeOrganization?.name} />
      <Alert tone="info">{t('noClinical')}</Alert>
      {orgAdmin ? (
        <Card>
          <CardHeader title={t('stats')} action={<KindBadge kind="CALCULATED" />} />
          <QueryView query={stats}>
            {(data) => (
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(
                  [
                    ['patients', data.patients],
                    ['members', data.members],
                    ['clinicians', data.clinicians],
                    ['activeConsents', data.activeConsents],
                    ['upcomingAppointments', data.upcomingAppointments],
                    ['auditEvents', data.auditEventsLast7Days],
                    ['denials', data.accessDenialsLast7Days],
                    ['aiCalls', data.aiInteractionsLast7Days],
                  ] as const
                ).map(([key, value]) => (
                  <div key={key} className="rounded-lg border border-line p-3">
                    <dt className="text-xs text-muted">{t(key)}</dt>
                    <dd className="text-2xl font-semibold">{formatNumber(value)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </QueryView>
        </Card>
      ) : null}
      {session?.roles.includes('ORG_ADMIN') ? (
        <Card>
          <CardHeader title={t('memberList')} action={<ComingNextPhase label={t('invite')} />} />
          <QueryView query={members} isEmpty={(rows) => rows.length === 0}>
            {(rows) => (
              <Table>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Email</Th>
                    <Th>Roles</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <Td className="font-medium">{row.user.displayName}</Td>
                      <Td className="text-xs">{row.user.email}</Td>
                      <Td>
                        {row.roles.map((role) => (
                          <Badge key={role} tone="brand" className="mr-1">
                            {role}
                          </Badge>
                        ))}
                      </Td>
                      <Td>{row.status.toLowerCase()}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </QueryView>
        </Card>
      ) : null}
      {orgAdmin ? (
        <Card>
          <CardHeader title={t('audit')} />
          <QueryView query={audit} isEmpty={(rows) => rows.length === 0}>
            {(rows) => (
              <Table>
                <thead>
                  <tr>
                    <Th>When</Th>
                    <Th>Who</Th>
                    <Th>Action</Th>
                    <Th>Decision</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <Td className="whitespace-nowrap text-xs">
                        {formatDate(row.occurredAt, locale)} {formatTime(row.occurredAt, locale)}
                      </Td>
                      <Td>
                        {row.actorDisplayName ?? row.actorType.toLowerCase()}
                        <span className="block text-xs text-muted">
                          {row.actorRoles.join(', ')}
                        </span>
                      </Td>
                      <Td>
                        {row.action} · {row.resourceType}
                      </Td>
                      <Td>
                        <Badge
                          tone={
                            row.decision === 'DENY'
                              ? 'danger'
                              : row.decision === 'ALLOW'
                                ? 'ok'
                                : 'neutral'
                          }
                        >
                          {row.decision}
                        </Badge>
                        {row.decisionReason ? (
                          <span className="block text-xs text-muted">{row.decisionReason}</span>
                        ) : null}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </QueryView>
        </Card>
      ) : null}
      {platform ? (
        <Card>
          <CardHeader title={t('tenants')} />
          <QueryView query={tenants} isEmpty={(rows) => rows.length === 0}>
            {(rows) => (
              <Table>
                <thead>
                  <tr>
                    <Th>Organization</Th>
                    <Th>Type</Th>
                    <Th>Members</Th>
                    <Th>Patients</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <Td className="font-medium">
                        {row.name} {row.isDemo ? <Badge tone="warn">demo</Badge> : null}
                      </Td>
                      <Td>{row.type.toLowerCase()}</Td>
                      <Td>{row.memberCount}</Td>
                      <Td>{row.patientCount}</Td>
                      <Td>{row.status.toLowerCase()}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </QueryView>
        </Card>
      ) : null}
    </div>
  );
}

import { Controller, Get, Module } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  isMemberRole,
  resolveLocale,
  type MemberView,
  type OrganizationStats,
  type OrganizationView,
  type PlatformOrganizationView,
} from '@healthguard/shared';
import { CurrentActor, requireOrganization, type ActorContext } from '../../common/actor.js';
import { Roles } from '../../common/decorators.js';
import { iso, isoOrNull } from '../../common/mapping.js';
import { Problems } from '../../common/problem.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

@ApiTags('organizations')
@Controller({ version: '1' })
export class OrganizationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('organizations/current')
  @ApiOperation({ summary: 'The active organization' })
  async current(@CurrentActor() actor: ActorContext): Promise<OrganizationView> {
    const id = requireOrganization(actor);
    const org = await this.prisma.db.organization.findUnique({ where: { id } });
    if (!org) throw Problems.notFound('organization');
    const settings = (org.settings ?? {}) as { enabledLocales?: string[] };
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      type: org.type,
      isDemo: org.isDemo,
      status: org.status,
      timezone: org.timezone,
      enabledLocales: (settings.enabledLocales ?? ['en-IN']).map(resolveLocale),
    };
  }

  @Get('organizations/current/members')
  @Roles('ORG_ADMIN')
  @ApiOperation({ summary: 'Members and roles of the active organization (admins)' })
  async members(@CurrentActor() actor: ActorContext): Promise<MemberView[]> {
    const id = requireOrganization(actor);
    const rows = await this.prisma.tenant(id).organizationMember.findMany({
      where: { deletedAt: null },
      include: { user: true, clinicianProfile: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      user: { id: row.user.id, displayName: row.user.displayName, email: row.user.email },
      roles: row.roles.filter(isMemberRole),
      status: row.status,
      joinedAt: isoOrNull(row.joinedAt),
      clinician: row.clinicianProfile
        ? {
            id: row.clinicianProfile.id,
            specialty: row.clinicianProfile.specialty,
            isPrescriber: row.clinicianProfile.isPrescriber,
          }
        : null,
    }));
  }

  @Get('organizations/current/stats')
  @Roles('ORG_ADMIN', 'AUDITOR')
  @ApiOperation({ summary: 'Operational counts for the admin dashboard (no clinical data)' })
  async stats(@CurrentActor() actor: ActorContext): Promise<OrganizationStats> {
    const id = requireOrganization(actor);
    const scoped = this.prisma.tenant(id);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
    const [
      patients,
      members,
      clinicians,
      activeConsents,
      upcomingAppointments,
      auditEvents,
      denials,
      ai,
    ] = await Promise.all([
      scoped.patientProfile.count({ where: { deletedAt: null } }),
      scoped.organizationMember.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      scoped.clinicianProfile.count({ where: { deletedAt: null } }),
      scoped.consent.count({ where: { status: 'GRANTED', validUntil: { gt: now } } }),
      scoped.appointment.count({
        where: { status: { in: ['PROPOSED', 'PATIENT_APPROVED', 'CONFIRMED'] } },
      }),
      this.prisma.db.auditEvent.count({
        where: { organizationId: id, occurredAt: { gte: weekAgo } },
      }),
      this.prisma.db.auditEvent.count({
        where: { organizationId: id, decision: 'DENY', occurredAt: { gte: weekAgo } },
      }),
      scoped.aIInteraction.count({ where: { createdAt: { gte: weekAgo } } }),
    ]);
    return {
      kind: 'CALCULATED',
      patients,
      members,
      clinicians,
      activeConsents,
      upcomingAppointments,
      auditEventsLast7Days: auditEvents,
      accessDenialsLast7Days: denials,
      aiInteractionsLast7Days: ai,
    };
  }

  @Get('platform/organizations')
  @Roles('PLATFORM_ADMIN')
  @ApiOperation({ summary: 'All tenants (platform admins; counts only)' })
  async platform(): Promise<PlatformOrganizationView[]> {
    const rows = await this.prisma.db.organization.findMany({
      where: { deletedAt: null },
      include: { _count: { select: { members: true, patients: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      type: row.type,
      isDemo: row.isDemo,
      status: row.status,
      memberCount: row._count.members,
      patientCount: row._count.patients,
      createdAt: iso(row.createdAt),
    }));
  }
}

@Module({ controllers: [OrganizationsController] })
export class OrganizationsModule {}

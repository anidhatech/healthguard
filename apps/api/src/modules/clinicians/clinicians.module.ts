import { Controller, Get, Module } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ClinicianView } from '@healthguard/shared';
import { CurrentActor, requireOrganization, type ActorContext } from '../../common/actor.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

@ApiTags('clinicians')
@Controller({ path: 'clinicians', version: '1' })
export class CliniciansController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Clinicians of the active organization (directory; no patient data)' })
  async list(@CurrentActor() actor: ActorContext): Promise<ClinicianView[]> {
    const organizationId = requireOrganization(actor);
    const rows = await this.prisma.tenant(organizationId).clinicianProfile.findMany({
      where: { deletedAt: null },
      orderBy: { displayName: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      displayName: row.displayName,
      specialty: row.specialty,
      qualifications: row.qualifications,
      isPrescriber: row.isPrescriber,
    }));
  }
}

@Module({ controllers: [CliniciansController] })
export class CliniciansModule {}

import { Controller, Get, Inject, Module } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { COMING_NEXT_PHASE, type InteropStatus } from '@healthguard/shared';
import { APP_CONFIG, type AppConfig } from '../../config/env.js';

/**
 * Interoperability status. FHIR R4 export, ABDM (ABHA, HIP/HIU consent flows)
 * and wearable/device ingestion are designed (docs/FHIR_MAPPING.md,
 * docs/ABDM_INTEGRATION.md) but not built. HealthGuard is not ABDM certified.
 */
@ApiTags('interoperability')
@Controller({ path: 'interoperability', version: '1' })
export class InteroperabilityController {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  @Get('status')
  @ApiOperation({ summary: 'What interoperability exists today (nothing is connected yet)' })
  status(): InteropStatus {
    return {
      fhirExport: {
        status: 'NOT_AVAILABLE',
        note: `FHIR R4 export: ${COMING_NEXT_PHASE}. Mapping is documented in docs/FHIR_MAPPING.md.`,
      },
      abdm: {
        adapter: this.config.env.ABDM_ADAPTER,
        status: 'NOT_CONNECTED',
        note: `ABDM sandbox integration: ${COMING_NEXT_PHASE}. HealthGuard is not ABDM certified.`,
      },
      devices: {
        adapter: 'none',
        status: 'NOT_CONNECTED',
        note: `Wearable and device sync: ${COMING_NEXT_PHASE}. Demo activity data is synthetic.`,
      },
    };
  }
}

@Module({ controllers: [InteroperabilityController] })
export class InteroperabilityModule {}

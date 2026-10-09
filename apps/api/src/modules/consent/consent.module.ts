import { Global, Module } from '@nestjs/common';
import { AccessService } from './access.service.js';
import { ConsentController } from './consent.controller.js';
import { PatientAccessService } from './patient-access.service.js';

@Global()
@Module({
  controllers: [ConsentController],
  providers: [AccessService, PatientAccessService],
  exports: [AccessService, PatientAccessService],
})
export class ConsentModule {}

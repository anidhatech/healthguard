import { Body, Controller, Get, HttpCode, Module, Param, Post, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AbhaAddressSearchSchema,
  AbhaMobileSearchSchema,
  AbhaJourneyParamsSchema,
  AbhaMatchQuerySchema,
  CreateAbhaAddressSchema,
  ResendAadhaarOtpSchema,
  ResendAbhaLoginSchema,
  SaveAbhaEnrolmentSchema,
  StartAbhaEnrolmentSchema,
  StartAbhaLoginSchema,
  UpdateAbhaMobileSchema,
  VerifyAadhaarOtpSchema,
  VerifyAbhaLoginSchema,
  VerifyMobileOtpSchema,
  type AbhaAddressMethods,
  type AbhaAddressResult,
  type AbhaAddressSearch,
  type AbhaMobileSearch,
  type AbhaMobileSearchResult,
  type AbhaAddressSuggestions,
  type AbhaEnrolmentView,
  type AbhaJourneyParams,
  type AbhaLoginView,
  type AbhaMatchQuery,
  type AbhaMatches,
  type AbhaMobileVerification,
  type AbhaOtpChallenge,
  type AbhaProfileView,
  type CreateAbhaAddress,
  type PatientRegistrationResult,
  type ResendAadhaarOtp,
  type ResendAbhaLogin,
  type SaveAbhaEnrolment,
  type StartAbhaEnrolment,
  type StartAbhaLogin,
  type UpdateAbhaMobile,
  type VerifyAadhaarOtp,
  type VerifyAbhaLogin,
  type VerifyMobileOtp,
} from '@healthguard/shared';
import type { Response } from 'express';
import {
  CurrentActor,
  CurrentMeta,
  type ActorContext,
  type RequestMeta,
} from '../../common/actor.js';
import { RawResponse, Roles } from '../../common/decorators.js';
import { zod } from '../../common/zod.pipe.js';
import { PatientsModule } from '../patients/patients.module.js';
import { AbhaEnrolmentService } from './abha-enrolment.service.js';
import { AbhaJourneyStore } from './abha-journey.store.js';
import { AbhaLoginService } from './abha-login.service.js';

/**
 * Create ABHA by Aadhaar OTP, for the front desk and care team of a clinic
 * organization. Bodies here carry an Aadhaar number or an OTP for one request
 * only: neither is stored, logged or audited.
 */
@ApiTags('abha')
@Roles('FRONT_DESK', 'CARE_TEAM')
@Controller({ path: 'abha/enrolments', version: '1' })
export class AbhaController {
  constructor(private readonly enrolments: AbhaEnrolmentService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Record the consent and send the Aadhaar OTP' })
  start(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Body(zod(StartAbhaEnrolmentSchema)) body: StartAbhaEnrolment,
  ): Promise<AbhaOtpChallenge> {
    return this.enrolments.start(actor, meta, body);
  }

  @Post(':journeyId/resend')
  @HttpCode(200)
  @ApiOperation({ summary: 'Resend the Aadhaar OTP (after 60 seconds, twice at most)' })
  resend(
    @CurrentActor() actor: ActorContext,
    @Param(zod(AbhaJourneyParamsSchema)) params: AbhaJourneyParams,
    @Body(zod(ResendAadhaarOtpSchema)) body: ResendAadhaarOtp,
  ): Promise<AbhaOtpChallenge> {
    return this.enrolments.resendAadhaarOtp(actor, params.journeyId, body.aadhaarNumber);
  }

  @Post(':journeyId/verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify the Aadhaar OTP and create or fetch the ABHA' })
  verify(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(AbhaJourneyParamsSchema)) params: AbhaJourneyParams,
    @Body(zod(VerifyAadhaarOtpSchema)) body: VerifyAadhaarOtp,
  ): Promise<AbhaEnrolmentView> {
    return this.enrolments.verifyAadhaarOtp(actor, meta, params.journeyId, body);
  }

  @Post(':journeyId/mobile-otp')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send or resend the OTP for a different communication mobile' })
  mobileOtp(
    @CurrentActor() actor: ActorContext,
    @Param(zod(AbhaJourneyParamsSchema)) params: AbhaJourneyParams,
  ): Promise<AbhaOtpChallenge> {
    return this.enrolments.sendMobileOtp(actor, params.journeyId);
  }

  @Post(':journeyId/mobile-otp/verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify the communication mobile OTP' })
  verifyMobile(
    @CurrentActor() actor: ActorContext,
    @Param(zod(AbhaJourneyParamsSchema)) params: AbhaJourneyParams,
    @Body(zod(VerifyMobileOtpSchema)) body: VerifyMobileOtp,
  ): Promise<AbhaMobileVerification> {
    return this.enrolments.verifyMobileOtp(actor, params.journeyId, body.otp);
  }

  @Get(':journeyId/address-suggestions')
  @ApiOperation({ summary: 'ABHA addresses ABDM suggests for this person' })
  suggestions(
    @CurrentActor() actor: ActorContext,
    @Param(zod(AbhaJourneyParamsSchema)) params: AbhaJourneyParams,
  ): Promise<AbhaAddressSuggestions> {
    return this.enrolments.addressSuggestions(actor, params.journeyId);
  }

  @Post(':journeyId/address')
  @HttpCode(200)
  @ApiOperation({ summary: 'Create an ABHA address, suggested or the person’s own' })
  address(
    @CurrentActor() actor: ActorContext,
    @Param(zod(AbhaJourneyParamsSchema)) params: AbhaJourneyParams,
    @Body(zod(CreateAbhaAddressSchema)) body: CreateAbhaAddress,
  ): Promise<AbhaAddressResult> {
    return this.enrolments.createAddress(actor, params.journeyId, body.abhaAddress);
  }

  @Get(':journeyId/profile')
  @ApiOperation({ summary: 'The ABHA number, address and profile details' })
  profile(
    @CurrentActor() actor: ActorContext,
    @Param(zod(AbhaJourneyParamsSchema)) params: AbhaJourneyParams,
  ): Promise<AbhaProfileView> {
    return this.enrolments.profile(actor, params.journeyId);
  }

  @Get(':journeyId/card')
  @RawResponse()
  @ApiOperation({ summary: 'The ABHA card as ABDM returned it; add ?download=1 to save it' })
  async card(
    @CurrentActor() actor: ActorContext,
    @Param(zod(AbhaJourneyParamsSchema)) params: AbhaJourneyParams,
    @Query('download') download: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const card = await this.enrolments.card(actor, params.journeyId);
    response
      .status(200)
      .set({
        'Content-Type': card.contentType,
        'Content-Length': String(card.bytes.length),
        'Cache-Control': 'no-store',
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="abha-card.png"`,
      })
      .end(card.bytes);
  }

  @Get(':journeyId/matches')
  @ApiOperation({ summary: 'Patients already registered who may be this person' })
  matches(
    @CurrentActor() actor: ActorContext,
    @Param(zod(AbhaJourneyParamsSchema)) params: AbhaJourneyParams,
    @Query(zod(AbhaMatchQuerySchema)) query: AbhaMatchQuery,
  ): Promise<AbhaMatches> {
    return this.enrolments.matches(actor, params.journeyId, query.mrn);
  }

  @Post(':journeyId/save')
  @HttpCode(200)
  @ApiOperation({ summary: 'Link the ABHA to an existing record, or create one when none matches' })
  save(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(AbhaJourneyParamsSchema)) params: AbhaJourneyParams,
    @Body(zod(SaveAbhaEnrolmentSchema)) body: SaveAbhaEnrolment,
  ): Promise<PatientRegistrationResult> {
    return this.enrolments.saveToRecord(actor, meta, params.journeyId, body);
  }
}

/**
 * The three logins for someone who may already hold an ABHA. After a login is
 * verified, the profile, the card, the returning-patient check and saving use
 * the journey routes under `abha/enrolments`, which serve logins as well.
 */
@ApiTags('abha')
@Roles('FRONT_DESK', 'CARE_TEAM')
@Controller({ path: 'abha/logins', version: '1' })
export class AbhaLoginController {
  constructor(private readonly logins: AbhaLoginService) {}

  @Post('address-methods')
  @HttpCode(200)
  @ApiOperation({ summary: 'The login methods an ABHA address offers' })
  addressMethods(
    @CurrentActor() actor: ActorContext,
    @Body(zod(AbhaAddressSearchSchema)) body: AbhaAddressSearch,
  ): Promise<AbhaAddressMethods> {
    return this.logins.addressMethods(actor, body.abhaAddress);
  }

  @Post('mobile-search')
  @HttpCode(200)
  @ApiOperation({ summary: 'List the ABHAs a mobile holds; no OTP is sent' })
  mobileSearch(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Body(zod(AbhaMobileSearchSchema)) body: AbhaMobileSearch,
  ): Promise<AbhaMobileSearchResult> {
    return this.logins.searchMobile(actor, meta, body.mobile);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Send the OTP for a login by ABHA number, ABHA address, Aadhaar or a searched mobile',
  })
  start(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Body(zod(StartAbhaLoginSchema)) body: StartAbhaLogin,
  ): Promise<AbhaOtpChallenge> {
    return this.logins.start(actor, meta, body);
  }

  @Post(':journeyId/resend')
  @HttpCode(200)
  @ApiOperation({ summary: 'Resend the login OTP (after 60 seconds, twice at most)' })
  resend(
    @CurrentActor() actor: ActorContext,
    @Param(zod(AbhaJourneyParamsSchema)) params: AbhaJourneyParams,
    @Body(zod(ResendAbhaLoginSchema)) body: ResendAbhaLogin,
  ): Promise<AbhaOtpChallenge> {
    return this.logins.resend(actor, params.journeyId, body.value);
  }

  @Post(':journeyId/verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify the login OTP and fetch the ABHA account' })
  verify(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(AbhaJourneyParamsSchema)) params: AbhaJourneyParams,
    @Body(zod(VerifyAbhaLoginSchema)) body: VerifyAbhaLogin,
  ): Promise<AbhaLoginView> {
    return this.logins.verify(actor, meta, params.journeyId, body.otp);
  }

  @Post(':journeyId/mobile-update')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send an OTP to put the desk’s mobile on the ABHA profile' })
  mobileUpdate(
    @CurrentActor() actor: ActorContext,
    @Param(zod(AbhaJourneyParamsSchema)) params: AbhaJourneyParams,
    @Body(zod(UpdateAbhaMobileSchema)) body: UpdateAbhaMobile,
  ): Promise<AbhaOtpChallenge> {
    return this.logins.requestMobileUpdate(actor, params.journeyId, body.mobile);
  }

  @Post(':journeyId/mobile-update/verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify the mobile update OTP' })
  verifyMobileUpdate(
    @CurrentActor() actor: ActorContext,
    @CurrentMeta() meta: RequestMeta,
    @Param(zod(AbhaJourneyParamsSchema)) params: AbhaJourneyParams,
    @Body(zod(VerifyMobileOtpSchema)) body: VerifyMobileOtp,
  ): Promise<AbhaMobileVerification> {
    return this.logins.verifyMobileUpdate(actor, meta, params.journeyId, body.otp);
  }
}

@Module({
  imports: [PatientsModule],
  controllers: [AbhaController, AbhaLoginController],
  providers: [AbhaJourneyStore, AbhaEnrolmentService, AbhaLoginService],
})
export class AbhaModule {}

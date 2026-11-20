import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  abhaLoginMethodsFrom,
  type AbhaAddressMethods,
  type AbhaLoginView,
  type AbhaMobileVerification,
  type AbhaOtpChallenge,
  type StartAbhaLogin,
} from '@healthguard/shared';
import type { ActorContext, RequestMeta } from '../../common/actor.js';
import { Problems } from '../../common/problem.js';
import { AuditService } from '../audit/audit.service.js';
import {
  ABHA_ENROLLMENT_CONSENT,
  AbhaEnrollmentClient,
  type AbhaProfile,
  type OtpChallenge,
} from './abha-enrollment.client.js';
import { lastTenDigits, profileView } from './abha-enrolment.service.js';
import { AbhaJourneyStore, type Journey } from './abha-journey.store.js';
import { AbhaLoginClient, type LoginResult, type OtpSystem } from './abha-login.client.js';
import { AbdmApiError } from './abdm-http.client.js';

/** ABDM's code for "nobody holds an ABHA for this identifier". Only this means there is none. */
const NO_ABHA = 'ABDM-1114';

/**
 * The three logins the front desk can run for someone who may already hold an
 * ABHA: by ABHA number, by ABHA address, and by Aadhaar number. A login ends
 * in the same journey state as Create ABHA, so the profile, the card, the
 * returning-patient check and saving are the same routes for both.
 */
@Injectable()
export class AbhaLoginService {
  constructor(
    private readonly store: AbhaJourneyStore,
    private readonly audit: AuditService,
  ) {}

  private get client(): AbhaLoginClient {
    return new AbhaLoginClient(this.store.requireGateway());
  }

  /** Which login methods an ABHA address offers. The screen shows these and no others. */
  async addressMethods(actor: ActorContext, abhaAddress: string): Promise<AbhaAddressMethods> {
    await this.store.requireClinic(actor);
    const client = this.client;
    const found = await this.store.abdm(() => client.searchAddress(abhaAddress));
    return {
      methods: abhaLoginMethodsFrom(found.authMethods),
      offeredByAbdm: found.authMethods,
    };
  }

  /** Sends the OTP for a login. For an Aadhaar number, the consent is recorded first. */
  async start(
    actor: ActorContext,
    meta: RequestMeta,
    input: StartAbhaLogin,
  ): Promise<AbhaOtpChallenge> {
    const organizationId = await this.store.requireClinic(actor);
    const journeyId = randomUUID();
    const otpSystem: OtpSystem =
      input.identifier === 'AADHAAR' || input.method === 'AADHAAR_OTP' ? 'aadhaar' : 'abdm';
    if (input.identifier === 'AADHAAR') {
      await this.audit.record({
        actor,
        meta,
        organizationId,
        action: 'CONSENT_GRANT',
        resourceType: 'AbhaEnrolmentConsent',
        resourceId: journeyId,
        decision: 'ALLOW',
        metadata: {
          terms: ABHA_ENROLLMENT_CONSENT.code,
          termsVersion: ABHA_ENROLLMENT_CONSENT.version,
          declarations: ['aadhaarSharing', 'recordsLinking', 'recordsSharing', 'anonymizedUse'],
          workerConfirmed: true,
          beneficiaryConfirmed: true,
          purpose: 'login',
        },
      });
    }
    const sent = await this.send(input.identifier, input.value, otpSystem);
    const journey: Journey = {
      id: journeyId,
      organizationId,
      userId: actor.userId,
      kind: input.identifier,
      otpSystem,
      otp: { txnId: sent.txnId, sentAt: Date.now(), resends: 0 },
      mobile: null,
      communicationMobile: input.deskMobile ?? null,
      mobileVerified: false,
      txnId: sent.txnId,
      userToken: null,
      isNew: null,
      profile: null,
      savedPatientId: null,
    };
    await this.store.save(journey);
    return this.store.challenge(journey, journey.otp, sent.message);
  }

  /** A resend is a fresh send; the OTP is then verified against the newest transaction. */
  async resend(actor: ActorContext, journeyId: string, value: string): Promise<AbhaOtpChallenge> {
    const journey = await this.loginJourney(actor, journeyId);
    this.store.checkResend(journey.otp);
    const sent = await this.send(journey.kind, value, journey.otpSystem ?? 'aadhaar');
    journey.otp = { txnId: sent.txnId, sentAt: Date.now(), resends: journey.otp.resends + 1 };
    journey.txnId = sent.txnId;
    await this.store.save(journey);
    return this.store.challenge(journey, journey.otp, sent.message);
  }

  /**
   * Verifies the OTP. A wrong OTP keeps the transaction. For an Aadhaar number,
   * "no ABHA" is an outcome with ABDM's own message, not an error, so the desk
   * can be offered creation.
   */
  async verify(
    actor: ActorContext,
    meta: RequestMeta,
    journeyId: string,
    otp: string,
  ): Promise<AbhaLoginView> {
    const journey = await this.loginJourney(actor, journeyId);
    const client = this.client;
    const otpSystem = journey.otpSystem ?? 'aadhaar';
    let result: LoginResult;
    try {
      result = await this.store.abdm(async () => {
        try {
          return journey.kind === 'ABHA_ADDRESS'
            ? await client.verifyAddressOtp({ txnId: journey.otp.txnId, otp, otpSystem })
            : await client.verifyOtp({ txnId: journey.otp.txnId, otp, otpSystem });
        } catch (error) {
          if (journey.kind === 'AADHAAR' && error instanceof AbdmApiError && error.is(NO_ABHA)) {
            throw new NoAbha(error.abdmMessage);
          }
          throw error;
        }
      });
    } catch (error) {
      if (!(error instanceof NoAbha)) throw error;
      await this.record(actor, meta, journey, 'NO_ABHA');
      return {
        journeyId: journey.id,
        outcome: 'NO_ABHA',
        message: error.abdmMessage,
        profile: null,
        accounts: 0,
        mobileUpdate: 'NOT_NEEDED',
      };
    }
    // A 200 can still say the OTP did not match: ABDM's message is passed on as it came.
    if (!result.verified) throw Problems.abdmRefused(result.message, null);
    const account = result.accounts[0];
    if (!account || !result.userToken) {
      throw Problems.abdmRefused(result.message ?? 'The login returned no ABHA account.', null);
    }
    journey.userToken = result.userToken;
    journey.profile = await this.withFullProfile(journey.kind, result.userToken, account);
    journey.isNew = false;
    await this.store.save(journey);
    await this.record(actor, meta, journey, 'VERIFIED');
    return {
      journeyId: journey.id,
      outcome: 'VERIFIED',
      message: result.message,
      profile: profileView(journey.profile),
      accounts: result.accounts.length,
      mobileUpdate: this.mobileUpdate(journey),
    };
  }

  /** The desk said Yes: send an OTP to the mobile HealthGuard holds, to put it on the ABHA profile. */
  async requestMobileUpdate(
    actor: ActorContext,
    journeyId: string,
    mobile: string,
  ): Promise<AbhaOtpChallenge> {
    const journey = await this.store.verified(actor, journeyId);
    const token = this.updateToken(journey);
    if (journey.mobile && journey.communicationMobile === mobile) {
      this.store.checkResend(journey.mobile);
    }
    const client = this.client;
    const sent = await this.store.abdm(() => client.requestMobileUpdateOtp(token, mobile));
    journey.mobile = {
      txnId: sent.txnId,
      sentAt: Date.now(),
      resends:
        journey.mobile && journey.communicationMobile === mobile ? journey.mobile.resends + 1 : 0,
    };
    journey.communicationMobile = mobile;
    await this.store.save(journey);
    return this.store.challenge(journey, journey.mobile, sent.message);
  }

  /** The update is done only when ABDM says so; a wrong OTP leaves the profile as it was. */
  async verifyMobileUpdate(
    actor: ActorContext,
    meta: RequestMeta,
    journeyId: string,
    otp: string,
  ): Promise<AbhaMobileVerification> {
    const journey = await this.store.verified(actor, journeyId);
    const token = this.updateToken(journey);
    const challenge = journey.mobile;
    if (!challenge) throw Problems.conflict('Send the mobile OTP first.');
    const client = this.client;
    const outcome = await this.store.abdm(() =>
      client.verifyMobileUpdateOtp(token, challenge.txnId, otp),
    );
    if (outcome.verified) {
      journey.mobileVerified = true;
      if (journey.profile) journey.profile.mobile = journey.communicationMobile;
      await this.store.save(journey);
      await this.audit.record({
        actor,
        meta,
        organizationId: journey.organizationId,
        action: 'UPDATE',
        resourceType: 'AbhaProfile',
        resourceId: journey.id,
        decision: 'ALLOW',
        metadata: { field: 'mobile' },
      });
    }
    return outcome;
  }

  private send(kind: Journey['kind'], value: string, otpSystem: OtpSystem): Promise<OtpChallenge> {
    const client = this.client;
    return this.store.abdm(() =>
      kind === 'ABHA_ADDRESS'
        ? client.requestAddressOtp(value, otpSystem)
        : client.requestOtp({
            identifier: kind === 'AADHAAR' ? 'aadhaar' : 'abha-number',
            value,
            otpSystem,
          }),
    );
  }

  private async loginJourney(actor: ActorContext, journeyId: string): Promise<Journey> {
    const journey = await this.store.load(actor, journeyId);
    if (journey.kind === 'CREATE') throw Problems.notFound('ABHA login');
    return journey;
  }

  /**
   * A login answers with a short account summary. The full profile adds the
   * date of birth, the address and the mobile, which the registration form and
   * the mobile comparison need. If that read fails the login still stands.
   */
  private async withFullProfile(
    kind: Journey['kind'],
    token: string,
    account: AbhaProfile,
  ): Promise<AbhaProfile> {
    const gateway = this.store.requireGateway();
    try {
      const full =
        kind === 'ABHA_ADDRESS'
          ? await new AbhaLoginClient(gateway).addressProfile(token)
          : await new AbhaEnrollmentClient(gateway).profile(token);
      return {
        ...account,
        ...Object.fromEntries(
          Object.entries(full).filter(
            ([, value]) => value !== null && !(Array.isArray(value) && value.length === 0),
          ),
        ),
      };
    } catch (error) {
      if (error instanceof AbdmApiError) return account;
      throw error;
    }
  }

  private mobileUpdate(journey: Journey): AbhaLoginView['mobileUpdate'] {
    const desk = journey.communicationMobile;
    const onAbha = lastTenDigits(journey.profile?.mobile ?? null);
    // With no mobile read from the ABHA there is nothing to compare, so nothing is offered.
    if (!desk || onAbha.length !== 10 || onAbha === desk) return 'NOT_NEEDED';
    // No published call updates the mobile with an ABHA-address login's token.
    return journey.kind === 'ABHA_ADDRESS' ? 'NOT_AVAILABLE' : 'OFFER';
  }

  private updateToken(journey: Journey): string {
    if (journey.kind === 'CREATE') throw Problems.notFound('ABHA login');
    if (journey.kind === 'ABHA_ADDRESS') {
      throw Problems.conflict(
        'The mobile on the ABHA profile cannot be updated from an ABHA address login.',
      );
    }
    if (!journey.userToken) throw Problems.conflict('Verify the OTP first.');
    return journey.userToken;
  }

  private record(
    actor: ActorContext,
    meta: RequestMeta,
    journey: Journey,
    outcome: 'VERIFIED' | 'NO_ABHA',
  ): Promise<void> {
    return this.audit.record({
      actor,
      meta,
      organizationId: journey.organizationId,
      action: 'READ',
      resourceType: 'AbhaLogin',
      resourceId: journey.id,
      decision: 'ALLOW',
      // Codes only: never the identifier that was looked up.
      metadata: { route: journey.kind, otpSystem: journey.otpSystem, outcome },
    });
  }
}

/** Carries ABDM's "no ABHA for this Aadhaar" message out of the call. */
class NoAbha extends Error {
  constructor(readonly abdmMessage: string | null) {
    super('No ABHA for this Aadhaar');
  }
}

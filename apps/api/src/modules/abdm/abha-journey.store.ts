import { Inject, Injectable } from '@nestjs/common';
import { ABHA_OTP_RULES, ABHA_TEXT, type AbhaOtpChallenge } from '@healthguard/shared';
import { requireOrganization, type ActorContext } from '../../common/actor.js';
import { Problems } from '../../common/problem.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { RedisService } from '../../infrastructure/redis/redis.service.js';
import type { AbhaProfile } from './abha-enrollment.client.js';
import { AbdmApiError } from './abdm-http.client.js';
import { ABDM_GATEWAY, type AbdmGateway } from './abdm.module.js';

/** How long a journey may sit between steps before it has to start again. */
const JOURNEY_TTL_SECONDS = 30 * 60;
const KEY = (journeyId: string) => `abha:journey:${journeyId}`;
const SEARCH_KEY = (searchId: string) => `abha:mobile-search:${searchId}`;

/**
 * One search by mobile, kept so the OTP can be requested for an account it
 * listed and for no other. It holds ABDM's transaction and the listed
 * indexes: never the mobile number, a name or an ABHA number.
 */
export interface MobileSearch {
  id: string;
  organizationId: string;
  userId: string;
  txnId: string;
  indexes: number[];
}

export interface OtpState {
  txnId: string;
  sentAt: number;
  resends: number;
}

/** How the person is being identified in a login journey. */
export type LoginRoute = 'ABHA_NUMBER' | 'ABHA_ADDRESS' | 'AADHAAR' | 'MOBILE';

/**
 * One front-desk ABHA journey, creation or login, held in Redis for half an
 * hour and never in the database. It never holds an Aadhaar number or an OTP.
 * It does hold ABDM's user token and the profile until the desk saves or the
 * journey expires.
 */
export interface Journey {
  id: string;
  organizationId: string;
  userId: string;
  /** `CREATE` for Create ABHA; otherwise the login route. */
  kind: 'CREATE' | LoginRoute;
  /** For a login: whether the OTP went to the Aadhaar-linked or the ABHA-linked mobile. */
  otpSystem: 'aadhaar' | 'abdm' | null;
  /** After a search by mobile: the search transaction and the account chosen from it. */
  search?: { txnId: string; index: number };
  /** The OTP that opens the journey. */
  otp: OtpState;
  /** A second OTP: the communication mobile on creation, or a mobile update after a login. */
  mobile: OtpState | null;
  communicationMobile: string | null;
  mobileVerified: boolean;
  txnId: string;
  userToken: string | null;
  isNew: boolean | null;
  profile: AbhaProfile | null;
  savedPatientId: string | null;
}

/** Journey state and the rules every ABHA journey shares. */
@Injectable()
export class AbhaJourneyStore {
  constructor(
    @Inject(ABDM_GATEWAY) private readonly gateway: AbdmGateway | null,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** The ABDM connection, or a clear refusal where none is configured. */
  requireGateway(): AbdmGateway {
    if (!this.gateway) {
      throw Problems.serviceUnavailable('ABDM is not connected in this environment.');
    }
    return this.gateway;
  }

  /** Real identities never enter a demo organization. */
  async requireClinic(actor: ActorContext): Promise<string> {
    const organizationId = requireOrganization(actor);
    const organization = await this.prisma.db.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
    });
    if (!organization) throw Problems.notFound('organization');
    if (organization.isDemo) {
      throw Problems.forbidden('ABHA journeys are not available in a demo organization.');
    }
    return organizationId;
  }

  async load(actor: ActorContext, journeyId: string): Promise<Journey> {
    const organizationId = requireOrganization(actor);
    const raw = await this.redis.client.get(KEY(journeyId));
    const journey = raw ? (JSON.parse(raw) as Journey) : null;
    // Another desk's or another clinic's journey reads as not found.
    if (!journey || journey.organizationId !== organizationId || journey.userId !== actor.userId) {
      throw Problems.notFound('ABHA journey (it may have expired; start again)');
    }
    return journey;
  }

  async saveSearch(search: MobileSearch): Promise<void> {
    await this.redis.client.set(
      SEARCH_KEY(search.id),
      JSON.stringify(search),
      'EX',
      JOURNEY_TTL_SECONDS,
    );
  }

  async loadSearch(actor: ActorContext, searchId: string): Promise<MobileSearch> {
    const organizationId = requireOrganization(actor);
    const raw = await this.redis.client.get(SEARCH_KEY(searchId));
    const search = raw ? (JSON.parse(raw) as MobileSearch) : null;
    if (!search || search.organizationId !== organizationId || search.userId !== actor.userId) {
      throw Problems.notFound('ABHA search (it may have expired; search again)');
    }
    return search;
  }

  /** A journey whose OTP has been verified, so it holds a profile. */
  async verified(actor: ActorContext, journeyId: string): Promise<Journey> {
    const journey = await this.load(actor, journeyId);
    if (!journey.profile) throw Problems.conflict('Verify the OTP first.');
    return journey;
  }

  async save(journey: Journey): Promise<void> {
    await this.redis.client.set(
      KEY(journey.id),
      JSON.stringify(journey),
      'EX',
      JOURNEY_TTL_SECONDS,
    );
  }

  challenge(journey: Journey, state: OtpState, message: string | null): AbhaOtpChallenge {
    return {
      journeyId: journey.id,
      message,
      resendsLeft: Math.max(ABHA_OTP_RULES.maxResends - state.resends, 0),
      resendAvailableAt: new Date(
        state.sentAt + ABHA_OTP_RULES.resendWaitSeconds * 1000,
      ).toISOString(),
    };
  }

  /** At most two resends, each at least 60 seconds after the last send. A refusal calls nothing. */
  checkResend(state: OtpState): void {
    if (state.resends >= ABHA_OTP_RULES.maxResends) throw Problems.conflict(ABHA_TEXT.resendLimit);
    const wait = state.sentAt + ABHA_OTP_RULES.resendWaitSeconds * 1000 - Date.now();
    if (wait > 0) {
      throw Problems.conflict(`Resend is available in ${Math.ceil(wait / 1000)} seconds.`);
    }
  }

  /** Turns an ABDM refusal into a problem that carries ABDM's own message, unchanged. */
  async abdm<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      if (!(error instanceof AbdmApiError)) throw error;
      if (error.status === 0) throw Problems.serviceUnavailable('ABDM could not be reached.');
      if (error.status === 401 && error.code !== 'ABDM-1017') this.gateway?.session.invalidate();
      throw Problems.abdmRefused(error.abdmMessage, error.code);
    }
  }
}

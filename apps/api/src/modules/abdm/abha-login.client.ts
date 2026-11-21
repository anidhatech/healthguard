import type { AbdmGateway } from './abdm.module.js';
import { readAbhaProfile, type AbhaProfile, type OtpChallenge } from './abha-enrollment.client.js';
import { AbdmApiError } from './abdm-http.client.js';

const LOGIN = '/abha/api/v3/profile/login';
const ACCOUNT = '/abha/api/v3/profile/account';
const PHR = '/abha/api/v3/phr/web/login';

/** Where the OTP goes: the Aadhaar-linked mobile, or the mobile linked to the ABHA. */
export type OtpSystem = 'aadhaar' | 'abdm';
/** What the person gave to be looked up by. */
export type LoginIdentifier = 'abha-number' | 'aadhaar';

const verifyScope = (otpSystem: OtpSystem) =>
  otpSystem === 'aadhaar' ? 'aadhaar-verify' : 'mobile-verify';

export interface LoginResult {
  txnId: string | null;
  /** The body decides: a 200 can still say the OTP did not match. */
  verified: boolean;
  message: string | null;
  /** The user token for profile and card calls, sent as `X-token`. */
  userToken: string | null;
  refreshToken: string | null;
  /** Read as plural: one login can return several accounts. */
  accounts: AbhaProfile[];
}

export interface AddressSearchResult {
  /** The login methods this ABHA address offers, exactly as ABDM names them. */
  authMethods: string[];
  /** Every other field of the search answer, for the screen to show if useful. */
  status: string | null;
}

type Json = Record<string, unknown>;

function object(value: unknown): Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Json)
    : {};
}

function text(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return null;
}

function challenge(body: unknown, requestId: string, path: string): OtpChallenge {
  const row = object(body);
  const txnId = text(row.txnId);
  if (!txnId) throw new AbdmApiError(200, null, 'The response carried no txnId', requestId, path);
  return { txnId, message: text(row.message) };
}

/**
 * ABDM writes an ABHA number as `XX-XXXX-XXXX-XXXX`. Fourteen bare digits are
 * put in that form before they are sent; anything else goes as it was typed,
 * so a value ABDM would accept is never altered.
 */
export function formatAbhaNumber(value: string): string {
  const typed = value.trim();
  const digits = typed.replace(/[\s-]+/g, '');
  return /^[0-9]{14}$/.test(digits)
    ? `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}-${digits.slice(10)}`
    : typed;
}

/** Reads a verify answer whether its token sits at the top level or under `tokens`. */
export function readLoginResult(body: unknown): LoginResult {
  const row = object(body);
  const tokens = object(row.tokens);
  const outcome = text(row.authResult);
  const userToken = text(row.token, tokens.token);
  // An ABHA-number or Aadhaar login lists `accounts`; an ABHA-address login lists `users`.
  const listed = Array.isArray(row.accounts) ? row.accounts : row.users;
  const accounts = Array.isArray(listed) ? listed.map(readAbhaProfile) : [];
  return {
    txnId: text(row.txnId),
    // With no `authResult`, a token is what shows the login went through.
    verified: outcome ? outcome.toLowerCase() === 'success' : Boolean(userToken),
    message: text(row.message),
    userToken,
    refreshToken: text(row.refreshToken, tokens.refreshToken),
    accounts,
  };
}

/**
 * The calls of the three logins (ABHA number, ABHA address, Aadhaar number)
 * and of the mobile update a login can offer. Sensitive values are encrypted
 * here, just before they are sent, and are never logged or kept.
 */
export class AbhaLoginClient {
  constructor(private readonly gateway: AbdmGateway) {}

  /** Login by ABHA number or by Aadhaar number: sends the OTP. A resend is another send. */
  async requestOtp(input: {
    identifier: LoginIdentifier;
    value: string;
    otpSystem: OtpSystem;
  }): Promise<OtpChallenge> {
    const path = `${LOGIN}/request/otp`;
    const { body, requestId } = await this.gateway.http.request({
      host: 'abha',
      method: 'POST',
      path,
      accessToken: await this.gateway.session.accessToken(),
      body: {
        scope: ['abha-login', verifyScope(input.otpSystem)],
        loginHint: input.identifier,
        loginId: await this.gateway.crypto.encrypt(
          input.identifier === 'abha-number' ? formatAbhaNumber(input.value) : input.value,
        ),
        otpSystem: input.otpSystem,
      },
    });
    return challenge(body, requestId, path);
  }

  /** For the sandbox run script only: sends an ABHA number exactly as given, unformatted. */
  async requestOtpRaw(value: string, otpSystem: OtpSystem): Promise<OtpChallenge> {
    const path = `${LOGIN}/request/otp`;
    const { body, requestId } = await this.gateway.http.request({
      host: 'abha',
      method: 'POST',
      path,
      accessToken: await this.gateway.session.accessToken(),
      body: {
        scope: ['abha-login', verifyScope(otpSystem)],
        loginHint: 'abha-number',
        loginId: await this.gateway.crypto.encrypt(value),
        otpSystem,
      },
    });
    return challenge(body, requestId, path);
  }

  async verifyOtp(input: {
    txnId: string;
    otp: string;
    otpSystem: OtpSystem;
  }): Promise<LoginResult> {
    const { body } = await this.gateway.http.request({
      host: 'abha',
      method: 'POST',
      path: `${LOGIN}/verify`,
      accessToken: await this.gateway.session.accessToken(),
      body: {
        scope: ['abha-login', verifyScope(input.otpSystem)],
        authData: {
          authMethods: ['otp'],
          otp: { txnId: input.txnId, otpValue: await this.gateway.crypto.encrypt(input.otp) },
        },
      },
    });
    return readLoginResult(body);
  }

  /** Asks which login methods an ABHA address offers. The screen shows those and no others. */
  async searchAddress(abhaAddress: string): Promise<AddressSearchResult> {
    const { body } = await this.gateway.http.request({
      host: 'abha',
      method: 'POST',
      path: `${PHR}/abha/search`,
      accessToken: await this.gateway.session.accessToken(),
      body: { abhaAddress },
    });
    const row = object(body);
    return {
      authMethods: Array.isArray(row.authMethods)
        ? row.authMethods.filter((item): item is string => typeof item === 'string')
        : [],
      status: text(row.status),
    };
  }

  async requestAddressOtp(abhaAddress: string, otpSystem: OtpSystem): Promise<OtpChallenge> {
    const path = `${PHR}/abha/request/otp`;
    const { body, requestId } = await this.gateway.http.request({
      host: 'abha',
      method: 'POST',
      path,
      accessToken: await this.gateway.session.accessToken(),
      body: {
        scope: ['abha-address-login', verifyScope(otpSystem)],
        loginHint: 'abha-address',
        loginId: await this.gateway.crypto.encrypt(abhaAddress),
        otpSystem,
      },
    });
    return challenge(body, requestId, path);
  }

  async verifyAddressOtp(input: {
    txnId: string;
    otp: string;
    otpSystem: OtpSystem;
  }): Promise<LoginResult> {
    const { body } = await this.gateway.http.request({
      host: 'abha',
      method: 'POST',
      path: `${PHR}/abha/verify`,
      accessToken: await this.gateway.session.accessToken(),
      body: {
        scope: ['abha-address-login', verifyScope(input.otpSystem)],
        authData: {
          authMethods: ['otp'],
          otp: { txnId: input.txnId, otpValue: await this.gateway.crypto.encrypt(input.otp) },
        },
      },
    });
    return readLoginResult(body);
  }

  /** The profile behind an ABHA-address login, read with that login's own token. */
  async addressProfile(userToken: string): Promise<AbhaProfile> {
    const { body } = await this.gateway.http.request({
      host: 'abha',
      method: 'GET',
      path: `${PHR}/profile/abha-profile`,
      accessToken: await this.gateway.session.accessToken(),
      userToken,
    });
    return readAbhaProfile(body);
  }

  /** The card for an ABHA-address login, as ABDM returns it. */
  async addressCard(userToken: string): Promise<{ bytes: Buffer; contentType: string | null }> {
    const { bytes, contentType } = await this.gateway.http.requestBinary({
      host: 'abha',
      method: 'GET',
      path: `${PHR}/profile/abha/phr-card`,
      accessToken: await this.gateway.session.accessToken(),
      userToken,
    });
    return { bytes, contentType };
  }

  /** Starts changing the mobile on the ABHA profile, with the token of an ABHA-number or Aadhaar login. */
  async requestMobileUpdateOtp(userToken: string, mobile: string): Promise<OtpChallenge> {
    const path = `${ACCOUNT}/request/otp`;
    const { body, requestId } = await this.gateway.http.request({
      host: 'abha',
      method: 'POST',
      path,
      accessToken: await this.gateway.session.accessToken(),
      userToken,
      body: {
        scope: ['abha-profile', 'mobile-verify'],
        loginHint: 'mobile',
        loginId: await this.gateway.crypto.encrypt(mobile),
        otpSystem: 'abdm',
      },
    });
    return challenge(body, requestId, path);
  }

  async verifyMobileUpdateOtp(
    userToken: string,
    txnId: string,
    otp: string,
  ): Promise<{ verified: boolean; message: string | null }> {
    const { body } = await this.gateway.http.request({
      host: 'abha',
      method: 'POST',
      path: `${ACCOUNT}/verify`,
      accessToken: await this.gateway.session.accessToken(),
      userToken,
      body: {
        scope: ['abha-profile', 'mobile-verify'],
        authData: {
          authMethods: ['otp'],
          otp: { txnId, otpValue: await this.gateway.crypto.encrypt(otp) },
        },
      },
    });
    const row = object(body);
    const outcome = text(row.authResult);
    return {
      verified: outcome ? outcome.toLowerCase() === 'success' : false,
      message: text(row.message),
    };
  }
}

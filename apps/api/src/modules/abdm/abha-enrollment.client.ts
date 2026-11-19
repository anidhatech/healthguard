import type { AbdmGateway } from './abdm.module.js';
import { AbdmApiError } from './abdm-http.client.js';

const ENROLLMENT = '/abha/api/v3/enrollment';
const PROFILE = '/abha/api/v3/profile';

/** Agreement to ABDM's terms and conditions for ABHA enrolment, as `enrol/byAadhaar` records it. */
export const ABHA_ENROLLMENT_CONSENT = { code: 'abha-enrollment', version: '1.4' } as const;

export interface OtpChallenge {
  /** Carried through every later call of the journey, including a resend. */
  txnId: string;
  /** ABDM's own words, with the masked mobile the OTP went to. Shown as it came. */
  message: string | null;
}

/** The profile ABDM returns with an enrolment or a profile read. Every field is optional. */
export interface AbhaProfile {
  abhaNumber: string | null;
  abhaAddresses: string[];
  preferredAbhaAddress: string | null;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  /** As ABDM sends it; the format is not assumed here. */
  dateOfBirth: string | null;
  gender: string | null;
  mobile: string | null;
  email: string | null;
  address: string | null;
  districtName: string | null;
  stateName: string | null;
  pinCode: string | null;
  /** Base64 image, when ABDM sends one. */
  photo: string | null;
  abhaStatus: string | null;
}

export interface EnrolmentResult {
  txnId: string | null;
  /** `false` means the Aadhaar already held an ABHA. It is not an error: the journey carries on. */
  isNew: boolean;
  message: string | null;
  /** The user token for profile and card calls, sent as `X-token`. */
  userToken: string | null;
  refreshToken: string | null;
  profile: AbhaProfile;
}

export interface MobileVerification {
  txnId: string | null;
  verified: boolean;
  message: string | null;
}

export interface AbhaAddressResult {
  txnId: string | null;
  abhaNumber: string | null;
  preferredAbhaAddress: string | null;
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
    if (typeof value === 'number') return String(value);
  }
  return null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [];
}

/** Reads a profile whether its keys come as the enrolment or the profile call writes them. */
export function readAbhaProfile(source: unknown): AbhaProfile {
  const row = object(source);
  const addresses = strings(row.phrAddress).concat(strings(row.abhaAddresses));
  const preferred = text(row.preferredAbhaAddress, row.preferredAddress, addresses[0]);
  return {
    abhaNumber: text(row.ABHANumber, row.abhaNumber, row.healthIdNumber),
    abhaAddresses: addresses,
    preferredAbhaAddress: preferred,
    firstName: text(row.firstName, row.name),
    middleName: text(row.middleName),
    lastName: text(row.lastName),
    dateOfBirth: text(row.dob, row.dateOfBirth, row.yearOfBirth),
    gender: text(row.gender),
    mobile: text(row.mobile),
    email: text(row.email),
    address: text(row.address),
    districtName: text(row.districtName),
    stateName: text(row.stateName),
    pinCode: text(row.pinCode, row.pincode),
    photo: text(row.photo, row.profilePhoto),
    abhaStatus: text(row.abhaStatus, row.status),
  };
}

function challenge(body: unknown, requestId: string, path: string): OtpChallenge {
  const row = object(body);
  const txnId = text(row.txnId);
  if (!txnId) throw new AbdmApiError(200, null, 'The response carried no txnId', requestId, path);
  return { txnId, message: text(row.message) };
}

/**
 * The calls of "Create ABHA by Aadhaar OTP" and the ABHA card and profile.
 * Sensitive values are encrypted here, in this process, just before they are
 * sent, and are never logged or kept.
 */
export class AbhaEnrollmentClient {
  constructor(private readonly gateway: AbdmGateway) {}

  /** Sends the Aadhaar OTP. Pass the first send's `txnId` to resend within the same transaction. */
  async requestAadhaarOtp(aadhaarNumber: string, txnId = ''): Promise<OtpChallenge> {
    const path = `${ENROLLMENT}/request/otp`;
    const { body, requestId } = await this.gateway.http.request({
      host: 'abha',
      method: 'POST',
      path,
      accessToken: await this.gateway.session.accessToken(),
      body: {
        txnId,
        scope: ['abha-enrol'],
        loginHint: 'aadhaar',
        loginId: await this.gateway.crypto.encrypt(aadhaarNumber),
        otpSystem: 'aadhaar',
      },
    });
    return challenge(body, requestId, path);
  }

  /** Verifies the Aadhaar OTP and creates the ABHA, or returns the one the Aadhaar already holds. */
  async enrolByAadhaar(input: {
    txnId: string;
    otp: string;
    /** The communication mobile, sent plain as the specification writes it. */
    mobile: string;
  }): Promise<EnrolmentResult> {
    const { body } = await this.gateway.http.request({
      host: 'abha',
      method: 'POST',
      path: `${ENROLLMENT}/enrol/byAadhaar`,
      accessToken: await this.gateway.session.accessToken(),
      body: {
        authData: {
          authMethods: ['otp'],
          otp: {
            txnId: input.txnId,
            otpValue: await this.gateway.crypto.encrypt(input.otp),
            mobile: input.mobile,
          },
        },
        consent: ABHA_ENROLLMENT_CONSENT,
      },
    });
    const row = object(body);
    const tokens = object(row.tokens);
    return {
      txnId: text(row.txnId),
      isNew: row.isNew !== false,
      message: text(row.message),
      userToken: text(tokens.token),
      refreshToken: text(tokens.refreshToken),
      profile: readAbhaProfile(row.ABHAProfile),
    };
  }

  /** Sends an OTP to a communication mobile that is not the Aadhaar-linked one. */
  async requestMobileOtp(txnId: string, mobile: string): Promise<OtpChallenge> {
    const path = `${ENROLLMENT}/request/otp`;
    const { body, requestId } = await this.gateway.http.request({
      host: 'abha',
      method: 'POST',
      path,
      accessToken: await this.gateway.session.accessToken(),
      body: {
        txnId,
        scope: ['abha-enrol', 'mobile-verify'],
        loginHint: 'mobile',
        loginId: await this.gateway.crypto.encrypt(mobile),
        otpSystem: 'abdm',
      },
    });
    return challenge(body, requestId, path);
  }

  async verifyMobileOtp(txnId: string, otp: string): Promise<MobileVerification> {
    const { body } = await this.gateway.http.request({
      host: 'abha',
      method: 'POST',
      path: `${ENROLLMENT}/auth/byAbdm`,
      accessToken: await this.gateway.session.accessToken(),
      body: {
        scope: ['abha-enrol', 'mobile-verify'],
        authData: {
          authMethods: ['otp'],
          otp: { txnId, otpValue: await this.gateway.crypto.encrypt(otp) },
        },
      },
    });
    const row = object(body);
    const outcome = text(row.authResult);
    return {
      txnId: text(row.txnId),
      // A 200 can still say the OTP did not match, so the body decides.
      verified: outcome ? outcome.toLowerCase() === 'success' : false,
      message: text(row.message),
    };
  }

  async addressSuggestions(txnId: string): Promise<string[]> {
    const { body } = await this.gateway.http.request({
      host: 'abha',
      method: 'GET',
      path: `${ENROLLMENT}/enrol/suggestion`,
      accessToken: await this.gateway.session.accessToken(),
      headers: { TRANSACTION_ID: txnId },
    });
    return strings(object(body).abhaAddressList);
  }

  async createAddress(txnId: string, abhaAddress: string): Promise<AbhaAddressResult> {
    const { body } = await this.gateway.http.request({
      host: 'abha',
      method: 'POST',
      path: `${ENROLLMENT}/enrol/abha-address`,
      accessToken: await this.gateway.session.accessToken(),
      body: { txnId, abhaAddress, preferred: 1 },
    });
    const row = object(body);
    return {
      txnId: text(row.txnId),
      abhaNumber: text(row.healthIdNumber, row.ABHANumber),
      preferredAbhaAddress: text(row.preferredAbhaAddress),
    };
  }

  async profile(userToken: string): Promise<AbhaProfile> {
    const { body } = await this.gateway.http.request({
      host: 'abha',
      method: 'GET',
      path: `${PROFILE}/account`,
      accessToken: await this.gateway.session.accessToken(),
      userToken,
    });
    return readAbhaProfile(body);
  }

  /** The ABHA card as ABDM returns it: a file, shown and downloaded unchanged. */
  async card(userToken: string): Promise<{ bytes: Buffer; contentType: string | null }> {
    const { bytes, contentType } = await this.gateway.http.requestBinary({
      host: 'abha',
      method: 'GET',
      path: `${PROFILE}/account/abha-card`,
      accessToken: await this.gateway.session.accessToken(),
      userToken,
    });
    return { bytes, contentType };
  }
}

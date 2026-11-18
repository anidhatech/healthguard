import { constants, createPublicKey, publicEncrypt, type KeyObject } from 'node:crypto';
import type { AbdmHttpClient } from './abdm-http.client.js';

export const ABHA_CERTIFICATE_PATH = '/abha/api/v3/profile/public/certificate';

interface Padding {
  padding: number;
  oaepHash?: string;
}

/**
 * The padding belongs to the certificate: ABDM names it beside the key. A name
 * this table does not hold is refused rather than replaced by a default.
 */
const PADDINGS: Record<string, Padding> = {
  'RSA/ECB/OAEPWITHSHA-1ANDMGF1PADDING': {
    padding: constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha1',
  },
  'RSA/ECB/PKCS1PADDING': { padding: constants.RSA_PKCS1_PADDING },
};

export class AbdmCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AbdmCryptoError';
  }
}

export function resolvePadding(algorithm: unknown): Padding {
  const padding =
    typeof algorithm === 'string' ? PADDINGS[algorithm.trim().toUpperCase()] : undefined;
  if (!padding) {
    throw new AbdmCryptoError('ABDM named an encryption algorithm this client does not know');
  }
  return padding;
}

/** The certificate arrives as base64 DER, usually with no PEM armour. */
export function loadPublicKey(publicKey: unknown): KeyObject {
  if (typeof publicKey !== 'string' || publicKey.trim().length === 0) {
    throw new AbdmCryptoError('ABDM returned no public key');
  }
  const trimmed = publicKey.trim();
  try {
    if (trimmed.includes('-----BEGIN')) return createPublicKey(trimmed);
    return createPublicKey({
      key: Buffer.from(trimmed.replace(/\s+/g, ''), 'base64'),
      format: 'der',
      type: 'spki',
    });
  } catch {
    throw new AbdmCryptoError('ABDM public key could not be read');
  }
}

/** RSA-encrypt one sensitive value and return the standard base64 of the ciphertext. */
export function encryptWithKey(key: KeyObject, padding: Padding, value: string): string {
  return publicEncrypt({ key, ...padding }, Buffer.from(value, 'utf8')).toString('base64');
}

interface CertificateResponse {
  publicKey?: unknown;
  encryptionAlgorithm?: unknown;
}

/**
 * Encrypts Aadhaar numbers, ABHA numbers, mobiles, emails, OTPs and passwords
 * in this process, with the ABHA service's own certificate. Plain values are
 * never logged, stored or sent anywhere else.
 */
export class AbdmCrypto {
  private cached: { key: KeyObject; padding: Padding; expiresAt: number } | null = null;

  constructor(
    private readonly http: AbdmHttpClient,
    private readonly accessToken: () => Promise<string>,
    private readonly now: () => number,
    /** A validity window, so a rotated certificate is picked up without a restart. */
    private readonly cacheMs: number,
  ) {}

  async encrypt(value: string): Promise<string> {
    const { key, padding } = await this.certificate();
    return encryptWithKey(key, padding, value);
  }

  /** Drop the cached certificate, for an encrypted call refused after a rotation. */
  invalidate(): void {
    this.cached = null;
  }

  private async certificate(): Promise<{ key: KeyObject; padding: Padding }> {
    if (this.cached && this.now() < this.cached.expiresAt) return this.cached;
    const { body } = await this.http.request<CertificateResponse>({
      host: 'abha',
      method: 'GET',
      path: ABHA_CERTIFICATE_PATH,
      accessToken: await this.accessToken(),
    });
    this.cached = {
      key: loadPublicKey(body?.publicKey),
      padding: resolvePadding(body?.encryptionAlgorithm),
      expiresAt: this.now() + this.cacheMs,
    };
    return this.cached;
  }
}

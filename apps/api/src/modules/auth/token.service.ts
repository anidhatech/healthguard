import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  type KeyObject,
} from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { jwtVerify, SignJWT } from 'jose';
import { APP_CONFIG, type AppConfig } from '../../config/env.js';

export interface AccessClaims {
  userId: string;
  sessionId: string;
  organizationId: string | null;
  authMethod: 'DEMO_QUICK_LOGIN' | 'PASSWORD' | 'OIDC';
}

export interface VerifiedClaims extends AccessClaims {
  expiresAt: Date;
}

/** Accepts a PEM string or base64-encoded PEM (handy for single-line env vars). */
function readPem(value: string): string {
  return value.includes('-----BEGIN')
    ? value.replaceAll('\\n', '\n')
    : Buffer.from(value, 'base64').toString('utf8');
}

/**
 * Short-lived Ed25519-signed access tokens. Keys come from the environment;
 * without keys (development only) an ephemeral pair is generated at start-up,
 * which signs everyone out on restart.
 */
@Injectable()
export class TokenService {
  private readonly privateKey: KeyObject;
  private readonly publicKey: KeyObject;
  private readonly logger = new Logger('Tokens');

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    const { JWT_PRIVATE_KEY, JWT_PUBLIC_KEY } = config.env;
    if (JWT_PRIVATE_KEY && JWT_PUBLIC_KEY) {
      this.privateKey = createPrivateKey(readPem(JWT_PRIVATE_KEY));
      this.publicKey = createPublicKey(readPem(JWT_PUBLIC_KEY));
    } else {
      const pair = generateKeyPairSync('ed25519');
      this.privateKey = pair.privateKey;
      this.publicKey = pair.publicKey;
      if (config.env.NODE_ENV !== 'test') {
        this.logger.warn(
          'JWT keys not configured: using an ephemeral key pair (development only).',
        );
      }
    }
  }

  get accessTtlSeconds(): number {
    return this.config.env.ACCESS_TOKEN_TTL_SECONDS;
  }

  async sign(claims: AccessClaims): Promise<{ token: string; expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + this.accessTtlSeconds * 1000);
    const token = await new SignJWT({
      sid: claims.sessionId,
      org: claims.organizationId,
      amr: claims.authMethod,
    })
      .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT' })
      .setSubject(claims.userId)
      .setIssuer(this.config.env.JWT_ISSUER)
      .setAudience('healthguard')
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(this.privateKey);
    return { token, expiresAt };
  }

  /** Returns the claims, or null for any invalid, expired or foreign token. */
  async verify(token: string): Promise<VerifiedClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.publicKey, {
        issuer: this.config.env.JWT_ISSUER,
        audience: 'healthguard',
        algorithms: ['EdDSA'],
      });
      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string' || !payload.exp)
        return null;
      const amr = payload.amr;
      return {
        userId: payload.sub,
        sessionId: payload.sid,
        organizationId: typeof payload.org === 'string' ? payload.org : null,
        authMethod: amr === 'PASSWORD' || amr === 'OIDC' ? amr : 'DEMO_QUICK_LOGIN',
        expiresAt: new Date(payload.exp * 1000),
      };
    } catch {
      return null;
    }
  }
}

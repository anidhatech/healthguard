import { randomUUID } from 'node:crypto';
import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import {
  DEMO_DATA_HEADER,
  DEMO_DATA_HEADER_VALUE,
  PURPOSE_HEADER,
  REQUEST_ID_HEADER,
} from '@healthguard/shared';
import type { NextFunction, Response } from 'express';
import { APP_CONFIG, type AppConfig } from '../config/env.js';
import type { HealthGuardRequest } from './actor.js';
import { keyedHash } from './hashing.js';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,64}$/;

/**
 * Request ID (accepted from the caller only if well-formed), hashed client
 * identifiers, `no-store` caching for health data, and the demo header.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  use(request: HealthGuardRequest, response: Response, next: NextFunction): void {
    const incoming = request.header(REQUEST_ID_HEADER);
    const requestId = incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
    request.meta = {
      requestId,
      ipHash: keyedHash(this.config.identifierHashKey, request.ip),
      userAgentHash: keyedHash(this.config.identifierHashKey, request.header('user-agent')),
      purposeHeader: request.header(PURPOSE_HEADER) ?? null,
    };
    response.setHeader(REQUEST_ID_HEADER, requestId);
    response.setHeader('Cache-Control', 'no-store');
    if (this.config.demoMode) response.setHeader(DEMO_DATA_HEADER, DEMO_DATA_HEADER_VALUE);
    next();
  }
}

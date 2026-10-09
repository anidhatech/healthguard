import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { problemType, type ErrorCode, type ProblemDetails } from '@healthguard/shared';
import type { Response } from 'express';
import type { HealthGuardRequest } from './actor.js';
import { ProblemException } from './problem.js';

const STATUS_CODES: Record<number, { code: ErrorCode; title: string }> = {
  400: { code: 'VALIDATION_FAILED', title: 'Bad request' },
  401: { code: 'UNAUTHENTICATED', title: 'Not signed in' },
  403: { code: 'FORBIDDEN', title: 'Not allowed' },
  404: { code: 'NOT_FOUND', title: 'Not found' },
  405: { code: 'NOT_FOUND', title: 'Method not allowed' },
  409: { code: 'CONFLICT', title: 'Conflict' },
  413: { code: 'VALIDATION_FAILED', title: 'Request too large' },
  415: { code: 'VALIDATION_FAILED', title: 'Unsupported media type' },
  429: { code: 'RATE_LIMITED', title: 'Too many requests' },
  501: { code: 'NOT_IMPLEMENTED', title: 'Not implemented' },
  503: { code: 'SERVICE_UNAVAILABLE', title: 'Service unavailable' },
};

/**
 * Every error leaves the API as `application/problem+json` with a stable
 * code and the request ID. Unexpected errors never leak internals.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<HealthGuardRequest>();
    const response = http.getResponse<Response>();
    const requestId = request.meta?.requestId;
    const instance = request.originalUrl?.split('?')[0];

    let body: ProblemDetails;
    if (exception instanceof ProblemException) {
      const status = exception.getStatus();
      body = {
        type: problemType(exception.code),
        title: exception.title,
        status,
        code: exception.code,
        ...exception.problem,
        instance,
        requestId,
      };
    } else if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const known = STATUS_CODES[status] ?? { code: 'INTERNAL_ERROR' as const, title: 'Error' };
      const raw = exception.getResponse();
      const message =
        typeof raw === 'object' && raw !== null && 'message' in raw
          ? String(raw.message)
          : exception.message;
      body = {
        type: problemType(known.code),
        title: known.title,
        status,
        code: known.code,
        detail: status === 404 ? 'No route matches this request.' : message,
        instance,
        requestId,
      };
    } else {
      this.logger.error({ err: exception, requestId }, 'Unhandled error');
      body = {
        type: problemType('INTERNAL_ERROR'),
        title: 'Something went wrong',
        status: 500,
        code: 'INTERNAL_ERROR',
        detail: 'An unexpected error occurred. Quote the request ID if you report it.',
        instance,
        requestId,
      };
    }
    response.status(body.status).type('application/problem+json').json(body);
  }
}

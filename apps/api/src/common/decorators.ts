import { SetMetadata } from '@nestjs/common';
import type { RoleRequirement } from '@healthguard/shared';

export const IS_PUBLIC = 'hg:public';
export const ROLES = 'hg:roles';
export const RAW_RESPONSE = 'hg:raw-response';
export const RATE_LIMIT_BUCKET = 'hg:rate-limit-bucket';

/** No session required. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** The caller needs at least one of these roles (role groups such as CARE_TEAM expand). */
export const Roles = (...roles: RoleRequirement[]) => SetMetadata(ROLES, roles);

/** Return the handler's value as-is instead of the `{ data, meta }` envelope. */
export const RawResponse = () => SetMetadata(RAW_RESPONSE, true);

export type RateLimitBucket = 'default' | 'auth' | 'ai';
export const RateLimit = (bucket: RateLimitBucket) => SetMetadata(RATE_LIMIT_BUCKET, bucket);

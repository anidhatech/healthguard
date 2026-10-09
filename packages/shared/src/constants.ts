/**
 * The demo banner. It appears on every screen of the web app and in the `meta`
 * block of every API response served in demo mode. It is never a hidden
 * disclaimer and it cannot be dismissed.
 */
export const DEMO_DATA_NOTICE = 'DEMO • SYNTHETIC HEALTH DATA • NOT FOR CLINICAL USE';

/** Short, ASCII-only form for HTTP headers. */
export const DEMO_DATA_HEADER_VALUE = 'synthetic-demo-data; not-for-clinical-use';
export const DEMO_DATA_HEADER = 'X-HealthGuard-Data-Notice';

/** Labels for not-yet-built features, so nothing pretends to work. */
export const COMING_NEXT_PHASE = 'Coming in next phase';
export const DEMO_PLACEHOLDER = 'Demo placeholder';

/** Label shown with demo authentication everywhere it appears. */
export const DEMO_AUTH_NOTICE =
  'DEMO / DEVELOPMENT AUTHENTICATION: quick sign-in for synthetic demo accounts only. This is not identity verification.';

export const SAFETY_STATEMENT =
  'HealthGuard is a software demonstration, not a medical device or a clinical decision-support system. It does not diagnose, prescribe or change treatment. All clinical decisions remain with qualified healthcare professionals.';

export const API_GLOBAL_PREFIX = 'api';
export const API_VERSION = '1';
export const API_BASE_PATH = `/${API_GLOBAL_PREFIX}/v${API_VERSION}`;

export const REQUEST_ID_HEADER = 'X-Request-Id';
export const CSRF_HEADER = 'X-CSRF-Token';
export const PURPOSE_HEADER = 'X-Purpose-Of-Use';

export const COOKIE_NAMES = {
  accessToken: 'hg_at',
  refreshToken: 'hg_rt',
  csrf: 'hg_csrf',
  session: 'hg_session',
  locale: 'NEXT_LOCALE',
} as const;

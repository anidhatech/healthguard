import { COOKIE_NAMES } from '@healthguard/shared';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Sends signed-out visitors to /login. This is navigation only: every API
 * call is authorized by the API itself, never by the web app.
 */
export function proxy(request: NextRequest) {
  const signedIn =
    request.cookies.has(COOKIE_NAMES.session) || request.cookies.has(COOKIE_NAMES.accessToken);
  if (!signedIn) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/patient/:path*', '/doctor/:path*', '/admin/:path*'],
};

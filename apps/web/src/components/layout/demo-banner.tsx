'use client';

import { DEMO_DATA_NOTICE, type DemoAccountsResponse } from '@healthguard/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { showsDemoNotice } from '@/lib/utils';

/**
 * Never dismissible. Shown before sign-in on a demo server and everywhere in
 * a demo organization; hidden where the notice would be untrue: on a server
 * that holds real records, and for someone signed in to such an organization.
 */
export function DemoBanner() {
  const { data: session } = useSession();
  const server = useQuery({
    queryKey: ['demo-accounts'],
    queryFn: () => api<DemoAccountsResponse>('/auth/demo-accounts'),
    staleTime: Infinity,
  });
  // Before sign-in the server says what it holds. Until it has answered, the notice stays.
  if (!session && server.data?.demoMode === false) return null;
  if (!showsDemoNotice(session)) return null;
  return (
    <div
      role="note"
      aria-label="Data notice"
      className="sticky top-0 z-30 bg-warn px-3 py-1.5 text-center text-xs font-semibold tracking-wide text-white sm:text-sm"
    >
      {DEMO_DATA_NOTICE}
    </div>
  );
}

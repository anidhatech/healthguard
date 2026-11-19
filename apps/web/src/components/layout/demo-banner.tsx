'use client';

import { DEMO_DATA_NOTICE } from '@healthguard/shared';
import { useSession } from '@/lib/session';
import { showsDemoNotice } from '@/lib/utils';

/**
 * Never dismissible. Shown before sign-in and everywhere in a demo
 * organization; hidden only for someone signed in to an organization that
 * holds real records, where the notice would be untrue.
 */
export function DemoBanner() {
  const { data: session } = useSession();
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

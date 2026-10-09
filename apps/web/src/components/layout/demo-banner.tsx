import { DEMO_DATA_NOTICE } from '@healthguard/shared';

/** Always visible, never dismissible. */
export function DemoBanner() {
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

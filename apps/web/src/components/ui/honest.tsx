'use client';

import type { ContentKind } from '@healthguard/shared';
import { Bot, Calculator, Clock, FileCheck2, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from './badge';

/** Every clinical item says what it is: recorded, calculated, AI summary or AI suggestion. */
export function KindBadge({ kind }: { kind: ContentKind }) {
  const t = useTranslations('kinds');
  const tone = kind === 'FACT' ? 'neutral' : kind === 'CALCULATED' ? 'calc' : 'ai';
  const Icon =
    kind === 'FACT'
      ? FileCheck2
      : kind === 'CALCULATED'
        ? Calculator
        : kind === 'AI_SUMMARY'
          ? Bot
          : Sparkles;
  return (
    <Badge tone={tone}>
      <Icon aria-hidden className="size-3" /> {t(kind)}
    </Badge>
  );
}

/**
 * A feature that is not built yet. Rendered as a disabled control with an
 * explicit label, so nothing pretends to work.
 */
export function ComingNextPhase({ label }: { label: string }) {
  const t = useTranslations('states');
  return (
    <span className="inline-flex flex-wrap items-center gap-2" aria-disabled="true">
      <button
        type="button"
        disabled
        className="min-h-9 cursor-not-allowed rounded-lg border border-dashed border-line bg-surface px-3 text-sm text-muted"
      >
        {label}
      </button>
      <Badge tone="warn">
        <Clock aria-hidden className="size-3" /> {t('comingNextPhase')}
      </Badge>
    </span>
  );
}

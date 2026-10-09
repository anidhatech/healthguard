import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-surface text-muted border border-line',
        brand: 'bg-brand-50 text-brand-700',
        ok: 'bg-ok-50 text-ok',
        warn: 'bg-warn-50 text-warn',
        danger: 'bg-danger-50 text-danger',
        ai: 'bg-ai-50 text-ai',
        calc: 'bg-calc-50 text-calc',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

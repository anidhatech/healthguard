import { AlertTriangle, Info, ShieldAlert, CheckCircle2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const STYLES = {
  info: { box: 'border-calc/30 bg-calc-50 text-ink', icon: Info, iconClass: 'text-calc' },
  warn: { box: 'border-warn/30 bg-warn-50 text-ink', icon: AlertTriangle, iconClass: 'text-warn' },
  danger: {
    box: 'border-danger/30 bg-danger-50 text-ink',
    icon: ShieldAlert,
    iconClass: 'text-danger',
  },
  ok: { box: 'border-ok/30 bg-ok-50 text-ink', icon: CheckCircle2, iconClass: 'text-ok' },
} as const;

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: keyof typeof STYLES;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const style = STYLES[tone];
  const Icon = style.icon;
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-lg border p-3 text-sm', style.box, className)}
    >
      <Icon aria-hidden className={cn('mt-0.5 size-4 shrink-0', style.iconClass)} />
      <div className="min-w-0">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className="text-muted">{children}</div> : null}
      </div>
    </div>
  );
}

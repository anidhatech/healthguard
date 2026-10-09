import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-xl border border-line bg-white p-4 shadow-sm sm:p-5', className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  action,
  subtitle,
}: {
  title: ReactNode;
  action?: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

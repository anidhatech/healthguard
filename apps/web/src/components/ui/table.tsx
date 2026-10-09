import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className={cn('w-full min-w-[32rem] border-collapse text-sm', className)} {...props} />
    </div>
  );
}
export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn('border-b border-line px-3 py-2 text-left font-medium text-muted', className)}
      {...props}
    />
  );
}
export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('border-b border-line px-3 py-2 align-top', className)} {...props} />;
}

'use client';

import { Dialog as DialogPrimitive } from 'radix-ui';
import type { ReactNode } from 'react';

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
}: {
  wide?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <DialogPrimitive.Content
          className={`fixed top-1/2 left-1/2 z-50 max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-white p-5 shadow-xl ${wide ? 'w-[min(96vw,48rem)]' : 'w-[min(92vw,28rem)]'}`}
        >
          <DialogPrimitive.Title className="text-lg font-semibold">{title}</DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="mt-2 text-sm text-muted">
              {description}
            </DialogPrimitive.Description>
          ) : null}
          <div className="mt-4">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export const DialogClose = DialogPrimitive.Close;

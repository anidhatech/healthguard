import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 min-h-11',
  {
    variants: {
      variant: {
        primary: 'bg-brand-700 text-white hover:bg-brand-800',
        secondary: 'bg-white text-ink border border-line hover:bg-surface',
        ghost: 'text-brand-700 hover:bg-brand-50',
        danger: 'bg-danger text-white hover:opacity-90',
        ai: 'bg-ai text-white hover:opacity-90',
      },
      size: { sm: 'px-3 text-sm min-h-9', md: 'px-4 text-sm', lg: 'px-5 text-base' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, type, ...props }: ButtonProps) {
  const Component = asChild ? Slot.Root : 'button';
  return (
    <Component
      className={cn(buttonVariants({ variant, size }), className)}
      type={asChild ? undefined : (type ?? 'button')}
      {...props}
    />
  );
}

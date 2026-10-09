import { describe, expect, it } from 'vitest';
import { cn, formatDate, formatNumber } from './utils';

describe('utils', () => {
  it('merges class names with Tailwind precedence', () => {
    const hidden: string | false = false;
    expect(cn('p-2', hidden, 'p-4')).toBe('p-4');
  });

  it('formats dates in India time and numbers with Latin digits', () => {
    expect(formatDate('2026-10-08', 'en-IN')).toBe('8 Oct 2026');
    expect(formatNumber(7100)).toBe('7,100');
    expect(formatNumber(null)).toBe('—');
  });
});

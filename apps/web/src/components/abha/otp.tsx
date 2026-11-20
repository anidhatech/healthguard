'use client';

import { ABHA_OTP_RULES, ABHA_TEXT, type AbhaOtpChallenge } from '@healthguard/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ABHA_FIELD } from '@/lib/abha';

/** Seconds left until `until`, ticking as time passes. */
function useCountdown(until: string | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [until]);
  return until ? Math.max(Math.ceil((Date.parse(until) - now) / 1000), 0) : 0;
}

/** Six digits and nothing else. */
export function OtpInput({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  id: string;
}) {
  return (
    <input
      id={id}
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={ABHA_OTP_RULES.otpLength}
      value={value}
      onChange={(event) =>
        onChange(event.target.value.replace(/\D+/g, '').slice(0, ABHA_OTP_RULES.otpLength))
      }
      className={`${ABHA_FIELD} w-40 font-mono tracking-widest`}
    />
  );
}

/** Resend with a visible counter: disabled for 60 seconds, two resends at most. */
export function Resend({
  challenge,
  busy,
  onResend,
  limitReached,
}: {
  challenge: AbhaOtpChallenge;
  busy: boolean;
  onResend: () => void;
  limitReached: boolean;
}) {
  const t = useTranslations('abha');
  const seconds = useCountdown(challenge.resendAvailableAt);
  return (
    <div className="grid gap-1 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy || seconds > 0}
          onClick={onResend}
        >
          {t('resend')}
        </Button>
        <span aria-live="polite" className="text-muted">
          {seconds > 0 ? t('resendIn', { seconds }) : t('resendReady')} ·{' '}
          {t('resendsLeft', { count: challenge.resendsLeft })}
        </span>
      </div>
      {limitReached ? <p className="text-danger">{ABHA_TEXT.resendLimit}</p> : null}
    </div>
  );
}

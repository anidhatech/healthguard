'use client';

import { HELP_REASONS, type HelpRequest, type HelpRequestResult } from '@healthguard/shared';
import { LifeBuoy, Phone } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ErrorState } from '@/components/ui/states';
import { api } from '@/lib/api';
import { useAction } from '@/lib/queries';

/**
 * "Need help": emergency numbers first, then a call-back request to the care
 * team. It is not an emergency channel and says so.
 */
export function NeedHelp({ patientId, doseId }: { patientId: string; doseId?: string }) {
  const t = useTranslations('help');
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<HelpRequest['reason']>('SIDE_EFFECT');
  const [note, setNote] = useState('');
  const send = useAction(
    () =>
      api<HelpRequestResult>(`/patients/${patientId}/help-requests`, {
        method: 'POST',
        json: {
          reason,
          ...(doseId ? { doseId } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      }),
    ['/patients', '/notifications'],
  );
  const close = (value: boolean) => {
    setOpen(value);
    if (!value) {
      send.reset();
      setNote('');
    }
  };

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <LifeBuoy aria-hidden className="size-4" /> {t('button')}
      </Button>
      <Dialog open={open} onOpenChange={close} title={t('title')}>
        <div className="grid gap-4">
          <div className="rounded-lg border-2 border-danger/40 bg-danger-50 p-3">
            <p className="font-semibold text-danger">{t('emergencyTitle')}</p>
            <p className="mt-1 text-sm">{t('emergencyBody')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a
                href="tel:112"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-danger px-4 font-semibold text-white"
              >
                <Phone aria-hidden className="size-4" /> {t('call112')}
              </a>
              <a
                href="tel:108"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-danger px-4 font-semibold text-white"
              >
                <Phone aria-hidden className="size-4" /> {t('call108')}
              </a>
            </div>
          </div>
          {send.data ? (
            <Alert tone="ok" title={send.data.created ? t('sent') : t('alreadyOpen')}>
              {t('notEmergency')}
            </Alert>
          ) : (
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                send.mutate();
              }}
            >
              <p className="text-sm">{t('notEmergency')}</p>
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-medium">{t('reasonLabel')}</legend>
                {HELP_REASONS.map((value) => (
                  <label
                    key={value}
                    className="flex min-h-11 items-center gap-2 rounded-lg border border-line px-3 text-sm"
                  >
                    <input
                      type="radio"
                      name="help-reason"
                      value={value}
                      checked={reason === value}
                      onChange={() => setReason(value)}
                    />
                    {t(`reasons.${value}`)}
                  </label>
                ))}
              </fieldset>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">{t('noteLabel')}</span>
                <textarea
                  value={note}
                  maxLength={280}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={t('notePlaceholder')}
                  className="min-h-20 rounded-lg border border-line p-2"
                />
              </label>
              {send.error ? <ErrorState error={send.error} /> : null}
              <Button type="submit" disabled={send.isPending}>
                {t('send')}
              </Button>
            </form>
          )}
        </div>
      </Dialog>
    </>
  );
}

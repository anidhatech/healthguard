'use client';

import { Volume2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Reads a text aloud with the device's own voice (browser speech synthesis).
 * Nothing is sent anywhere. If the device has no voice for the language, it
 * says so instead of reading in the wrong language.
 */
export function ReadAloud({ text, lang }: { text: string; lang: string }) {
  const t = useTranslations('doses');
  const [message, setMessage] = useState<string | null>(null);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  if (!supported) return null;

  const speak = () => {
    const synth = window.speechSynthesis;
    const voices = synth.getVoices();
    const base = lang.slice(0, 2);
    const voice =
      voices.find((item) => item.lang.replace('_', '-') === lang) ??
      voices.find((item) => item.lang.toLowerCase().startsWith(base));
    if (voices.length > 0 && !voice) {
      setMessage(t('noVoice'));
      return;
    }
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    if (voice) utterance.voice = voice;
    utterance.rate = 0.9;
    synth.speak(utterance);
    setMessage(null);
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button size="sm" variant="ghost" onClick={speak} aria-label={t('readAloud')}>
        <Volume2 aria-hidden className="size-4" /> {t('readAloud')}
      </Button>
      {message ? <span className="text-xs text-muted">{message}</span> : null}
    </span>
  );
}

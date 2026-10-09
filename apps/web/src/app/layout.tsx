import '@fontsource/noto-sans/400.css';
import '@fontsource/noto-sans/600.css';
import '@fontsource/noto-sans-devanagari/400.css';
import '@fontsource/noto-sans-devanagari/600.css';
import '@fontsource/noto-sans-telugu/400.css';
import '@fontsource/noto-sans-telugu/600.css';
import './globals.css';
import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import type { ReactNode } from 'react';
import { DemoBanner } from '@/components/layout/demo-banner';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: { default: 'HealthGuard (demo)', template: '%s · HealthGuard (demo)' },
  description:
    'Longitudinal health records and treatment adherence. Demo with synthetic data only.',
  applicationName: 'HealthGuard',
  appleWebApp: { capable: true, title: 'HealthGuard', statusBarStyle: 'default' },
  icons: { apple: '/apple-touch-icon.png' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#0d5c63',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale.slice(0, 2)}>
      <body className="min-h-screen bg-surface antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-2"
        >
          Skip to content
        </a>
        <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Kolkata">
          <Providers>
            <DemoBanner />
            {children}
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

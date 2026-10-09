import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'HealthGuard (demo)',
    short_name: 'HealthGuard',
    description:
      'Longitudinal health records and treatment adherence. Demo with synthetic data only.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f6f8fa',
    theme_color: '#0d5c63',
    lang: 'en-IN',
    categories: ['health', 'medical'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

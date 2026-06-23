import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const title = "Vigilis · the QA agent that proves it didn't hide your bug";
const description =
  'Point it at the brittle Cypress, Selenium, or Playwright suite you already have. Vigilis heals the drift, gates every run on signed evidence, and stays fail-closed so it never papers over a real bug.';

export const metadata: Metadata = {
  metadataBase: new URL('https://vigilis.dev'),
  title,
  description,
  keywords: [
    'QA',
    'test automation',
    'Playwright',
    'Cypress',
    'Selenium',
    'self-healing tests',
    'AI agent',
    'provenance',
    'attestation',
  ],
  authors: [{ name: 'Piyush Pathak' }],
  openGraph: {
    title,
    description,
    url: 'https://vigilis.dev',
    siteName: 'Vigilis',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: title }],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

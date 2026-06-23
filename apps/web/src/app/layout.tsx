import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Space_Grotesk } from 'next/font/google';

const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display', display: 'swap' });

const title = 'Vigilis — the Playwright QA agent that writes and heals your tests';
const description =
  'Vigilis writes Playwright specs from a URL, runs them in CI, heals safe UI drift, and opens reviewable PRs — and when behaviour actually changes, it fails loudly.';

export const metadata: Metadata = {
  metadataBase: new URL('https://vigilis.dev'),
  title,
  description,
  keywords: ['QA', 'test automation', 'Playwright', 'self-healing tests', 'AI agent', 'provenance', 'attestation'],
  authors: [{ name: 'Piyush Pathak' }],
  openGraph: {
    title,
    description,
    url: 'https://vigilis.dev',
    siteName: 'Vigilis',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Vigilis — the Playwright QA agent that writes and heals your tests' }],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description: 'Autonomous QA for Playwright: writes specs, gates CI, heals safe drift, opens PRs — and fails loudly on real regressions.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={display.variable}>
      <body>{children}</body>
    </html>
  );
}

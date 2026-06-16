import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Space_Grotesk } from 'next/font/google';

const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display', display: 'swap' });

const title = 'Vigilis — The trust layer for autonomous testing';
const description =
  'Self-healing Playwright tests you can verify — every fix sealed in a signed, tamper-evident receipt, and it never masks a real bug.';

export const metadata: Metadata = {
  metadataBase: new URL('https://argusqa.dev'),
  title,
  description,
  keywords: ['QA', 'test automation', 'Playwright', 'self-healing tests', 'AI agent', 'provenance', 'attestation'],
  authors: [{ name: 'Piyush Pathak' }],
  openGraph: {
    title,
    description,
    url: 'https://argusqa.dev',
    siteName: 'Vigilis',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Vigilis — the trust layer for autonomous testing' }],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description: 'Self-healing tests you can verify — signed, tamper-evident receipts; never masks a real bug.',
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

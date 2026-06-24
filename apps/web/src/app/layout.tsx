import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const title = 'Vigilis · self-healing QA that refuses to hide a real bug';
const description =
  "Vigilis heals the drift in the Cypress, Selenium, or Playwright suite you already have, and gates every run on signed evidence so a real regression can't slip through green.";
const ogDescription =
  'Heals your existing test suite in place. Gates every run on signed evidence. Fail-closed by design.';
const favicon =
  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' fill='%2306080b'/><text x='16' y='23' font-family='monospace' font-size='17' font-weight='800' text-anchor='middle'><tspan fill='%23ffb000'>[</tspan><tspan fill='%23ece7da'>V</tspan><tspan fill='%23ffb000'>]</tspan></text></svg>";

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
  icons: { icon: favicon },
  openGraph: {
    title,
    description: ogDescription,
    url: 'https://vigilis.dev',
    siteName: 'Vigilis',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: title }],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description: ogDescription,
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

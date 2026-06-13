import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Space_Grotesk } from 'next/font/google';

const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display', display: 'swap' });

export const metadata: Metadata = {
  title: 'Argus — Agentic QA Framework',
  description: 'The agent that writes, gates, and self-heals your Playwright tests.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={display.variable}>
      <body>{children}</body>
    </html>
  );
}

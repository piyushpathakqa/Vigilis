'use client';

import { motion } from 'motion/react';

const STAGES = [
  { k: 'Generate', d: 'URL in, runnable spec out — Playwright, Cypress, or Selenium.' },
  { k: 'Gate', d: 'Runs in CI — failing tests block the deploy.' },
  { k: 'Triage', d: 'Classifies every failure: real bug, DOM drift, or flake.' },
  { k: 'Heal', d: 'Safe drift gets a verified fix PR. Real regressions do not.' },
  { k: 'Evidence', d: 'Every automated change includes evidence: what failed, what changed, and why.' },
];

export function LoopSection() {
  return (
    <section id="loop" className="mx-auto max-w-6xl px-6 py-24">
      <h2 className="text-center text-3xl font-bold">One loop, five behaviours</h2>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {STAGES.map((s, i) => (
          <motion.div
            key={s.k}
            className="glass rounded-xl p-5"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5, delay: i * 0.12 }}
          >
            <div className="font-mono text-sm text-[var(--color-cyan)]">0{i + 1}</div>
            <h3 className="mt-2 text-xl font-semibold">{s.k}</h3>
            <p className="mt-2 text-sm text-[var(--color-muted)]">{s.d}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

'use client';

import { motion } from 'motion/react';

const STAGES = [
  { k: 'Generate', d: 'Point it at a URL → it explores the app and writes a runnable Playwright spec.' },
  { k: 'Gate', d: 'The spec runs in CI as a required check — failing tests block the deploy.' },
  { k: 'Triage', d: 'On failure it classifies the cause: real bug vs DOM drift vs flake.' },
  { k: 'Heal', d: 'For drift it rewrites the locator, verifies green, and opens a PR — never masking real bugs.' },
];

export function LoopSection() {
  return (
    <section id="loop" className="mx-auto max-w-5xl px-6 py-24">
      <h2 className="text-center text-3xl font-bold">One loop, four behaviours</h2>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

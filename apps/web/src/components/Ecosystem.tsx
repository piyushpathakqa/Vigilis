'use client';

import { motion } from 'motion/react';

const LAYERS = [
  {
    tag: 'App',
    name: 'Vigilis',
    d: 'Autonomous QA for Playwright. Writes tests, heals safe drift, opens PRs, and fails loudly on real regressions.',
  },
  {
    tag: 'Primitive',
    name: 'Treeship',
    d: 'Evidence and attestation for agent actions — the signed, verifiable receipts Vigilis runs on today.',
  },
  {
    tag: 'Lab',
    name: 'Zerker Labs',
    d: 'Building the primitives and apps for governed agents that take real actions in production.',
  },
];

export function Ecosystem() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-24">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--color-cyan)]">
        Zerker ecosystem
      </p>
      <h2 className="mt-3 text-3xl font-bold">Vigilis is an app built on Zerker primitives.</h2>
      <p className="mt-3 max-w-2xl text-[var(--color-muted)]">
        The product is the app. The infrastructure underneath — signing and evidence — is reusable
        across every future agent.
      </p>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {LAYERS.map((l, i) => (
          <motion.div
            key={l.name}
            className="glass rounded-xl p-6"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
          >
            <span className="font-mono text-xs uppercase tracking-widest text-[var(--color-cyan)]">
              {l.tag}
            </span>
            <h3 className="mt-3 text-lg font-semibold">{l.name}</h3>
            <p className="mt-2 text-sm text-[var(--color-muted)]">{l.d}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

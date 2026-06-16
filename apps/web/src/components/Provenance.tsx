'use client';

import { motion } from 'motion/react';

export function Provenance() {
  return (
    <section className="relative px-6 py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: 'radial-gradient(80% 60% at 50% 50%, rgba(167,139,250,.12), transparent 70%)' }}
      />
      <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
        <div>
          <h2 className="text-3xl font-bold">Self-healing QA you can audit.</h2>
          <p className="mt-4 text-[var(--color-muted)]">
            Every run is sealed inside a signed Treeship session — each tool call, decision and verdict
            captured in a tamper-evident chain, signed by an independent notary. You get a receipt, not a
            black box.
          </p>
          <div className="glass mt-5 flex items-start gap-3 rounded-xl p-4">
            <span aria-hidden className="text-lg">🛡️</span>
            <p className="text-sm text-[var(--color-muted)]">
              <span className="font-semibold text-[var(--color-ink)]">Never a false green.</span> Vigilis
              heals cosmetic drift but <span className="text-[var(--color-ink)]">refuses to heal a real
              bug</span> — and the receipt proves which call it made, and why.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="https://treeship.dev/receipt/ssn_b965f6f0a82f1294"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black"
            >
              Verify a heal receipt ▸
            </a>
            <a
              href="https://treeship.dev/receipt/ssn_3834e1bcc2651d7d"
              target="_blank"
              rel="noreferrer"
              className="glass rounded-lg px-4 py-2 text-sm font-semibold"
            >
              Verify a refusal receipt ▸
            </a>
          </div>
          <p className="mt-3 text-xs text-[var(--color-muted)]">
            Real, live receipts — public, no login, independently verifiable.
          </p>
        </div>
        <motion.pre
          className="glass overflow-x-auto rounded-xl p-6 font-mono text-sm leading-relaxed"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
        >
          <code>
            <span className="text-[var(--color-cyan)]">$ argus heal --spec checkout.spec.ts</span>
            {'\n'}triage   → dom-drift (locator stale)
            {'\n'}heal     → rewrote getByRole(&apos;button&apos;)
            {'\n'}verify   → 12 passed (green)
            {'\n'}pr       → #42 opened
            {'\n'}
            {'\n'}<span className="text-[var(--color-violet)]">✓ verified · chain intact · independently signed</span>
          </code>
        </motion.pre>
      </div>
    </section>
  );
}

'use client';

import { motion } from 'motion/react';

const ITEMS = [
  { t: 'AI writes real tests', d: 'It explores your app and emits runnable Playwright specs — not brittle boilerplate.' },
  { t: 'Failing tests block deploy', d: 'Vigilis runs as a required GitHub check, so regressions never reach production.' },
  { t: 'Self-healing PRs', d: 'DOM drift is fixed automatically and verified green before a PR — real bugs are never hidden.' },
  { t: 'Signed provenance receipts', d: 'Every heal is wrapped in a Treeship session: an auditable, signed chain of artifacts.' },
  { t: 'Drive it from Claude', d: 'The same tools ship as an MCP server — generate, triage and heal straight from your agent.' },
  { t: 'One core, two consumers', d: 'Define the QA tools once; reuse them across the CLI and the MCP server with zero drift.' },
];

export function Advantages() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-24">
      <h2 className="text-center text-3xl font-bold">Why Vigilis</h2>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map((it, i) => (
          <motion.div
            key={it.t}
            className="glass rounded-xl p-6"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5, delay: (i % 3) * 0.1 }}
            whileHover={{ y: -4 }}
          >
            <h3 className="text-lg font-semibold gradient-text">{it.t}</h3>
            <p className="mt-2 text-sm text-[var(--color-muted)]">{it.d}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

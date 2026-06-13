'use client';

import { motion } from 'motion/react';

export function ArchSection() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-24 text-center">
      <h2 className="text-3xl font-bold">One core, two consumers</h2>
      <p className="mt-3 text-[var(--color-muted)]">
        Define the QA tools once in <code>@argus/core</code>; expose them as a CLI and an MCP server.
      </p>
      <div className="mt-12 flex flex-col items-center gap-6">
        <div className="glass rounded-xl px-6 py-4 font-mono">
          @argus/core <span className="text-[var(--color-muted)]">· agent loop + tool registry</span>
        </div>
        <svg width="240" height="60" viewBox="0 0 240 60" aria-hidden>
          <motion.path
            d="M120 0 L40 60"
            stroke="#6366f1"
            strokeWidth="1.5"
            fill="none"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          />
          <motion.path
            d="M120 0 L200 60"
            stroke="#a78bfa"
            strokeWidth="1.5"
            fill="none"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.15 }}
          />
        </svg>
        <div className="flex gap-6">
          <div className="glass rounded-xl px-6 py-4 font-mono">
            @argus/cli <span className="text-[var(--color-muted)]">· CI</span>
          </div>
          <div className="glass rounded-xl px-6 py-4 font-mono">
            @argus/mcp <span className="text-[var(--color-muted)]">· Claude</span>
          </div>
        </div>
      </div>
    </section>
  );
}

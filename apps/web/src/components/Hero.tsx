'use client';

import { motion } from 'motion/react';
import { EyeOrb } from './EyeOrb';

const fade = (d: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay: d, ease: 'easeOut' as const },
});

export function Hero() {
  return (
    <section className="relative mx-auto flex max-w-5xl flex-col items-center px-6 pb-20 pt-28 text-center">
      <motion.div {...fade(0)}>
        <EyeOrb />
      </motion.div>
      <motion.p
        {...fade(0.08)}
        className="mt-8 font-mono text-xs uppercase tracking-[0.28em] text-[var(--color-cyan)]"
      >
        Open-source QA agent · CLI + MCP
      </motion.p>
      <motion.h1 {...fade(0.1)} className="gradient-text mt-3 text-6xl font-bold tracking-tight">
        VIGILIS
      </motion.h1>
      <motion.h2
        {...fade(0.16)}
        className="mt-4 max-w-3xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl"
      >
        The AI agent that writes your Playwright tests — and fixes the ones your UI breaks.
      </motion.h2>
      <motion.p {...fade(0.24)} className="mt-4 max-w-2xl text-lg text-[var(--color-muted)]">
        Vigilis writes specs from a URL, runs them in CI, heals safe UI drift, and opens reviewable
        PRs. When behaviour changes, it{' '}
        <span className="text-[var(--color-ink)]">fails loudly</span>.
      </motion.p>
      <motion.ul {...fade(0.3)} className="mt-7 flex flex-wrap justify-center gap-2">
        {['Generate specs', 'Gate deploys', 'Triage failures', 'Self-heal locators', 'Signed receipts'].map(
          (p) => (
            <li
              key={p}
              className="rounded-full border border-white/10 px-3 py-1.5 font-mono text-xs text-[var(--color-muted)]"
            >
              <span className="text-[var(--color-cyan)]">›</span> {p}
            </li>
          ),
        )}
      </motion.ul>
      <motion.div {...fade(0.38)} className="mt-8 flex gap-4">
        <a
          href="https://github.com/piyushpathakqa/Vigilis"
          className="rounded-lg bg-white px-5 py-2.5 font-semibold text-black"
        >
          View on GitHub ▸
        </a>
        <a href="#loop" className="glass rounded-lg px-5 py-2.5 font-semibold">
          See the loop
        </a>
      </motion.div>
      <motion.div {...fade(0.45)} className="glass mt-14 w-full overflow-hidden rounded-xl">
        <video className="w-full" autoPlay muted loop playsInline poster="/vigilis-loop-poster.png">
          <source src="/vigilis-loop.mp4" type="video/mp4" />
        </video>
      </motion.div>
    </section>
  );
}

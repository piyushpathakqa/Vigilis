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
      <motion.h1 {...fade(0.1)} className="gradient-text mt-8 text-6xl font-bold tracking-tight">
        ARGUS
      </motion.h1>
      <motion.p {...fade(0.2)} className="mt-4 max-w-xl text-lg text-[var(--color-muted)]">
        The agent that writes, gates &amp; self-heals your Playwright tests.
      </motion.p>
      <motion.div {...fade(0.3)} className="mt-8 flex gap-4">
        <a
          href="https://github.com/piyushpathakqa/argus"
          className="rounded-lg bg-white px-5 py-2.5 font-semibold text-black"
        >
          View on GitHub ▸
        </a>
        <a href="#loop" className="glass rounded-lg px-5 py-2.5 font-semibold">
          See the loop
        </a>
      </motion.div>
      <motion.div {...fade(0.45)} className="glass mt-14 w-full overflow-hidden rounded-xl">
        <video className="w-full" autoPlay muted loop playsInline poster="/argus-loop-poster.png">
          <source src="/argus-loop.mp4" type="video/mp4" />
        </video>
      </motion.div>
    </section>
  );
}

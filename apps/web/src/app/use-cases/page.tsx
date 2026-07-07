/**
 * Public use-cases page (TRE) — vigilis.dev/use-cases.
 *
 * The "hallway" for the two-doors strategy: the homepage stays a sharp,
 * developer-first pitch; this page lets each visitor self-identify. Developer
 * cases first; the SOX / payment-controls card is the one compliance "door"
 * (kept honest — "audit-grade evidence", never "SOX compliant").
 *
 * Mirrors the pricing page pattern (standalone server component + uc-* styles
 * in globals.css). Linked from the homepage nav.
 */
import type { ReactNode } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Use cases · Vigilis',
  description:
    'Gate AI-written code, self-heal without hiding bugs, and get an auditable, signed record of every test decision — including audit-grade evidence for SOX and payment controls.',
};

const GITHUB = 'https://github.com/piyushpathakqa/Vigilis';

interface UseCase {
  who: string;
  title: string;
  desc: ReactNode;
  forWhom: string;
  featured?: boolean;
}

const CASES: UseCase[] = [
  {
    who: 'AI coding agents',
    title: 'Gate AI-written code',
    desc: (
      <>
        When Cursor, Copilot, Claude, or Devin rewrites a failing test, prove it{' '}
        <b>fixed the bug</b> — not deleted the assertion that caught it. Vigilis runs as a gate on
        every PR and refuses to green a real failure.
      </>
    ),
    forWhom: 'Platform & engineering leads',
    featured: true,
  },
  {
    who: 'Flaky suites',
    title: 'Self-heal without hiding bugs',
    desc: (
      <>
        A renamed selector gets <b>healed and re-verified green</b> automatically. A real behaviour
        change is <b>refused</b>, not papered over. When it&apos;s unsure, it fails loud rather than
        heal.
      </>
    ),
    forWhom: 'QA & dev teams',
  },
  {
    who: 'Provenance',
    title: 'Auditable test runs',
    desc: (
      <>
        Every heal and every refusal is hash-chained and signed into an{' '}
        <b>independent, tamper-evident receipt</b> — verify offline that these exact steps ran, in
        order, unaltered.
      </>
    ),
    forWhom: 'Anyone who needs proof, not a dashboard',
  },
  {
    who: 'Compliance & audit',
    title: 'Audit-grade evidence for SOX & payment controls',
    desc: (
      <>
        When AI maintains the tests that guard revenue, a green pipeline stops being evidence.
        Vigilis produces independent, verifiable proof that a control test{' '}
        <b>wasn&apos;t silently weakened</b> — the artifact you hand your auditor.
      </>
    ),
    forWhom: 'SOX / internal audit / GRC',
  },
  {
    who: 'MCP',
    title: 'Agent-native',
    desc: (
      <>
        Vigilis ships as an <b>MCP server</b>, so an AI agent can invoke it on itself — running the
        gate and sealing the proof as part of its own workflow.
      </>
    ),
    forWhom: 'Agent builders',
  },
];

export default function UseCasesPage() {
  return (
    <main className="uc-wrap">
      <nav className="uc-nav">
        <a className="mark" href="/">
          <span className="b">[</span>V<span className="b">]</span> VIGILIS
        </a>
        <a className="uc-back" href="/">
          ← home
        </a>
      </nav>

      <header className="uc-head">
        <span className="pill">
          <span className="dot" /> USE CASES
        </span>
        <h1>
          One agent. Many jobs. <span className="g">All attested.</span>
        </h1>
        <p className="lede">
          Vigilis heals what&apos;s safe, refuses what isn&apos;t, and signs every decision. Here&apos;s
          where teams point it.
        </p>
      </header>

      <section className="uc-grid">
        {CASES.map((c) => (
          <div key={c.title} className={`uc-card${c.featured ? ' featured' : ''}`}>
            <div className="uc-tag">
              <span className="dot" />
              {c.who}
            </div>
            <h2 className="uc-h">{c.title}</h2>
            <p className="uc-desc">{c.desc}</p>
            <div className="uc-who">
              <b>For</b> &nbsp;{c.forWhom}
            </div>
          </div>
        ))}
      </section>

      <div className="uc-cta-row">
        <a className="btn-gh" href={GITHUB}>
          &#9733; Star on GitHub
        </a>
      </div>

      <footer className="uc-foot">
        Attestation is <b>verifiable</b> and <b>auditable</b> — it proves what the agent did, in
        order, unaltered. It does not guarantee the agent&apos;s judgment was correct.
      </footer>
    </main>
  );
}

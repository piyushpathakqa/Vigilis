/**
 * Public pricing page (TRE-59) — vigilis.dev/pricing.
 *
 * Free / Team / Enterprise, the per-repo note, and the "vs a QA hire" anchor.
 * Numbers mirror docs/PRICING.md and the entitlements in apps/cloud
 * (Free 1 repo/14d/no export · Team 5 repos/1y/export · Enterprise unlimited).
 *
 * HELD PENDING VALIDATION (TRE-60): noindex + not linked from the site nav so
 * the numbers aren't "published" until validated with buyers. Flip `index` on
 * and add the nav link to publish.
 *
 * Team's CTA is a placeholder until Stripe checkout lands (TRE-67).
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing · Vigilis',
  description:
    'The agent is free and open-source. The governance cloud — signed, searchable, exportable audit trail — is paid. Free / Team / Enterprise.',
  // Held until pricing is validated (TRE-60).
  robots: { index: false, follow: false },
};

const GITHUB = 'https://github.com/piyushpathakqa/Vigilis';
const CONTACT = 'mailto:hello@vigilis.dev';

interface Tier {
  name: string;
  price: string;
  cadence?: string;
  blurb: string;
  features: string[];
  cta: { label: string; href: string };
  featured?: boolean;
}

const TIERS: Tier[] = [
  {
    name: 'Free',
    price: '$0',
    blurb: 'The open-source agent, forever. Run it anywhere, on your own keys.',
    features: [
      'Generate · triage · heal · refuse · gate — unlimited, self-hosted',
      'Local signed receipts (Treeship) + local memory (ZMem)',
      'Audit dashboard taste: 1 repo, 14-day history',
      'Playwright · Cypress · Selenium',
    ],
    cta: { label: 'Get the agent', href: GITHUB },
  },
  {
    name: 'Team',
    price: '$149',
    cadence: '/mo + $25/extra repo (5 included)',
    blurb: 'The hosted governance cloud: one signed, searchable audit trail for your org.',
    features: [
      'Everything in Free',
      'Hosted audit dashboard, up to 5 repos',
      '1-year retention',
      'Compliance export (CSV / JSON)',
      'Shared team memory + review console',
      'Basic approval gates',
    ],
    cta: { label: 'Start Team', href: CONTACT },
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'from ~$24k',
    cadence: '/yr',
    blurb: 'For when Security and Compliance get involved.',
    features: [
      'Everything in Team',
      'Unlimited repos + unlimited retention',
      'SSO · RBAC + policy templates',
      'SOC2-style attestations',
      'Private deploy · multi-tenant · SLA',
    ],
    cta: { label: 'Contact sales', href: CONTACT },
  },
];

export default function PricingPage() {
  return (
    <main className="pr-wrap">
      <nav className="pr-nav">
        <a className="mark" href="/">
          <span className="b">[</span>V<span className="b">]</span> VIGILIS
        </a>
        <a className="pr-back" href="/">
          ← home
        </a>
      </nav>

      <header className="pr-head">
        <span className="pill">
          <span className="dot" /> PRICING
        </span>
        <h1>
          The agent is <span className="g">free</span>. The proof is the product.
        </h1>
        <p className="lede">
          Healing tests is commoditizing — so the agent is open-source and unlimited. The{' '}
          <b>governance cloud</b> on top — a signed, searchable, exportable audit trail of every
          heal and refusal — is what you pay for.
        </p>
      </header>

      <section className="pr-grid">
        {TIERS.map((t) => (
          <div key={t.name} className={`pr-card${t.featured ? ' featured' : ''}`}>
            {t.featured && <div className="pr-badge">Most popular</div>}
            <div className="pr-name">{t.name}</div>
            <div className="pr-price">
              {t.price}
              {t.cadence && <span className="pr-cadence">{t.cadence}</span>}
            </div>
            <p className="pr-blurb">{t.blurb}</p>
            <ul className="pr-features">
              {t.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <a
              className={`pr-cta${t.featured ? ' primary' : ''}`}
              href={t.cta.href}
              {...(t.cta.href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}
            >
              {t.cta.label}
            </a>
          </div>
        ))}
      </section>

      <section className="pr-anchor">
        <p>
          A US QA engineer, fully loaded, runs ~<b>$110k/yr</b>. Team is <b>~1.6%</b> of that.
        </p>
        <p className="pr-line">
          For under 2% of a QA engineer&apos;s salary, a gate on every PR that refuses to hide a
          real bug — and signs the proof.
        </p>
        <p className="pr-note">
          Per-repo, not per-seat: you pay for protected repos, not headcount. Annual billing = two
          months free.
        </p>
      </section>

      <footer className="pr-foot">
        Attestation is <b>verifiable</b> and <b>auditable</b> — it proves what the agent did, in
        order, unaltered. It does not guarantee the agent&apos;s judgment was correct.
      </footer>
    </main>
  );
}

/**
 * Pricing / upgrade page for the governance cloud.
 *
 * The dashboard's upgrade CTAs (over-repo nudge, locked export, retention note)
 * link here. Numbers mirror docs/PRICING.md and the entitlements in
 * `@/entitlements` (Free 1 repo/14d/no export · Team 5 repos/1y/export ·
 * Enterprise unlimited). Public, no auth, no DB — a plain static page.
 *
 * Team's CTA is a placeholder (mailto) until Stripe checkout lands (TRE-67).
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing · Vigilis Cloud',
  description:
    'The agent is free and open-source. The governance cloud — a signed, searchable, exportable audit trail — is paid. Free / Team / Enterprise.',
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
      'Local signed receipts + local memory',
      'Audit dashboard taste: 1 repo, 14-day history',
    ],
    cta: { label: 'Get the agent', href: GITHUB },
  },
  {
    name: 'Team',
    price: '$149',
    cadence: '/mo + $25/extra repo · 5 included',
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
    <main className="wrap">
      <header className="page">
        <div className="mark">
          VIGILIS<span className="b">·</span>CLOUD
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <h1>Pricing</h1>
          <div className="mono dim">
            <a href="/">← back to dashboard</a>
          </div>
        </div>
        <p>
          The agent is free and open-source — healing tests is commoditizing. The{' '}
          <strong>governance cloud</strong> on top — a signed, searchable, exportable audit trail of
          every heal and refusal — is what you pay for.
        </p>
      </header>

      <section className="pricing-grid">
        {TIERS.map((t) => (
          <div key={t.name} className={`pricing-card${t.featured ? ' featured' : ''}`}>
            {t.featured && <div className="pricing-badge">Most popular</div>}
            <div className="pricing-name">{t.name}</div>
            <div className="pricing-price">
              {t.price}
              {t.cadence && <span className="pricing-cadence">{t.cadence}</span>}
            </div>
            <p className="pricing-blurb">{t.blurb}</p>
            <ul className="pricing-features">
              {t.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <a
              className={`pricing-cta${t.featured ? ' primary' : ''}`}
              href={t.cta.href}
              {...(t.cta.href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}
            >
              {t.cta.label}
            </a>
          </div>
        ))}
      </section>

      <section className="pricing-anchor">
        <p>
          A US QA engineer, fully loaded, runs ~<strong>$110k/yr</strong>. Team is{' '}
          <strong>~1.6%</strong> of that — per protected repo, not per seat.
        </p>
        <p className="pricing-line">
          For under 2% of a QA engineer&apos;s salary, a gate on every PR that refuses to hide a
          real bug — and signs the proof.
        </p>
      </section>

      <footer className="retention dim" style={{ marginTop: '1.5rem' }}>
        Attestation is <strong>verifiable</strong> and <strong>auditable</strong> — it proves what
        the agent did, in order, unaltered. It does not guarantee the agent&apos;s judgment was
        correct.
      </footer>
    </main>
  );
}

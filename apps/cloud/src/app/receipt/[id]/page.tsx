/**
 * Receipt detail view (TRE-65). Server component, Node runtime.
 * Shows one receipt's full record, scoped to the signed-in user's org, with a
 * link to its Treeship verify page. Reads node:sqlite, so force-dynamic.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getReceiptById, type ReceiptRow } from '@/db';

const VERDICTS = ['real-bug', 'dom-drift', 'flake'];

function verdictClass(verdict: string): string {
  return VERDICTS.includes(verdict) ? verdict : 'dim';
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().replace('T', ' ').slice(0, 19);
}

/** One label/value row; renders an em-dash for empty values. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const empty = children == null || children === '';
  return (
    <div className="field">
      <div className="flabel mono dim">{label}</div>
      <div className="fvalue">{empty ? <span className="dim">—</span> : children}</div>
    </div>
  );
}

export default async function ReceiptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.orgId) redirect('/signin');

  const { id } = await params;
  const r: ReceiptRow | null = getReceiptById(session.orgId, id);
  if (!r) notFound();

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
          <h1>Receipt detail</h1>
          <a className="mono dim" href="/">
            ← back to dashboard
          </a>
        </div>
        <p>
          The full record reported for this heal/refusal. Attestation is verifiable and auditable —
          it records what happened, not whether the agent&apos;s judgment was correct.
        </p>
      </header>

      <section className="detail">
        <Field label="Verdict">
          <span className={`tag ${verdictClass(r.verdict)}`}>{r.verdict}</span>
        </Field>
        <Field label="Healed">
          <span className={`tag ${r.healed ? 'healed' : 'unhealed'}`}>
            {r.healed ? 'healed' : 'no'}
          </span>
        </Field>
        <Field label="Repo">{r.repo ?? ''}</Field>
        <Field label="Framework">{r.framework ?? ''}</Field>
        <Field label="Spec">
          <span className="mono">{r.spec_path}</span>
        </Field>
        <Field label="URL">
          <span className="mono">{r.url}</span>
        </Field>
        <Field label="Rationale">{r.rationale ?? ''}</Field>
        <Field label="Suggested selector">
          {r.suggested_selector ? <span className="mono">{r.suggested_selector}</span> : ''}
        </Field>
        <Field label="Created">
          <span className="mono dim">{fmtTime(r.created_at)}</span>
        </Field>
        <Field label="Ingested">
          <span className="mono dim">{fmtTime(r.ingested_at)}</span>
        </Field>
        <Field label="Receipt ID">
          {r.receipt_id ? <span className="mono">{r.receipt_id}</span> : ''}
        </Field>
        <Field label="Treeship">
          {r.receipt_url ? (
            <a href={r.receipt_url} target="_blank" rel="noreferrer">
              verify on Treeship ↗
            </a>
          ) : (
            ''
          )}
        </Field>
      </section>
    </main>
  );
}

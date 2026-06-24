/**
 * Audit dashboard (TRE-65 + TRE-63). Server component, Node runtime.
 * Requires a session and scopes receipts to the signed-in user's org.
 * Reads node:sqlite directly, so it must never run at build time (force-dynamic).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { auth, signOut } from '@/auth';
import { getOrg, getReceiptsForOrg, type ReceiptRow } from '@/db';

const VERDICTS = ['real-bug', 'dom-drift', 'flake'];

function verdictClass(verdict: string): string {
  return VERDICTS.includes(verdict) ? verdict : 'dim';
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().replace('T', ' ').slice(0, 19);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ repo?: string; verdict?: string }>;
}) {
  const session = await auth();
  if (!session?.orgId) redirect('/signin');

  const sp = await searchParams;
  const repo = sp.repo?.trim() || undefined;
  const verdict = sp.verdict?.trim() || undefined;

  const org = getOrg(session.orgId);
  const rows: ReceiptRow[] = getReceiptsForOrg(session.orgId, { repo, verdict });

  // Carry the active filters onto the export links so a download matches the view.
  const exportQuery = (format: 'csv' | 'json') => {
    const q = new URLSearchParams({ format });
    if (repo) q.set('repo', repo);
    if (verdict) q.set('verdict', verdict);
    return `/api/export?${q.toString()}`;
  };

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
          <h1>Audit dashboard</h1>
          <div className="mono dim" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span>{org?.name ?? session.orgId}</span>
            <a href="/keys">API keys</a>
            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/signin' });
              }}
            >
              <button type="submit">Sign out</button>
            </form>
          </div>
        </div>
        <p>
          Heal and refusal receipts reported by a configured agent for your org. Attestation is
          verifiable and auditable — it records what happened, not whether the agent&apos;s judgment
          was correct.
        </p>
      </header>

      <form className="filters" method="get">
        <label>
          Repo
          <input type="text" name="repo" defaultValue={repo ?? ''} placeholder="owner/name" />
        </label>
        <label>
          Verdict
          <select name="verdict" defaultValue={verdict ?? ''}>
            <option value="">all</option>
            {VERDICTS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Filter</button>
        {(repo || verdict) && (
          <a className="clear" href="/">
            clear
          </a>
        )}
        <span className="export">
          <a href={exportQuery('csv')}>Export CSV</a>
          <a href={exportQuery('json')}>Export JSON</a>
        </span>
      </form>

      {rows.length === 0 ? (
        <div className="empty">
          No receipts yet. Point an agent at this cloud with{' '}
          <code>VIGILIS_CLOUD_URL=http://localhost:3300 VIGILIS_CLOUD_KEY=&lt;your org key&gt;</code>.
          Create one on the <a href="/keys">API keys</a> page.
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Repo</th>
              <th>Spec</th>
              <th>Verdict</th>
              <th>Healed</th>
              <th>Time</th>
              <th>Receipt</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="mono">{r.repo ?? <span className="dim">—</span>}</td>
                <td className="mono">{r.spec_path}</td>
                <td>
                  <span className={`tag ${verdictClass(r.verdict)}`}>{r.verdict}</span>
                </td>
                <td>
                  <span className={`tag ${r.healed ? 'healed' : 'unhealed'}`}>
                    {r.healed ? 'healed' : 'no'}
                  </span>
                </td>
                <td className="mono dim">{fmtTime(r.created_at)}</td>
                <td>
                  {r.receipt_url ? (
                    <a href={r.receipt_url} target="_blank" rel="noreferrer">
                      verify
                    </a>
                  ) : (
                    <span className="dim">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

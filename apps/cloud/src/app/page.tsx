/**
 * Audit dashboard (TRE-65 + TRE-63). Server component, Node runtime.
 * Requires a session and scopes receipts to the signed-in user's org.
 * Reads node:sqlite directly, so it must never run at build time (force-dynamic).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { auth, signOut } from '@/auth';
import {
  getOrg,
  getReceiptsForOrg,
  getEntitlements,
  distinctReposForOrg,
  type ReceiptRow,
} from '@/db';
import { repoLimitExceeded } from '@/entitlements';

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
  searchParams: Promise<{
    repo?: string;
    verdict?: string;
    spec?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.orgId) redirect('/signin');

  const sp = await searchParams;
  const repo = sp.repo?.trim() || undefined;
  const verdict = sp.verdict?.trim() || undefined;
  const spec = sp.spec?.trim() || undefined;
  const dateFrom = sp.from?.trim() || undefined;
  const dateTo = sp.to?.trim() || undefined;
  const hasFilters = Boolean(repo || verdict || spec || dateFrom || dateTo);

  const org = getOrg(session.orgId);
  const ent = getEntitlements(session.orgId);
  const repoCount = distinctReposForOrg(session.orgId);
  const overRepoLimit = repoLimitExceeded(repoCount, ent);
  const rows: ReceiptRow[] = getReceiptsForOrg(session.orgId, {
    repo,
    verdict,
    spec,
    dateFrom,
    dateTo,
  });

  // Carry the active filters onto the export links so a download matches the view.
  const exportQuery = (format: 'csv' | 'json') => {
    const q = new URLSearchParams({ format });
    if (repo) q.set('repo', repo);
    if (verdict) q.set('verdict', verdict);
    if (spec) q.set('spec', spec);
    if (dateFrom) q.set('from', dateFrom);
    if (dateTo) q.set('to', dateTo);
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

      {overRepoLimit && (
        <div className="nudge">
          You&apos;re protecting <strong>{repoCount}</strong> repos; the {ent.label} plan covers{' '}
          <strong>{ent.repoLimit}</strong>. Receipts are still recorded —{' '}
          <a href="/pricing">upgrade to Team</a> to keep every repo governed.
        </div>
      )}

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
        <label>
          Spec
          <input type="text" name="spec" defaultValue={spec ?? ''} placeholder="login.spec" />
        </label>
        <label>
          From
          <input type="date" name="from" defaultValue={dateFrom ?? ''} />
        </label>
        <label>
          To
          <input type="date" name="to" defaultValue={dateTo ?? ''} />
        </label>
        <button type="submit">Filter</button>
        {hasFilters && (
          <a className="clear" href="/">
            clear
          </a>
        )}
        <span className="export">
          {ent.exportEnabled ? (
            <>
              <a href={exportQuery('csv')}>Export CSV</a>
              <a href={exportQuery('json')}>Export JSON</a>
            </>
          ) : (
            <a className="locked" href="/pricing" title="Export is a Team feature">
              Export (Team) ↗
            </a>
          )}
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
                <td className="mono">
                  <a href={`/receipt/${r.id}`}>{r.spec_path}</a>
                </td>
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

      <p className="retention dim">
        {ent.retentionDays === null ? (
          <>Unlimited retention on the {ent.label} plan.</>
        ) : (
          <>
            {ent.label} retains {ent.retentionDays} days of history — older receipts roll off.
            {!ent.exportEnabled || ent.retentionDays < 365 ? (
              <>
                {' '}
                <a href="/pricing">Upgrade</a> for longer retention and compliance export.
              </>
            ) : null}
          </>
        )}
      </p>
    </main>
  );
}

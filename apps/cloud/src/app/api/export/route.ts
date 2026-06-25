/**
 * Compliance export (TRE-66). GET the signed-in org's audit trail as CSV or
 * JSON, honoring the same repo/verdict filters as the dashboard.
 *
 *   GET /api/export?format=csv|json&repo=owner/name&verdict=real-bug
 *
 * Session-authenticated (not API-key) — this is a browser download from the
 * dashboard. Scoped to the caller's org so one tenant can't export another's.
 * node:sqlite requires the Node runtime.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { getReceiptsForOrg, getEntitlements } from '@/db';
import { toCsv, toJson } from '@/export';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.orgId) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Compliance export is a paid feature — free plans hit a wall with an upgrade nudge.
  const ent = getEntitlements(session.orgId);
  if (!ent.exportEnabled) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'export_requires_upgrade',
        message: `Compliance export isn't included on the ${ent.label} plan. Upgrade to Team to export your audit trail.`,
        upgradeUrl: '/pricing',
      }),
      { status: 403, headers: { 'content-type': 'application/json' } },
    );
  }

  const query = new URL(req.url).searchParams;
  const format = query.get('format') === 'json' ? 'json' : 'csv';
  const repo = query.get('repo')?.trim() || undefined;
  const verdict = query.get('verdict')?.trim() || undefined;

  const rows = getReceiptsForOrg(session.orgId, { repo, verdict });

  // Date-stamped, filter-aware filename so audit exports are self-describing.
  const date = new Date().toISOString().slice(0, 10);
  const scope = [repo?.replace(/[^a-z0-9]+/gi, '-'), verdict].filter(Boolean).join('-');
  const filename = `vigilis-audit-${date}${scope ? `-${scope}` : ''}.${format}`;

  const body = format === 'json' ? toJson(rows) : toCsv(rows);
  const contentType =
    format === 'json' ? 'application/json; charset=utf-8' : 'text/csv; charset=utf-8';

  return new Response(body, {
    status: 200,
    headers: {
      'content-type': contentType,
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
}

/**
 * Ingest API (TRE-64). POST a CloudReceipt with a Bearer org API key.
 * node:sqlite requires the Node runtime.
 */
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import {
  findOrgByApiKey,
  insertReceipt,
  getEntitlements,
  distinctReposForOrg,
  type CloudReceipt,
} from '@/db';
import { repoLimitExceeded } from '@/entitlements';

function bearer(req: Request): string | null {
  const h = req.headers.get('authorization') ?? '';
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m?.[1] ? m[1].trim() : null;
}

function isValidReceipt(b: unknown): b is CloudReceipt {
  if (!b || typeof b !== 'object') return false;
  const r = b as Record<string, unknown>;
  return (
    typeof r.specPath === 'string' &&
    r.specPath.length > 0 &&
    typeof r.url === 'string' &&
    typeof r.verdict === 'string' &&
    r.verdict.length > 0 &&
    typeof r.healed === 'boolean'
  );
}

export async function POST(req: Request) {
  const key = bearer(req);
  const org = key ? findOrgByApiKey(key) : null;
  if (!org) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid json' },
      { status: 400 },
    );
  }

  if (!isValidReceipt(body)) {
    return NextResponse.json(
      { ok: false, error: 'invalid receipt' },
      { status: 400 },
    );
  }

  // Default an absent timestamp so dedupe + ordering stay sane.
  const receipt: CloudReceipt = {
    ...body,
    timestamp:
      typeof body.timestamp === 'string' && body.timestamp.length > 0
        ? body.timestamp
        : new Date().toISOString(),
  };

  // Always store — never drop audit data. If the org is now over its plan's
  // repo limit, accept-but-flag with an upgrade nudge (the agent/CI sees it).
  const result = insertReceipt(org.id, receipt);

  const ent = getEntitlements(org.id);
  const repos = distinctReposForOrg(org.id);
  const resBody: Record<string, unknown> = { ok: true };
  if (repoLimitExceeded(repos, ent)) {
    resBody.warning = 'repo_limit_exceeded';
    resBody.message =
      `Your ${ent.label} plan covers ${ent.repoLimit} ` +
      `repo${ent.repoLimit === 1 ? '' : 's'}; you're now reporting ${repos}. ` +
      `Receipts are still recorded — upgrade to keep them all governed: ` +
      `https://vigilis.dev/pricing`;
  }
  return NextResponse.json(resBody, { status: result.inserted ? 201 : 200 });
}

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmpDir: string;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vigilis-cloud-test-'));
  process.env.VIGILIS_CLOUD_DB = join(tmpDir, 'cloud.db');
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// Import after VIGILIS_CLOUD_DB is set so getDb() opens the temp file.
async function db() {
  return import('./db');
}

function receipt(over: Partial<import('./db').CloudReceipt> = {}): import('./db').CloudReceipt {
  return {
    specPath: 'tests/login.spec.ts',
    url: 'http://localhost:3100/login',
    verdict: 'dom-drift',
    healed: true,
    repo: 'acme/shop',
    timestamp: '2026-06-24T10:00:00.000Z',
    ...over,
  };
}

describe('governance-cloud db', () => {
  it('seeds the Acme Dev org and dev API key', async () => {
    const { findOrgByApiKey, DEV_API_KEY } = await db();
    const org = findOrgByApiKey(DEV_API_KEY);
    expect(org).not.toBeNull();
    expect(org?.name).toBe('Acme Dev');
  });

  it('rejects an unknown API key', async () => {
    const { findOrgByApiKey } = await db();
    expect(findOrgByApiKey('nope')).toBeNull();
    expect(findOrgByApiKey('')).toBeNull();
  });

  it('inserts a receipt and is idempotent on receiptId', async () => {
    const { findOrgByApiKey, DEV_API_KEY, insertReceipt, listReceipts } = await db();
    const org = findOrgByApiKey(DEV_API_KEY)!;

    const r = receipt({ receiptId: 'treeship_abc', verdict: 'flake' });
    const first = insertReceipt(org.id, r);
    expect(first.inserted).toBe(true);

    const second = insertReceipt(org.id, r);
    expect(second.inserted).toBe(false);
    expect(second.id).toBe(first.id);

    const flakes = listReceipts(org.id, { verdict: 'flake' });
    expect(flakes).toHaveLength(1);
  });

  it('dedupes receipts without a receiptId on spec+url+timestamp', async () => {
    const { findOrgByApiKey, DEV_API_KEY, insertReceipt } = await db();
    const org = findOrgByApiKey(DEV_API_KEY)!;
    const r = receipt({ specPath: 'tests/cart.spec.ts', timestamp: '2026-06-24T11:00:00.000Z' });
    expect(insertReceipt(org.id, r).inserted).toBe(true);
    expect(insertReceipt(org.id, r).inserted).toBe(false);
  });

  it('listReceipts filters by verdict and repo', async () => {
    const { findOrgByApiKey, DEV_API_KEY, insertReceipt, listReceipts } = await db();
    const org = findOrgByApiKey(DEV_API_KEY)!;

    insertReceipt(
      org.id,
      receipt({
        receiptId: 'r_realbug',
        verdict: 'real-bug',
        healed: false,
        repo: 'acme/other',
        timestamp: '2026-06-24T12:00:00.000Z',
      }),
    );

    const realBugs = listReceipts(org.id, { verdict: 'real-bug' });
    expect(realBugs.every((row) => row.verdict === 'real-bug')).toBe(true);
    expect(realBugs.length).toBeGreaterThanOrEqual(1);

    const byRepo = listReceipts(org.id, { repo: 'acme/other' });
    expect(byRepo.every((row) => row.repo === 'acme/other')).toBe(true);
    expect(byRepo.length).toBeGreaterThanOrEqual(1);
  });
});

describe('auth + multi-tenant (TRE-63)', () => {
  it('ensureUserAndOrg creates user+org+membership+default key, idempotently', async () => {
    const { ensureUserAndOrg, getOrg, listApiKeys } = await db();

    const first = ensureUserAndOrg({ email: 'alice@example.com', name: 'Alice' });
    expect(first.userId).toBeTruthy();
    expect(first.orgId).toBeTruthy();
    expect(first.role).toBe('admin');

    const org = getOrg(first.orgId);
    expect(org).not.toBeNull();
    expect(org?.name).toContain('Alice');

    const keys = listApiKeys(first.orgId);
    expect(keys).toHaveLength(1);
    expect(keys[0]?.name).toBe('Default key');

    // Second call: same ids, no duplicate org/key.
    const second = ensureUserAndOrg({ email: 'ALICE@example.com', name: 'Alice' });
    expect(second.userId).toBe(first.userId);
    expect(second.orgId).toBe(first.orgId);
    expect(listApiKeys(first.orgId)).toHaveLength(1);
  });

  it('createApiKey/listApiKeys round-trip and authenticate; revoke disables', async () => {
    const { ensureUserAndOrg, createApiKey, listApiKeys, revokeApiKey, findOrgByApiKey } = await db();
    const { orgId } = ensureUserAndOrg({ email: 'bob@example.com', name: 'Bob' });

    const before = listApiKeys(orgId).length;
    const { id, plaintext } = createApiKey(orgId, 'CI key');
    expect(plaintext.startsWith('vigilis_')).toBe(true);

    const keys = listApiKeys(orgId);
    expect(keys.length).toBe(before + 1);
    const created = keys.find((k) => k.id === id)!;
    expect(created.name).toBe('CI key');
    // Plaintext is never stored — only a masked preview.
    expect(created.masked).toMatch(/^vigilis_…/);
    expect(JSON.stringify(created)).not.toContain(plaintext);

    // The key authenticates to its org.
    const org = findOrgByApiKey(plaintext);
    expect(org?.id).toBe(orgId);

    // After revoke it no longer authenticates, and is scoped to the org.
    expect(revokeApiKey('org_wrong', id)).toBe(false);
    expect(revokeApiKey(orgId, id)).toBe(true);
    expect(findOrgByApiKey(plaintext)).toBeNull();
  });

  it('getReceiptsForOrg scopes by org and filters by repo/verdict', async () => {
    const { ensureUserAndOrg, createApiKey, insertReceipt, getReceiptsForOrg } = await db();
    const a = ensureUserAndOrg({ email: 'carol@example.com', name: 'Carol' });
    const b = ensureUserAndOrg({ email: 'dave@example.com', name: 'Dave' });
    createApiKey(a.orgId, 'k'); // ensure orgs distinct + provisioned

    insertReceipt(a.orgId, receipt({ receiptId: 'a1', repo: 'carol/app', verdict: 'real-bug' }));
    insertReceipt(a.orgId, receipt({ receiptId: 'a2', repo: 'carol/app', verdict: 'flake' }));
    insertReceipt(b.orgId, receipt({ receiptId: 'b1', repo: 'dave/app', verdict: 'real-bug' }));

    const aAll = getReceiptsForOrg(a.orgId);
    expect(aAll.every((r) => r.org_id === a.orgId)).toBe(true);
    expect(aAll.length).toBe(2);

    const aBugs = getReceiptsForOrg(a.orgId, { verdict: 'real-bug' });
    expect(aBugs).toHaveLength(1);
    expect(aBugs[0]?.repo).toBe('carol/app');

    const aByRepo = getReceiptsForOrg(a.orgId, { repo: 'carol/app' });
    expect(aByRepo).toHaveLength(2);

    // b's receipt does not leak into a's view.
    expect(aAll.some((r) => r.receipt_id === 'b1')).toBe(false);
  });
});

describe('dashboard search + detail (TRE-65)', () => {
  it('filters by spec substring (case-insensitive) and escapes LIKE wildcards', async () => {
    const { ensureUserAndOrg, insertReceipt, listReceipts } = await db();
    const { orgId } = ensureUserAndOrg({ email: 'erin@example.com', name: 'Erin' });

    insertReceipt(orgId, receipt({ receiptId: 's1', specPath: 'tests/login.spec.ts' }));
    insertReceipt(orgId, receipt({ receiptId: 's2', specPath: 'tests/checkout.spec.ts' }));
    insertReceipt(orgId, receipt({ receiptId: 's3', specPath: 'tests/100%-coverage.spec.ts' }));

    // Substring, case-insensitive.
    const login = listReceipts(orgId, { spec: 'LOGIN' });
    expect(login).toHaveLength(1);
    expect(login[0]?.spec_path).toBe('tests/login.spec.ts');

    // Common '.spec' matches all three.
    expect(listReceipts(orgId, { spec: '.spec' })).toHaveLength(3);

    // '%' is matched literally, not as a wildcard.
    const pct = listReceipts(orgId, { spec: '100%' });
    expect(pct).toHaveLength(1);
    expect(pct[0]?.spec_path).toContain('100%');
  });

  it('filters by inclusive created_at date range', async () => {
    const { ensureUserAndOrg, insertReceipt, listReceipts } = await db();
    const { orgId } = ensureUserAndOrg({ email: 'frank@example.com', name: 'Frank' });

    insertReceipt(orgId, receipt({ receiptId: 'd1', timestamp: '2026-06-20T09:00:00.000Z' }));
    insertReceipt(orgId, receipt({ receiptId: 'd2', timestamp: '2026-06-24T15:00:00.000Z' }));
    insertReceipt(orgId, receipt({ receiptId: 'd3', timestamp: '2026-06-28T23:30:00.000Z' }));

    // from only.
    expect(listReceipts(orgId, { dateFrom: '2026-06-24' })).toHaveLength(2);
    // to only — end-of-day inclusive captures the 15:00 receipt on the 24th.
    expect(listReceipts(orgId, { dateTo: '2026-06-24' })).toHaveLength(2);
    // both bounds.
    const window = listReceipts(orgId, { dateFrom: '2026-06-24', dateTo: '2026-06-24' });
    expect(window).toHaveLength(1);
    expect(window[0]?.receipt_id).toBe('d2');
  });

  it('getReceiptById returns the row for its org and null cross-tenant', async () => {
    const { ensureUserAndOrg, insertReceipt, getReceiptById } = await db();
    const owner = ensureUserAndOrg({ email: 'grace@example.com', name: 'Grace' });
    const other = ensureUserAndOrg({ email: 'heidi@example.com', name: 'Heidi' });

    const ins = insertReceipt(owner.orgId, receipt({ receiptId: 'det1', specPath: 'tests/detail.spec.ts' }));

    const got = getReceiptById(owner.orgId, ins.id);
    expect(got?.spec_path).toBe('tests/detail.spec.ts');

    // Another tenant cannot read it; unknown id is null.
    expect(getReceiptById(other.orgId, ins.id)).toBeNull();
    expect(getReceiptById(owner.orgId, 'nope')).toBeNull();
  });
});

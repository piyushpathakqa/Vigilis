/**
 * Governance-cloud data layer (TRE-62/64).
 *
 * Uses Node's built-in `node:sqlite` (Node 24+) — no Prisma, no native engine.
 * Any Next.js route/page importing this module MUST declare
 * `export const runtime = 'nodejs'` (node:sqlite is unavailable on Edge).
 *
 * The cloud only consumes the `CloudReceipt` shape from the OSS core — it never
 * imports the agent. The type is re-declared here (the published @argus/core
 * surface) so the cloud stays decoupled from core's build output.
 */
import { createRequire } from 'node:module';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  entitlementsForPlan,
  normalizePlan,
  type Entitlements,
  type Plan,
} from '@/entitlements';

/** Metadata sent to the governance cloud ingest endpoint. Matches @argus/core CloudReceipt. */
export interface CloudReceipt {
  specPath: string;
  url: string;
  verdict: string;
  healed: boolean;
  rationale?: string;
  suggestedSelector?: string;
  framework?: string;
  repo?: string;
  receiptId?: string;
  receiptUrl?: string;
  timestamp: string;
}

export interface OrgRow {
  id: string;
  name: string;
  plan: string;
  created_at: string;
}

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  created_at: string;
}

export interface ApiKeyRow {
  id: string;
  org_id: string;
  name: string | null;
  /** Masked preview (e.g. "vigilis_…ab12"). Plaintext is never stored. */
  masked: string;
  created_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
}

export interface ReceiptRow {
  id: string;
  org_id: string;
  repo: string | null;
  spec_path: string;
  url: string;
  verdict: string;
  healed: number;
  rationale: string | null;
  suggested_selector: string | null;
  framework: string | null;
  receipt_id: string | null;
  receipt_url: string | null;
  created_at: string;
  ingested_at: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Load node:sqlite via a runtime require so bundlers (Vite/Vitest, Next/webpack)
 * don't try to statically resolve the built-in (it's listed in builtinModules
 * only under its `node:` specifier, which trips Vite's externalization).
 */
type DatabaseSyncCtor = new (path: string) => {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): unknown;
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  };
  close(): void;
};
type DatabaseSync = InstanceType<DatabaseSyncCtor>;
const nodeRequire = createRequire(import.meta.url);
const { DatabaseSync } = nodeRequire('node:sqlite') as {
  DatabaseSync: DatabaseSyncCtor;
};

/** Plaintext dev API key seeded for local use. */
export const DEV_API_KEY = 'vigilis_dev_key';
const DEV_ORG_ID = 'org_acme_dev';
const DEV_KEY_ID = 'key_acme_dev';

function dbPath(): string {
  return (
    process.env.VIGILIS_CLOUD_DB ??
    resolve(__dirname, '..', '.data', 'cloud.db')
  );
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

let cached: DatabaseSync | null = null;
let cachedPath: string | null = null;

/** Open (memoized per path) the SQLite DB, creating schema + dev seed. */
export function getDb(): DatabaseSync {
  const path = dbPath();
  if (cached && cachedPath === path) return cached;
  if (cached) {
    cached.close();
    cached = null;
  }
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  migrate(db);
  seed(db);
  cached = db;
  cachedPath = path;
  return db;
}

function migrate(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS org (
      id TEXT PRIMARY KEY,
      name TEXT,
      plan TEXT DEFAULT 'free',
      created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS api_key (
      id TEXT PRIMARY KEY,
      org_id TEXT,
      name TEXT,
      key_hash TEXT,
      masked TEXT,
      created_at TEXT,
      revoked_at TEXT,
      last_used_at TEXT
    );
    CREATE TABLE IF NOT EXISTS user (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      name TEXT,
      image TEXT,
      created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS org_member (
      org_id TEXT,
      user_id TEXT,
      role TEXT DEFAULT 'admin',
      created_at TEXT,
      PRIMARY KEY (org_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS receipt (
      id TEXT PRIMARY KEY,
      org_id TEXT,
      repo TEXT,
      spec_path TEXT,
      url TEXT,
      verdict TEXT,
      healed INTEGER,
      rationale TEXT,
      suggested_selector TEXT,
      framework TEXT,
      receipt_id TEXT,
      receipt_url TEXT,
      created_at TEXT,
      ingested_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_receipt_org_created
      ON receipt (org_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_org_member_user
      ON org_member (user_id);
  `);

  // Bring older api_key tables (pre-TRE-63) up to the current shape.
  for (const col of ['masked TEXT', 'last_used_at TEXT']) {
    try {
      db.exec(`ALTER TABLE api_key ADD COLUMN ${col};`);
    } catch {
      // Column already exists — ignore.
    }
  }
}

/** Idempotent dev seed: an "Acme Dev" org + a known API key. */
function seed(db: DatabaseSync): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT OR IGNORE INTO org (id, name, plan, created_at)
     VALUES (?, ?, ?, ?)`,
  ).run(DEV_ORG_ID, 'Acme Dev', 'free', now);
  db.prepare(
    `INSERT OR IGNORE INTO api_key (id, org_id, name, key_hash, masked, created_at, revoked_at, last_used_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)`,
  ).run(DEV_KEY_ID, DEV_ORG_ID, 'dev key', sha256(DEV_API_KEY), maskKey(DEV_API_KEY), now);
}

/** Build a non-secret display preview of a plaintext key. */
function maskKey(plaintext: string): string {
  const tail = plaintext.slice(-4);
  return `vigilis_…${tail}`;
}

/** Slugify a GitHub login / email-local-part into a readable org name. */
function orgNameFor(identity: { name?: string | null; email: string }): string {
  if (identity.name && identity.name.trim()) return `${identity.name.trim()}'s org`;
  const local = identity.email.split('@')[0] || 'personal';
  return `${local}'s org`;
}

/** Look up the owning org for a plaintext API key. Rejects revoked keys. Returns null if unknown. */
export function findOrgByApiKey(plaintextKey: string): OrgRow | null {
  if (!plaintextKey) return null;
  const db = getDb();
  const hash = sha256(plaintextKey);
  const row = db
    .prepare(
      `SELECT o.id AS id, o.name AS name, o.plan AS plan, o.created_at AS created_at
         FROM api_key k
         JOIN org o ON o.id = k.org_id
        WHERE k.key_hash = ? AND k.revoked_at IS NULL`,
    )
    .get(hash) as OrgRow | undefined;
  if (!row) return null;
  db.prepare(`UPDATE api_key SET last_used_at = ? WHERE key_hash = ?`).run(
    new Date().toISOString(),
    hash,
  );
  return row;
}

/** Stable dedupe key when no Treeship receiptId is present. */
function dedupeHash(r: CloudReceipt): string {
  return sha256(`${r.specPath} ${r.url} ${r.timestamp}`);
}

export type InsertResult = { inserted: boolean; id: string };

/**
 * Insert a receipt. Idempotent:
 *   - if receiptId is present, dedupe on (org_id, receipt_id);
 *   - otherwise dedupe on a hash of (specPath, url, timestamp) stored as receipt_id.
 * Re-sends are a no-op and return { inserted: false }.
 */
export function insertReceipt(orgId: string, r: CloudReceipt): InsertResult {
  const db = getDb();
  const dedupeId = r.receiptId ?? `auto_${dedupeHash(r)}`;

  const existing = db
    .prepare(`SELECT id FROM receipt WHERE org_id = ? AND receipt_id = ?`)
    .get(orgId, dedupeId) as { id: string } | undefined;
  if (existing) return { inserted: false, id: existing.id };

  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO receipt
       (id, org_id, repo, spec_path, url, verdict, healed, rationale,
        suggested_selector, framework, receipt_id, receipt_url,
        created_at, ingested_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    orgId,
    r.repo ?? null,
    r.specPath,
    r.url,
    r.verdict,
    r.healed ? 1 : 0,
    r.rationale ?? null,
    r.suggestedSelector ?? null,
    r.framework ?? null,
    dedupeId,
    r.receiptUrl ?? null,
    r.timestamp,
    now,
  );
  return { inserted: true, id };
}

export interface ListFilter {
  repo?: string;
  verdict?: string;
  /** Case-insensitive substring match on spec_path. */
  spec?: string;
  /** Inclusive lower bound on created_at, as an ISO date (YYYY-MM-DD) or timestamp. */
  dateFrom?: string;
  /** Inclusive upper bound on created_at, as an ISO date (YYYY-MM-DD) or timestamp. */
  dateTo?: string;
}

/** Escape LIKE wildcards so user input is matched literally (paired with ESCAPE '\'). */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** List an org's receipts (newest first), optionally filtered by repo/verdict/spec/date. */
export function listReceipts(orgId: string, filter: ListFilter = {}): ReceiptRow[] {
  const db = getDb();
  const clauses = ['org_id = ?'];
  const params: unknown[] = [orgId];
  if (filter.repo) {
    clauses.push('repo = ?');
    params.push(filter.repo);
  }
  if (filter.verdict) {
    clauses.push('verdict = ?');
    params.push(filter.verdict);
  }
  if (filter.spec) {
    clauses.push("spec_path LIKE ? ESCAPE '\\'");
    params.push(`%${escapeLike(filter.spec)}%`);
  }
  if (filter.dateFrom) {
    clauses.push('created_at >= ?');
    params.push(filter.dateFrom);
  }
  if (filter.dateTo) {
    // Bare dates (YYYY-MM-DD) sort before that day's timestamps; extend to end-of-day
    // so an inclusive "to 2026-06-24" still captures 2026-06-24T15:00:00Z.
    const upper = /^\d{4}-\d{2}-\d{2}$/.test(filter.dateTo)
      ? `${filter.dateTo}T23:59:59.999Z`
      : filter.dateTo;
    clauses.push('created_at <= ?');
    params.push(upper);
  }
  return db
    .prepare(
      `SELECT * FROM receipt
        WHERE ${clauses.join(' AND ')}
        ORDER BY created_at DESC, ingested_at DESC`,
    )
    .all(...(params as never[])) as ReceiptRow[];
}

/** Fetch a single receipt by id, scoped to its org (null if absent or another tenant's). */
export function getReceiptById(orgId: string, id: string): ReceiptRow | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM receipt WHERE id = ? AND org_id = ?`)
    .get(id, orgId) as ReceiptRow | undefined;
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Entitlements (TRE-68) — org-aware wrappers over the pure entitlements module.
// ---------------------------------------------------------------------------

/** Count of distinct, non-empty repos an org has reported (drives repo-limit gating). */
export function distinctReposForOrg(orgId: string): number {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COUNT(DISTINCT repo) AS n FROM receipt
        WHERE org_id = ? AND repo IS NOT NULL AND repo <> ''`,
    )
    .get(orgId) as { n: number | bigint } | undefined;
  return Number(row?.n ?? 0);
}

/** Resolve an org's entitlements from its plan — the single source of truth for limits. */
export function getEntitlements(orgId: string): Entitlements {
  const org = getOrg(orgId);
  // extraRepos (Team per-repo add-ons) will come from the Stripe subscription
  // in TRE-67; until then every org runs on its base plan limits.
  return entitlementsForPlan(org?.plan);
}

/**
 * Set an org's plan. This is the seam Stripe webhooks (TRE-67) call on a
 * subscription create/update/cancel — billing writes the plan, enforcement
 * reads it. Until Stripe is wired, it's also how a plan is set for testing.
 */
export function applyPlan(orgId: string, plan: Plan): void {
  const db = getDb();
  db.prepare(`UPDATE org SET plan = ? WHERE id = ?`).run(normalizePlan(plan), orgId);
}

/** The seeded dev org id (kept for backward-compat / the ingest dev key). */
export function devOrgId(): string {
  return DEV_ORG_ID;
}

// ---------------------------------------------------------------------------
// Auth + multi-tenant helpers (TRE-63)
// ---------------------------------------------------------------------------

export interface EnsuredOrg {
  userId: string;
  orgId: string;
  role: string;
}

/**
 * Idempotently provision a signed-in user's home:
 *   - a `user` row (keyed by email),
 *   - a personal `org` they admin,
 *   - an `org_member(role='admin')` link,
 *   - a default `api_key` if the org has none.
 * Safe to call on every sign-in: a second call returns the same ids and
 * creates nothing new.
 */
export function ensureUserAndOrg(identity: {
  email: string;
  name?: string | null;
  image?: string | null;
}): EnsuredOrg {
  const email = identity.email.trim().toLowerCase();
  if (!email) throw new Error('ensureUserAndOrg: email is required');
  const db = getDb();
  const now = new Date().toISOString();

  let user = db
    .prepare(`SELECT * FROM user WHERE email = ?`)
    .get(email) as UserRow | undefined;
  if (!user) {
    const userId = `usr_${randomUUID()}`;
    db.prepare(
      `INSERT INTO user (id, email, name, image, created_at) VALUES (?, ?, ?, ?, ?)`,
    ).run(userId, email, identity.name ?? null, identity.image ?? null, now);
    user = { id: userId, email, name: identity.name ?? null, image: identity.image ?? null, created_at: now };
  } else if (identity.name || identity.image) {
    // Keep profile fields fresh without disturbing membership.
    db.prepare(`UPDATE user SET name = COALESCE(?, name), image = COALESCE(?, image) WHERE id = ?`).run(
      identity.name ?? null,
      identity.image ?? null,
      user.id,
    );
  }

  // Find an existing admin membership; otherwise create the personal org.
  let membership = db
    .prepare(
      `SELECT org_id AS orgId, role FROM org_member WHERE user_id = ? ORDER BY created_at ASC LIMIT 1`,
    )
    .get(user.id) as { orgId: string; role: string } | undefined;

  if (!membership) {
    const orgId = `org_${randomUUID()}`;
    db.prepare(`INSERT INTO org (id, name, plan, created_at) VALUES (?, ?, 'free', ?)`).run(
      orgId,
      orgNameFor({ name: identity.name, email }),
      now,
    );
    db.prepare(
      `INSERT INTO org_member (org_id, user_id, role, created_at) VALUES (?, ?, 'admin', ?)`,
    ).run(orgId, user.id, now);
    membership = { orgId, role: 'admin' };
  }

  // Ensure the org has at least one (active) key.
  const hasKey = db
    .prepare(`SELECT 1 FROM api_key WHERE org_id = ? AND revoked_at IS NULL LIMIT 1`)
    .get(membership.orgId) as unknown;
  if (!hasKey) {
    createApiKey(membership.orgId, 'Default key');
  }

  return { userId: user.id, orgId: membership.orgId, role: membership.role };
}

/** Fetch an org by id (e.g. for header display). */
export function getOrg(orgId: string): OrgRow | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM org WHERE id = ?`).get(orgId) as OrgRow | undefined;
  return row ?? null;
}

/** List an org's API keys (newest first). Never returns plaintext or hashes. */
export function listApiKeys(orgId: string): ApiKeyRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, org_id, name, masked, created_at, revoked_at, last_used_at
         FROM api_key WHERE org_id = ? ORDER BY created_at DESC`,
    )
    .all(orgId) as ApiKeyRow[];
}

/**
 * Mint a new API key for an org. The plaintext is returned ONCE here and is
 * never persisted — only its sha256 hash and a masked preview are stored.
 */
export function createApiKey(orgId: string, name: string): { id: string; plaintext: string } {
  const db = getDb();
  const id = `key_${randomUUID()}`;
  const plaintext = `vigilis_${randomBytes(24).toString('base64url')}`;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO api_key (id, org_id, name, key_hash, masked, created_at, revoked_at, last_used_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)`,
  ).run(id, orgId, name?.trim() || 'API key', sha256(plaintext), maskKey(plaintext), now);
  return { id, plaintext };
}

/** Revoke a key (scoped to its org so one tenant can't revoke another's). */
export function revokeApiKey(orgId: string, keyId: string): boolean {
  const db = getDb();
  const res = db
    .prepare(`UPDATE api_key SET revoked_at = ? WHERE id = ? AND org_id = ? AND revoked_at IS NULL`)
    .run(new Date().toISOString(), keyId, orgId) as { changes?: number | bigint };
  return Number(res.changes ?? 0) > 0;
}

export type ReceiptFilter = ListFilter;

/** Org-scoped receipt listing with optional repo/verdict/spec/date filters (newest first). */
export function getReceiptsForOrg(orgId: string, filter: ReceiptFilter = {}): ReceiptRow[] {
  return listReceipts(orgId, filter);
}

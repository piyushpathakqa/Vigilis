/**
 * Compliance export serializers (TRE-66).
 *
 * Pure functions that turn an org's receipt rows into a CSV or JSON audit
 * trail for a security/compliance review. No I/O, no DB — fully unit-testable.
 * The route layer (src/app/api/export/route.ts) handles auth, org-scoping,
 * and the HTTP response; this module only formats already-fetched rows.
 */
import type { ReceiptRow } from '@/db';

/**
 * Columns exported to CSV, in order. We drop internal-only fields (the surrogate
 * `id` and `org_id`) and surface the audit-relevant ones with stable header names.
 */
const COLUMNS: ReadonlyArray<{ header: string; value: (r: ReceiptRow) => string }> = [
  { header: 'repo', value: (r) => r.repo ?? '' },
  { header: 'spec_path', value: (r) => r.spec_path },
  { header: 'url', value: (r) => r.url },
  { header: 'verdict', value: (r) => r.verdict },
  { header: 'healed', value: (r) => (r.healed ? 'true' : 'false') },
  { header: 'rationale', value: (r) => r.rationale ?? '' },
  { header: 'suggested_selector', value: (r) => r.suggested_selector ?? '' },
  { header: 'framework', value: (r) => r.framework ?? '' },
  { header: 'receipt_id', value: (r) => r.receipt_id ?? '' },
  { header: 'receipt_url', value: (r) => r.receipt_url ?? '' },
  { header: 'created_at', value: (r) => r.created_at },
  { header: 'ingested_at', value: (r) => r.ingested_at },
];

/**
 * Escape a single CSV field per RFC 4180: wrap in double quotes when the value
 * contains a comma, quote, CR or LF, and double any embedded quotes.
 */
function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Serialize receipt rows to RFC-4180 CSV (header row + one row per receipt, CRLF-delimited). */
export function toCsv(rows: ReceiptRow[]): string {
  const header = COLUMNS.map((c) => c.header).join(',');
  const body = rows.map((r) => COLUMNS.map((c) => escapeCsvField(c.value(r))).join(','));
  return [header, ...body].join('\r\n');
}

/** A single receipt as it appears in the JSON export (audit-relevant fields only). */
export interface ExportedReceipt {
  repo: string | null;
  specPath: string;
  url: string;
  verdict: string;
  healed: boolean;
  rationale: string | null;
  suggestedSelector: string | null;
  framework: string | null;
  receiptId: string | null;
  receiptUrl: string | null;
  createdAt: string;
  ingestedAt: string;
}

/** Map a DB row to the public export shape (camelCase, booleans normalized). */
export function toExportedReceipt(r: ReceiptRow): ExportedReceipt {
  return {
    repo: r.repo,
    specPath: r.spec_path,
    url: r.url,
    verdict: r.verdict,
    healed: Boolean(r.healed),
    rationale: r.rationale,
    suggestedSelector: r.suggested_selector,
    framework: r.framework,
    receiptId: r.receipt_id,
    receiptUrl: r.receipt_url,
    createdAt: r.created_at,
    ingestedAt: r.ingested_at,
  };
}

/** Serialize receipt rows to a pretty-printed JSON audit trail. */
export function toJson(rows: ReceiptRow[]): string {
  return JSON.stringify(rows.map(toExportedReceipt), null, 2);
}

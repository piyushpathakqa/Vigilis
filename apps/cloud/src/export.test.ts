import { describe, expect, it } from 'vitest';
import { toCsv, toJson, toExportedReceipt, type ExportedReceipt } from './export';
import type { ReceiptRow } from './db';

function row(over: Partial<ReceiptRow> = {}): ReceiptRow {
  return {
    id: 'rcpt_1',
    org_id: 'org_1',
    repo: 'acme/shop',
    spec_path: 'tests/login.spec.ts',
    url: 'http://localhost:3100/login',
    verdict: 'dom-drift',
    healed: 1,
    rationale: 'locator drift; behavior unchanged',
    suggested_selector: '[data-test="submit"]',
    framework: 'playwright',
    receipt_id: 'tre_abc123',
    receipt_url: 'https://treeship.dev/r/abc123',
    created_at: '2026-06-24T10:00:00.000Z',
    ingested_at: '2026-06-24T10:00:01.000Z',
    ...over,
  };
}

describe('compliance export — CSV', () => {
  it('emits a header row followed by one CRLF-delimited row per receipt', () => {
    const csv = toCsv([row(), row({ id: 'rcpt_2', verdict: 'real-bug', healed: 0 })]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe(
      'repo,spec_path,url,verdict,healed,rationale,suggested_selector,framework,receipt_id,receipt_url,created_at,ingested_at',
    );
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('acme/shop');
    expect(lines[1]).toContain('true');
    expect(lines[2]).toContain('real-bug');
    expect(lines[2]).toContain('false');
  });

  it('escapes commas, quotes and newlines per RFC 4180', () => {
    const csv = toCsv([
      row({ rationale: 'has, comma', suggested_selector: 'has "quote"', url: 'line1\nline2' }),
    ]);
    const dataLine = csv.split('\r\n')[1]!;
    expect(dataLine).toContain('"has, comma"');
    expect(dataLine).toContain('"has ""quote"""');
    expect(csv).toContain('"line1\nline2"');
  });

  it('renders null optional fields as empty cells, not the literal "null"', () => {
    const csv = toCsv([
      row({ repo: null, rationale: null, suggested_selector: null, framework: null, receipt_id: null, receipt_url: null }),
    ]);
    const dataLine = csv.split('\r\n')[1]!;
    expect(dataLine).not.toContain('null');
    // repo is the first column → leading empty field.
    expect(dataLine.startsWith(',')).toBe(true);
  });

  it('emits only a header for an empty result set', () => {
    const csv = toCsv([]);
    expect(csv.split('\r\n')).toHaveLength(1);
  });
});

describe('compliance export — JSON', () => {
  it('maps rows to the camelCase export shape with normalized booleans', () => {
    const exported: ExportedReceipt = toExportedReceipt(row({ healed: 0 }));
    expect(exported.healed).toBe(false);
    expect(exported.specPath).toBe('tests/login.spec.ts');
    expect(exported.suggestedSelector).toBe('[data-test="submit"]');
    // Internal columns must not leak.
    expect(exported).not.toHaveProperty('id');
    expect(exported).not.toHaveProperty('org_id');
  });

  it('produces a parseable JSON array', () => {
    const parsed = JSON.parse(toJson([row(), row({ id: 'rcpt_2' })]));
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].receiptId).toBe('tre_abc123');
  });
});

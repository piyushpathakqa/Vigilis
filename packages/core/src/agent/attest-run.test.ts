import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parsePlaywrightReport, attestRun } from './attest-run';
import { verifyLocalBundle, type AttestationBundle } from './local-attestation-observer';

function fixedClock() {
  let n = 0;
  return () => `2026-07-22T00:00:0${n++}.000Z`;
}

// Minimal Playwright JSON report: two file-suites, one spec each (1 pass, 1 fail).
const REPORT = {
  suites: [
    {
      title: 'promote-memory.spec.ts',
      file: 'promote-memory.spec.ts',
      specs: [
        {
          title: 'promoting a queued memory removes it from the review queue',
          ok: true,
          file: 'promote-memory.spec.ts',
          tests: [{ status: 'expected', results: [{ status: 'passed', duration: 195 }] }],
        },
      ],
      suites: [],
    },
    {
      title: 'reject-memory.spec.ts',
      file: 'reject-memory.spec.ts',
      specs: [
        {
          title: 'rejecting a queued memory removes it from the review queue',
          ok: false,
          file: 'reject-memory.spec.ts',
          tests: [{ status: 'unexpected', results: [{ status: 'failed', duration: 300 }] }],
        },
      ],
      suites: [],
    },
  ],
  stats: { expected: 1, unexpected: 1, flaky: 0, skipped: 0, duration: 495 },
};

describe('parsePlaywrightReport', () => {
  it('flattens nested suites into per-spec results with pass/fail counts', () => {
    const parsed = parsePlaywrightReport(REPORT);
    expect(parsed.total).toBe(2);
    expect(parsed.passed).toBe(1);
    expect(parsed.failed).toBe(1);
    const titles = parsed.specs.map((s) => s.status).sort();
    expect(titles).toEqual(['failed', 'passed']);
    expect(parsed.specs.find((s) => s.status === 'failed')?.file).toBe('reject-memory.spec.ts');
  });
});

describe('attestRun', () => {
  it('writes a bound, verifiable bundle sealing the report digest + commit', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vigilis-run-'));
    const reportPath = join(dir, 'results.json');
    writeFileSync(reportPath, JSON.stringify(REPORT), 'utf8');
    const outPath = join(dir, 'qa-run.json');

    const res = attestRun({
      reportPath,
      commit: 'abc1234def5678',
      exitCode: 1,
      outPath,
      now: fixedClock(),
    });

    // counts surfaced
    expect(res.total).toBe(2);
    expect(res.passed).toBe(1);
    expect(res.failed).toBe(1);

    // one record per spec + a trailing run.summary record that binds the run
    expect(res.bundle.records).toHaveLength(3);
    const summary = res.bundle.records[res.bundle.records.length - 1]!;
    expect(summary.type).toBe('qa_run');
    expect(summary.meta.commit).toBe('abc1234def5678');
    expect(summary.meta.exitCode).toBe(1);
    expect(summary.meta.passed).toBe(1);
    expect(summary.meta.failed).toBe(1);
    // report digest is the sha256 of the actual file bytes
    expect(summary.meta.reportSha256).toBe(res.reportSha256);
    expect(res.reportSha256).toMatch(/^[0-9a-f]{64}$/);

    // bundle written + verifies as an intact chain
    const onDisk = JSON.parse(readFileSync(outPath, 'utf8')) as AttestationBundle;
    expect(verifyLocalBundle(onDisk)).toEqual({ ok: true, count: 3 });
    expect(res.verification.ok).toBe(true);
  });

  it('detects tampering with a recorded spec result', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vigilis-run-'));
    const reportPath = join(dir, 'results.json');
    writeFileSync(reportPath, JSON.stringify(REPORT), 'utf8');
    const res = attestRun({
      reportPath,
      commit: 'abc1234',
      outPath: join(dir, 'qa-run.json'),
      now: fixedClock(),
    });
    // flip a recorded spec result -> chain must break
    res.bundle.records[0]!.meta.status = 'tampered';
    expect(verifyLocalBundle(res.bundle).ok).toBe(false);
  });
});

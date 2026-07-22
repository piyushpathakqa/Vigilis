import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  buildBundle,
  chainEntries,
  verifyLocalBundle,
  writeBundle,
  type AttestationBundle,
  type AttestationEntry,
  type BundleVerification,
} from './local-attestation-observer';

export interface SpecResult {
  title: string;
  file: string;
  status: 'passed' | 'failed' | 'skipped';
  durationMs: number;
}

export interface ParsedReport {
  specs: SpecResult[];
  passed: number;
  failed: number;
  total: number;
}

interface RawSuite {
  file?: string;
  specs?: RawSpec[];
  suites?: RawSuite[];
}
interface RawSpec {
  title?: string;
  file?: string;
  ok?: boolean;
  tests?: { status?: string; results?: { status?: string; duration?: number }[] }[];
}

/**
 * Flatten a Playwright JSON report (nested file-suites) into a flat list of
 * per-spec results. A spec is `skipped` when every test is skipped, `passed`
 * when `ok`, else `failed`. Duration is summed across its test results.
 */
export function parsePlaywrightReport(json: unknown): ParsedReport {
  const specs: SpecResult[] = [];
  const root = (json ?? {}) as { suites?: RawSuite[] };

  const walk = (suite: RawSuite, inheritedFile: string): void => {
    const file = suite.file ?? inheritedFile;
    for (const spec of suite.specs ?? []) {
      const tests = spec.tests ?? [];
      const allSkipped =
        tests.length > 0 &&
        tests.every((t) => (t.results ?? []).every((r) => r.status === 'skipped'));
      const status: SpecResult['status'] = allSkipped ? 'skipped' : spec.ok ? 'passed' : 'failed';
      const durationMs = tests.reduce(
        (sum, t) => sum + (t.results ?? []).reduce((s, r) => s + (r.duration ?? 0), 0),
        0,
      );
      specs.push({ title: spec.title ?? '(untitled)', file: spec.file ?? file, status, durationMs });
    }
    for (const child of suite.suites ?? []) walk(child, file);
  };

  for (const suite of root.suites ?? []) walk(suite, '');

  const passed = specs.filter((s) => s.status === 'passed').length;
  const failed = specs.filter((s) => s.status === 'failed').length;
  return { specs, passed, failed, total: specs.length };
}

export interface AttestRunOptions {
  /** Path to a Playwright JSON report (the `json` reporter output). */
  reportPath: string;
  /** Commit SHA the run was executed against — bound into the receipt. */
  commit: string;
  /** The test runner's process exit code, if captured. */
  exitCode?: number;
  /** Namespaces recorded actions. Default `qa-run`. */
  label?: string;
  /** Actor URI stamped on records. Default `agent://vigilis`. */
  actor?: string;
  /** Where the bundle JSON is written. */
  outPath: string;
  /** Injectable clock (tests). */
  now?: () => string;
}

export interface AttestRunResult {
  bundle: AttestationBundle;
  verification: BundleVerification;
  passed: number;
  failed: number;
  total: number;
  reportSha256: string;
  summary: string;
}

/**
 * Attest an actual test run: hash-chain one record per spec plus a trailing
 * `qa_run` summary record that binds the report digest, commit, exit code, and
 * pass/fail counts. Pure hashing — no model call, no secrets — so the receipt is
 * produced on every run, then written to `outPath` and verified.
 */
export function attestRun(opts: AttestRunOptions): AttestRunResult {
  const actor = opts.actor ?? 'agent://vigilis';
  const label = opts.label ?? 'qa-run';
  const now = opts.now ?? (() => new Date().toISOString());

  const raw = readFileSync(opts.reportPath);
  const reportSha256 = createHash('sha256').update(raw).digest('hex');
  const parsed = parsePlaywrightReport(JSON.parse(raw.toString('utf8')));

  const entries: AttestationEntry[] = parsed.specs.map((s) => ({
    type: 'qa_spec',
    action: `spec.${s.status}`,
    meta: { title: s.title, file: s.file, status: s.status, durationMs: s.durationMs },
  }));
  entries.push({
    type: 'qa_run',
    action: 'run.summary',
    meta: {
      commit: opts.commit,
      exitCode: opts.exitCode ?? null,
      reportSha256,
      passed: parsed.passed,
      failed: parsed.failed,
      total: parsed.total,
    },
  });

  const records = chainEntries(entries, { actor, prefix: `${label}.`, now });
  const bundle = buildBundle(records, { actor, label, now });
  writeBundle(opts.outPath, bundle);
  const verification = verifyLocalBundle(bundle);

  const summary =
    `QA run attested: ${parsed.total} specs, ${parsed.passed} passed / ${parsed.failed} failed` +
    ` · commit ${opts.commit.slice(0, 7)} · ${verification.ok ? 'chain intact' : 'CHAIN BROKEN'} (unsigned)`;

  return {
    bundle,
    verification,
    passed: parsed.passed,
    failed: parsed.failed,
    total: parsed.total,
    reportSha256,
    summary,
  };
}

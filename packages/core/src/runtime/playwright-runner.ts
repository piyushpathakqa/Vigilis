import type { TestRunner, TestRunResult } from '../tools/types';
import { defaultExec } from './exec';
import type { Exec } from './exec';
// Re-export so existing callers that import Exec/ExecResult/defaultExec from this module keep working.
export type { Exec, ExecResult } from './exec';
export { defaultExec } from './exec';

export interface PlaywrightStats {
  expected?: number;
  unexpected?: number;
  flaky?: number;
  skipped?: number;
}

export interface PlaywrightTestResult {
  status?: string;
  error?: { message?: string };
}
export interface PlaywrightSpec {
  file?: string;
  title?: string;
  tests?: { results?: PlaywrightTestResult[] }[];
}
export interface PlaywrightSuite {
  specs?: PlaywrightSpec[];
  suites?: PlaywrightSuite[];
}
export interface PlaywrightJsonReport {
  stats?: PlaywrightStats;
  suites?: PlaywrightSuite[];
}

export interface PlaywrightFailure {
  specPath: string;
  title: string;
  error: string;
}

const PASSING = new Set(['passed', 'expected', 'skipped']);

/** Walk a Playwright JSON report's nested suites and return every failing spec. Pure. */
export function extractFailures(report: PlaywrightJsonReport): PlaywrightFailure[] {
  const out: PlaywrightFailure[] = [];
  const visit = (suite: PlaywrightSuite): void => {
    for (const spec of suite.specs ?? []) {
      const results = (spec.tests ?? []).flatMap((t) => t.results ?? []);
      const failed = results.find((r) => !PASSING.has(r.status ?? ''));
      if (failed) {
        out.push({
          specPath: spec.file ?? '',
          title: spec.title ?? '',
          error: failed.error?.message ?? 'unknown failure',
        });
      }
    }
    for (const child of suite.suites ?? []) visit(child);
  };
  for (const suite of report.suites ?? []) visit(suite);
  return out;
}

/** Turn Playwright's `--reporter=json` output into a TestRunResult. Pure. */
export function parsePlaywrightJson(
  report: PlaywrightJsonReport,
  artifactsDir: string,
): TestRunResult {
  const s = report.stats ?? {};
  const passed = s.expected ?? 0;
  const failed = (s.unexpected ?? 0) + (s.flaky ?? 0);
  const parts = [`${passed} passed`, `${failed} failed`];
  if (s.flaky) parts.push(`${s.flaky} flaky`);
  if (s.skipped) parts.push(`${s.skipped} skipped`);
  return { passed, failed, summary: parts.join(', '), artifactsDir };
}

export interface PlaywrightTestRunnerOptions {
  cwd: string;
  exec?: Exec;
  artifactsDir?: string;
}

/** Runs `npx playwright test ... --reporter=json` and parses the result. */
export class PlaywrightTestRunner implements TestRunner {
  constructor(private readonly opts: PlaywrightTestRunnerOptions) {}

  async run(specPath?: string): Promise<TestRunResult> {
    const exec = this.opts.exec ?? defaultExec;
    const artifactsDir = this.opts.artifactsDir ?? 'test-results';
    const args = ['playwright', 'test', ...(specPath ? [specPath] : []), '--reporter=json'];
    const { stdout } = await exec('npx', args, { cwd: this.opts.cwd });
    let report: PlaywrightJsonReport = {};
    try {
      report = JSON.parse(stdout) as PlaywrightJsonReport;
    } catch {
      report = {};
    }
    return parsePlaywrightJson(report, artifactsDir);
  }
}

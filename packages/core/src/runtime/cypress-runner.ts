import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import type { TestRunner, TestRunResult } from '../tools/types';
import { defaultExec } from './exec';
import type { Exec } from './exec';

export interface CypressStats {
  tests?: number;
  passes?: number;
  pending?: number;
  failures?: number;
}
export interface CypressFailureRaw {
  fullTitle?: string;
  title?: string;
  file?: string;
  err?: { message?: string };
}
export interface CypressMochaReport {
  stats?: CypressStats;
  failures?: CypressFailureRaw[];
}

export interface CypressFailure {
  specPath: string;
  title: string;
  error: string;
}

/** Walk a Cypress (Mocha JSON) report's failures. Pure. */
export function extractCypressFailures(report: CypressMochaReport): CypressFailure[] {
  return (report.failures ?? []).map((f) => ({
    specPath: f.file ?? '',
    title: f.fullTitle ?? f.title ?? '',
    error: f.err?.message ?? 'unknown failure',
  }));
}

/** Turn Cypress `--reporter json` output into a TestRunResult. Pure. */
export function parseCypressJson(report: CypressMochaReport, artifactsDir: string): TestRunResult {
  const s = report.stats ?? {};
  const passed = s.passes ?? 0;
  const failed = s.failures ?? 0;
  const parts = [`${passed} passed`, `${failed} failed`];
  if (s.pending) parts.push(`${s.pending} pending`);
  return { passed, failed, summary: parts.join(', '), artifactsDir };
}

export interface CypressTestRunnerOptions {
  cwd: string;
  exec?: Exec;
  artifactsDir?: string;
  /** Injectable for tests — defaults to fs.readFile(path, 'utf8') */
  readReport?: (path: string) => Promise<string>;
}

/** Runs `npx cypress run --reporter json --reporter-options output=<file> [--spec <path>]`
 *  and parses the result from the written file.
 *
 *  Fail-closed: if the report file cannot be read or parsed, or has no `stats`,
 *  returns `{ passed: 0, failed: 1, ... }` so the gate stays blocked.
 */
export class CypressTestRunner implements TestRunner {
  constructor(private readonly opts: CypressTestRunnerOptions) {}

  async run(specPath?: string): Promise<TestRunResult> {
    const exec = this.opts.exec ?? defaultExec;
    const artifactsDir = this.opts.artifactsDir ?? 'cypress/screenshots';
    const readReport = this.opts.readReport ?? ((p: string) => readFile(p, 'utf8'));

    const reportPath = join(tmpdir(), 'vigilis-cypress-report.json');
    const args = [
      'cypress',
      'run',
      '--reporter',
      'json',
      '--reporter-options',
      `output=${reportPath}`,
      ...(specPath ? ['--spec', specPath] : []),
    ];

    await exec('npx', args, { cwd: this.opts.cwd });

    let report: CypressMochaReport;
    try {
      const raw = await readReport(reportPath);
      report = JSON.parse(raw) as CypressMochaReport;
    } catch {
      return {
        passed: 0,
        failed: 1,
        summary: 'cypress produced no parseable report (treated as failure)',
        artifactsDir,
      };
    }

    // Fail-closed: if parsed JSON has no stats, treat as a failure — not 0/0 green.
    if (!report.stats) {
      return {
        passed: 0,
        failed: 1,
        summary: 'cypress produced no parseable report (treated as failure)',
        artifactsDir,
      };
    }

    return parseCypressJson(report, artifactsDir);
  }
}

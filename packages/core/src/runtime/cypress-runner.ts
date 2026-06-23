import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import type { TestRunner, TestRunResult } from '../tools/types';
import { defaultExec } from './exec';
import type { Exec } from './exec';
import { parseMochaJson, reportHasNoStats, type MochaReport } from './mocha-json';

// back-compat aliases (SP2 imported these names from this module):
export { parseMochaJson as parseCypressJson, extractMochaFailures as extractCypressFailures } from './mocha-json';
export type { MochaReport as CypressMochaReport, MochaFailure as CypressFailure } from './mocha-json';

// Keep the old shape aliases for any consumers that used the raw field types
export type CypressStats = import('./mocha-json').MochaStats;
export type CypressFailureRaw = import('./mocha-json').MochaFailureRaw;

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

    let report: MochaReport;
    try {
      const raw = await readReport(reportPath);
      report = JSON.parse(raw) as MochaReport;
    } catch {
      return {
        passed: 0,
        failed: 1,
        summary: 'cypress produced no parseable report (treated as failure)',
        artifactsDir,
      };
    }

    // Fail-closed: if parsed JSON has no stats, treat as a failure — not 0/0 green.
    if (reportHasNoStats(report)) {
      return {
        passed: 0,
        failed: 1,
        summary: 'cypress produced no parseable report (treated as failure)',
        artifactsDir,
      };
    }

    return parseMochaJson(report, artifactsDir);
  }
}

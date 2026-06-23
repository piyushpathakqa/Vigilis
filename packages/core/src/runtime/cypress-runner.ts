import { spawn } from 'node:child_process';
import type { TestRunner, TestRunResult } from '../tools/types';
import type { Exec, ExecResult } from './playwright-runner';

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

/** Cypress prints the JSON among other output; grab the outermost JSON object. */
export function extractJsonBlob(stdout: string): string {
  const start = stdout.indexOf('{');
  const end = stdout.lastIndexOf('}');
  return start >= 0 && end > start ? stdout.slice(start, end + 1) : '{}';
}

const defaultExec: Exec = (cmd, args, opts) =>
  new Promise<ExecResult>((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: opts.cwd });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += String(d)));
    child.stderr.on('data', (d) => (stderr += String(d)));
    child.on('error', reject);
    child.on('close', (code) => resolve({ stdout, stderr, code }));
  });

export interface CypressTestRunnerOptions {
  cwd: string;
  exec?: Exec;
  artifactsDir?: string;
}

/** Runs `npx cypress run --reporter json [--spec <path>]` and parses the result. */
export class CypressTestRunner implements TestRunner {
  constructor(private readonly opts: CypressTestRunnerOptions) {}

  async run(specPath?: string): Promise<TestRunResult> {
    const exec = this.opts.exec ?? defaultExec;
    const artifactsDir = this.opts.artifactsDir ?? 'cypress/screenshots';
    const args = ['cypress', 'run', '--reporter', 'json', ...(specPath ? ['--spec', specPath] : [])];
    const { stdout } = await exec('npx', args, { cwd: this.opts.cwd });
    let report: CypressMochaReport = {};
    try {
      report = JSON.parse(extractJsonBlob(stdout)) as CypressMochaReport;
    } catch {
      report = {};
    }
    return parseCypressJson(report, artifactsDir);
  }
}

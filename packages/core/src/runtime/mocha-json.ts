import type { TestRunResult } from '../tools/types';

export interface MochaStats {
  tests?: number;
  passes?: number;
  pending?: number;
  failures?: number;
}
export interface MochaFailureRaw {
  fullTitle?: string;
  title?: string;
  file?: string;
  err?: { message?: string };
}
export interface MochaReport {
  stats?: MochaStats;
  failures?: MochaFailureRaw[];
}

export interface MochaFailure {
  specPath: string;
  title: string;
  error: string;
}

/** Walk a Mocha-JSON report's failures. Pure. */
export function extractMochaFailures(report: MochaReport): MochaFailure[] {
  return (report.failures ?? []).map((f) => ({
    specPath: f.file ?? '',
    title: f.fullTitle ?? f.title ?? '',
    error: f.err?.message ?? 'unknown failure',
  }));
}

/** Turn a Mocha-JSON report into a TestRunResult. Pure. */
export function parseMochaJson(report: MochaReport, artifactsDir: string): TestRunResult {
  const s = report.stats ?? {};
  const passed = s.passes ?? 0;
  const failed = s.failures ?? 0;
  const parts = [`${passed} passed`, `${failed} failed`];
  if (s.pending) parts.push(`${s.pending} pending`);
  return { passed, failed, summary: parts.join(', '), artifactsDir };
}

/** True when a report carries no usable stats — callers should treat this as a failure. */
export function reportHasNoStats(report: MochaReport): boolean {
  return !report.stats || Object.keys(report.stats).length === 0;
}

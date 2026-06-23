import { describe, it, expect } from 'vitest';
import { parseMochaJson, extractMochaFailures, type MochaReport } from './mocha-json';

const report: MochaReport = {
  stats: { tests: 3, passes: 2, pending: 1, failures: 1 },
  failures: [
    { fullTitle: 'cart adds item', file: 'tests/selenium/cart.test.ts', err: { message: 'no pay button' } },
  ],
};

describe('parseMochaJson', () => {
  it('summarises passes/failures into a TestRunResult', () => {
    const r = parseMochaJson(report, 'artifacts');
    expect(r.passed).toBe(2);
    expect(r.failed).toBe(1);
    expect(r.summary).toContain('2 passed');
    expect(r.summary).toContain('1 failed');
    expect(r.artifactsDir).toBe('artifacts');
  });

  it('treats a report with no stats as zero counts (caller decides fail-closed)', () => {
    const r = parseMochaJson({}, 'd');
    expect(r.passed).toBe(0);
    expect(r.failed).toBe(0);
  });
});

describe('extractMochaFailures', () => {
  it('returns spec path, title, and error per failure', () => {
    expect(extractMochaFailures(report)).toEqual([
      { specPath: 'tests/selenium/cart.test.ts', title: 'cart adds item', error: 'no pay button' },
    ]);
  });
});

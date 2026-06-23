import { describe, it, expect } from 'vitest';
import { parseCypressJson, extractCypressFailures, type CypressMochaReport } from './cypress-runner';

const report: CypressMochaReport = {
  stats: { tests: 3, passes: 2, pending: 1, failures: 1 },
  failures: [
    { fullTitle: 'cart adds item', file: 'cypress/e2e/cart.cy.ts', err: { message: 'expected pay button' } },
  ],
};

describe('parseCypressJson', () => {
  it('summarises passes/failures into a TestRunResult', () => {
    const r = parseCypressJson(report, 'cypress/screenshots');
    expect(r.passed).toBe(2);
    expect(r.failed).toBe(1);
    expect(r.summary).toContain('2 passed');
    expect(r.summary).toContain('1 failed');
    expect(r.artifactsDir).toBe('cypress/screenshots');
  });

  it('treats an empty/garbage report as zero counts', () => {
    const r = parseCypressJson({}, 'd');
    expect(r.passed).toBe(0);
    expect(r.failed).toBe(0);
  });
});

describe('extractCypressFailures', () => {
  it('returns spec path, title, and error per failure', () => {
    const f = extractCypressFailures(report);
    expect(f).toEqual([
      { specPath: 'cypress/e2e/cart.cy.ts', title: 'cart adds item', error: 'expected pay button' },
    ]);
  });

  it('is empty when there are no failures', () => {
    expect(extractCypressFailures({ stats: { tests: 1, passes: 1, pending: 0, failures: 0 } })).toEqual([]);
  });
});

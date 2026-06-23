import { describe, it, expect } from 'vitest';
import { parseCypressJson, extractCypressFailures, CypressTestRunner, type CypressMochaReport } from './cypress-runner';

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

// ---------------------------------------------------------------------------
// CypressTestRunner.run() — file-based reporter + fail-closed
// ---------------------------------------------------------------------------

/** Minimal no-op exec that returns empty stdout */
const noopExec = async (_cmd: string, _args: string[], _opts: { cwd: string }) =>
  ({ stdout: '', stderr: '', code: 0 as number | null });

describe('CypressTestRunner.run()', () => {
  it('passes exec args including --reporter json, --reporter-options, and output=', async () => {
    const capturedArgs: string[] = [];
    const spyExec = async (_cmd: string, args: string[], _opts: { cwd: string }) => {
      capturedArgs.push(...args);
      return { stdout: '', stderr: '', code: 0 as number | null };
    };
    const validReport = JSON.stringify({ stats: { tests: 1, passes: 1, failures: 0 } });
    const runner = new CypressTestRunner({
      cwd: '/tmp',
      exec: spyExec,
      readReport: async () => validReport,
    });
    await runner.run();
    expect(capturedArgs).toContain('--reporter');
    expect(capturedArgs).toContain('json');
    expect(capturedArgs).toContain('--reporter-options');
    const reporterOptions = capturedArgs[capturedArgs.indexOf('--reporter-options') + 1];
    expect(reporterOptions).toMatch(/output=/);
  });

  it('passes --spec when specPath is provided', async () => {
    const capturedArgs: string[] = [];
    const spyExec = async (_cmd: string, args: string[], _opts: { cwd: string }) => {
      capturedArgs.push(...args);
      return { stdout: '', stderr: '', code: 0 as number | null };
    };
    const validReport = JSON.stringify({ stats: { tests: 1, passes: 1, failures: 0 } });
    const runner = new CypressTestRunner({
      cwd: '/tmp',
      exec: spyExec,
      readReport: async () => validReport,
    });
    await runner.run('cypress/e2e/login.cy.ts');
    expect(capturedArgs).toContain('--spec');
    expect(capturedArgs).toContain('cypress/e2e/login.cy.ts');
  });

  it('happy path: resolves to the parsed report stats when readReport returns valid JSON', async () => {
    const validReport = JSON.stringify({ stats: { tests: 2, passes: 2, failures: 0 } });
    const runner = new CypressTestRunner({
      cwd: '/tmp',
      exec: noopExec,
      readReport: async () => validReport,
    });
    const result = await runner.run();
    expect(result.passed).toBe(2);
    expect(result.failed).toBe(0);
  });

  it('fail-closed: readReport throws (missing file) → failed > 0, NOT 0/0 green', async () => {
    const runner = new CypressTestRunner({
      cwd: '/tmp',
      exec: noopExec,
      readReport: async () => { throw new Error('ENOENT: no such file or directory'); },
    });
    const result = await runner.run();
    expect(result.failed).toBeGreaterThan(0);
    // Explicitly: must NOT be the false-green 0/0 case
    expect(result.passed).toBe(0);
  });

  it('fail-closed: readReport returns "{}" (no stats) → failed > 0', async () => {
    const runner = new CypressTestRunner({
      cwd: '/tmp',
      exec: noopExec,
      readReport: async () => '{}',
    });
    const result = await runner.run();
    expect(result.failed).toBeGreaterThan(0);
    expect(result.passed).toBe(0);
  });

  it('fail-closed: readReport returns invalid JSON → failed > 0', async () => {
    const runner = new CypressTestRunner({
      cwd: '/tmp',
      exec: noopExec,
      readReport: async () => 'not json at all',
    });
    const result = await runner.run();
    expect(result.failed).toBeGreaterThan(0);
  });
});

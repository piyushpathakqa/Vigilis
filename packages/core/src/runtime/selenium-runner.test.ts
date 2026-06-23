import { describe, it, expect } from 'vitest';
import { SeleniumTestRunner } from './selenium-runner';
import type { Exec } from './exec';

const fakeExec = (out: string): Exec => async () => ({ stdout: out, stderr: '', code: 0 });

describe('SeleniumTestRunner', () => {
  it('runs mocha with the json reporter writing to a file, and parses it', async () => {
    let calledArgs: string[] = [];
    const exec: Exec = async (_cmd, args) => {
      calledArgs = args;
      return { stdout: '', stderr: '', code: 0 };
    };
    const runner = new SeleniumTestRunner({
      cwd: '/ws',
      exec,
      readReport: async () => JSON.stringify({ stats: { tests: 2, passes: 2, failures: 0 } }),
    });
    const r = await runner.run('tests/selenium/cart.test.ts');
    expect(r.passed).toBe(2);
    expect(r.failed).toBe(0);
    expect(calledArgs).toContain('--reporter');
    expect(calledArgs.some((a) => a.startsWith('output='))).toBe(true);
    expect(calledArgs).toContain('tests/selenium/cart.test.ts');
  });

  it('fails closed when the report is missing (read throws)', async () => {
    const runner = new SeleniumTestRunner({
      cwd: '/ws',
      exec: fakeExec(''),
      readReport: async () => {
        throw new Error('ENOENT');
      },
    });
    const r = await runner.run('x.test.ts');
    expect(r.failed).toBeGreaterThan(0);
  });

  it('fails closed when the report has no stats', async () => {
    const runner = new SeleniumTestRunner({ cwd: '/ws', exec: fakeExec(''), readReport: async () => '{}' });
    const r = await runner.run('x.test.ts');
    expect(r.failed).toBeGreaterThan(0);
  });
});

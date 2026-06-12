import { describe, it, expect } from 'vitest';
import { playwrightRun } from './playwright';
import { FakeTestRunner, makeFakeCtx } from '../testing/fakes';

describe('playwright_run', () => {
  it('delegates to the runner and reports results in meta', async () => {
    const runner = new FakeTestRunner();
    runner.result = { passed: 3, failed: 1, summary: '3 passed, 1 failed', artifactsDir: '/runs/1' };
    const res = await playwrightRun.handler({ specPath: 'tests/cart.spec.ts' }, makeFakeCtx({ runner }));
    expect(runner.lastSpec).toBe('tests/cart.spec.ts');
    expect(res.content).toBe('3 passed, 1 failed');
    expect(res.meta).toEqual({ passed: 3, failed: 1, artifactsDir: '/runs/1' });
    expect(res.isError).toBeUndefined();
  });

  it('runs all specs when no path is given', async () => {
    const runner = new FakeTestRunner();
    const res = await playwrightRun.handler({}, makeFakeCtx({ runner }));
    expect(runner.lastSpec).toBeUndefined();
    expect(res.content).toBe('no run');
  });
});

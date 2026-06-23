import { describe, it, expect } from 'vitest';
import { testRun } from './test-run';
import { makeFakeCtx } from '../testing/fakes';

describe('test_run tool', () => {
  it('delegates to ctx.runner and reports counts', async () => {
    const ctx = makeFakeCtx({
      runner: { run: async () => ({ passed: 3, failed: 0, summary: '3 passed, 0 failed', artifactsDir: 'r' }) },
    });
    const res = await testRun.handler({ specPath: 'a.spec.ts' }, ctx);
    expect(res.content).toBe('3 passed, 0 failed');
    expect(res.meta).toMatchObject({ passed: 3, failed: 0, artifactsDir: 'r' });
  });

  it('is registered under the framework-neutral name', () => {
    expect(testRun.name).toBe('test_run');
  });
});

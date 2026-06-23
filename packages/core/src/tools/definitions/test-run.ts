import { z } from 'zod';
import { defineTool } from '../types';

/** Framework-neutral test runner tool. Delegates to ctx.runner (built by the active adapter). */
export const testRun = defineTool({
  name: 'test_run',
  description:
    'Run the project test suite (any supported framework) and report pass/fail counts and the artifacts directory.',
  input: z.object({
    specPath: z.string().optional().describe('A specific spec to run; omit to run all specs'),
  }),
  handler: async ({ specPath }, ctx) => {
    const r = await ctx.runner.run(specPath);
    return {
      content: r.summary,
      meta: { passed: r.passed, failed: r.failed, artifactsDir: r.artifactsDir },
    };
  },
});

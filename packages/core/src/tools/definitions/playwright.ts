import { z } from 'zod';
import { defineTool } from '../types';

export const playwrightRun = defineTool({
  name: 'playwright_run',
  description: 'Run Playwright specs and report pass/fail counts and the artifacts directory.',
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

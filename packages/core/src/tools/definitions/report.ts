import { z } from 'zod';
import { defineTool } from '../types';

/**
 * Triage's structured-output tool. The agent calls it exactly once at the end of
 * a triage run; the Triage behavior captures the input as the verdict. Not part
 * of the default registry — registered only for Triage.
 */
export const reportVerdict = defineTool({
  name: 'report_verdict',
  description:
    'Report the triage verdict for the failed test. Call exactly once, as the final step.',
  input: z.object({
    verdict: z
      .enum(['real-bug', 'dom-drift', 'flake'])
      .describe('real-bug = genuinely broken; dom-drift = locator/testid changed; flake = transient'),
    confidence: z.enum(['low', 'medium', 'high']),
    rationale: z.string().describe('Why — cite the spec expectation vs the live DOM.'),
    suggestedSelector: z
      .string()
      .optional()
      .describe('For dom-drift: the correct current selector to use instead.'),
  }),
  handler: async () => ({ content: 'Verdict recorded.' }),
});

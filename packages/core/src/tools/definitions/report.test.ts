import { describe, it, expect } from 'vitest';
import { reportVerdict } from './report';
import { makeFakeCtx } from '../testing/fakes';

describe('report_verdict tool', () => {
  it('accepts a valid verdict and records it', async () => {
    const res = await reportVerdict.handler(
      { verdict: 'dom-drift', confidence: 'high', rationale: 'testid changed', suggestedSelector: '[data-testid="x"]' },
      makeFakeCtx(),
    );
    expect(res.isError).toBeUndefined();
    expect(res.content).toMatch(/recorded/i);
  });

  it('rejects an unknown verdict via the schema', () => {
    const parsed = reportVerdict.input.safeParse({
      verdict: 'maybe',
      confidence: 'high',
      rationale: 'x',
    });
    expect(parsed.success).toBe(false);
  });
});

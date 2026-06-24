import { describe, it, expect } from 'vitest';
import { NoopMemoryProvider } from './types';

describe('NoopMemoryProvider', () => {
  it('recall always returns empty array', async () => {
    const provider = new NoopMemoryProvider();
    const result = await provider.recall({
      specPath: 'tests/login.spec.ts',
      url: 'http://localhost:3100/login',
      errorText: 'element not found',
    });
    expect(result).toEqual([]);
  });

  it('recall returns empty array with no errorText', async () => {
    const provider = new NoopMemoryProvider();
    const result = await provider.recall({
      specPath: 'tests/login.spec.ts',
      url: 'http://localhost:3100/login',
    });
    expect(result).toEqual([]);
  });

  it('record resolves without throwing', async () => {
    const provider = new NoopMemoryProvider();
    await expect(
      provider.record({
        specPath: 'tests/login.spec.ts',
        url: 'http://localhost:3100/login',
        verdict: 'dom-drift',
        rationale: 'testid changed',
        suggestedSelector: '[data-testid="new-btn"]',
      }),
    ).resolves.toBeUndefined();
  });

  it('record resolves for real-bug verdict', async () => {
    const provider = new NoopMemoryProvider();
    await expect(
      provider.record({
        specPath: 'tests/cart.spec.ts',
        url: 'http://localhost:3100/cart',
        verdict: 'real-bug',
        rationale: 'button is gone',
      }),
    ).resolves.toBeUndefined();
  });
});

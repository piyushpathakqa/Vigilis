import { describe, it, expect } from 'vitest';
import { resolveAdapter } from './resolve';

describe('resolveAdapter', () => {
  it('returns the CypressAdapter for an explicit cypress override', async () => {
    const a = await resolveAdapter(process.cwd(), 'cypress');
    expect(a.name).toBe('cypress');
  });

  it('returns the PlaywrightAdapter for an explicit playwright override', async () => {
    const a = await resolveAdapter(process.cwd(), 'playwright');
    expect(a.name).toBe('playwright');
  });

  it('returns the SeleniumAdapter for an explicit selenium override', async () => {
    const a = await resolveAdapter(process.cwd(), 'selenium');
    expect(a.name).toBe('selenium');
  });
});

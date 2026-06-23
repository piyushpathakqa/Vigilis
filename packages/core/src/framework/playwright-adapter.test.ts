import { describe, it, expect } from 'vitest';
import { PlaywrightAdapter } from './playwright-adapter';

const a = new PlaywrightAdapter();

describe('PlaywrightAdapter', () => {
  it('is named playwright', () => {
    expect(a.name).toBe('playwright');
  });

  it('maps a URL to a .spec.ts path under tests/generated', () => {
    expect(a.specPathForUrl('https://shop.test/cart')).toBe('tests/generated/cart.spec.ts');
    expect(a.specPathForUrl('https://shop.test/')).toBe('tests/generated/home.spec.ts');
  });

  it('generate guidance names the Playwright import and getByTestId', () => {
    const g = a.generateGuidance();
    expect(g).toContain("@playwright/test");
    expect(g).toContain('getByTestId');
  });

  it('heal guidance mentions the spec path, the selector, and test_run', () => {
    const h = a.healGuidance('tests/generated/cart.spec.ts', "getByTestId('pay')");
    expect(h).toContain('tests/generated/cart.spec.ts');
    expect(h).toContain("getByTestId('pay')");
    expect(h).toContain('test_run');
  });

  it('creates a TestRunner', () => {
    const r = a.createRunner({ cwd: '/ws' });
    expect(typeof r.run).toBe('function');
  });
});

import { describe, it, expect } from 'vitest';
import { SeleniumAdapter } from './selenium-adapter';

const a = new SeleniumAdapter();

describe('SeleniumAdapter', () => {
  it('is named selenium', () => {
    expect(a.name).toBe('selenium');
  });

  it('maps a URL to a .test.ts path under tests/selenium by default', () => {
    expect(a.specPathForUrl('https://shop.test/cart')).toBe('tests/selenium/cart.test.ts');
    expect(a.specPathForUrl('https://shop.test/')).toBe('tests/selenium/home.test.ts');
  });

  it('generate guidance names selenium-webdriver idioms (Builder, By.css, until)', () => {
    const g = a.generateGuidance();
    expect(g).toContain('selenium-webdriver');
    expect(g).toContain('By.css');
    expect(g).toContain('until');
    expect(g).toContain('data-testid');
    expect(g).not.toContain('@playwright/test');
  });

  it('heal guidance references the spec, the selector, and test_run', () => {
    const h = a.healGuidance('tests/selenium/cart.test.ts', '[data-testid="pay"]');
    expect(h).toContain('tests/selenium/cart.test.ts');
    expect(h).toContain('[data-testid="pay"]');
    expect(h).toContain('test_run');
  });

  it('creates a Selenium TestRunner', () => {
    expect(typeof a.createRunner({ cwd: '/ws' }).run).toBe('function');
  });
});

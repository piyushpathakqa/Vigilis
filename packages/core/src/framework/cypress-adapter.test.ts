import { describe, it, expect } from 'vitest';
import { CypressAdapter } from './cypress-adapter';

const a = new CypressAdapter();

describe('CypressAdapter', () => {
  it('is named cypress', () => {
    expect(a.name).toBe('cypress');
  });

  it('maps a URL to a .cy.ts path under cypress/e2e by default', () => {
    expect(a.specPathForUrl('https://shop.test/cart')).toBe('cypress/e2e/cart.cy.ts');
    expect(a.specPathForUrl('https://shop.test/')).toBe('cypress/e2e/home.cy.ts');
  });

  it('honours an explicit outDir', () => {
    expect(a.specPathForUrl('https://shop.test/cart', 'e2e')).toBe('e2e/cart.cy.ts');
  });

  it('generate guidance names Cypress idioms (cy.visit, data-testid, should)', () => {
    const g = a.generateGuidance();
    expect(g).toContain('cy.visit');
    expect(g).toContain('data-testid');
    expect(g).toContain('.should(');
    expect(g).not.toContain('@playwright/test');
  });

  it('heal guidance references the spec, the selector, and test_run', () => {
    const h = a.healGuidance('cypress/e2e/cart.cy.ts', '[data-testid="pay"]');
    expect(h).toContain('cypress/e2e/cart.cy.ts');
    expect(h).toContain('[data-testid="pay"]');
    expect(h).toContain('test_run');
  });

  it('creates a Cypress TestRunner', () => {
    expect(typeof a.createRunner({ cwd: '/ws' }).run).toBe('function');
  });
});

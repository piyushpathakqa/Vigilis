import { CypressTestRunner } from '../runtime/cypress-runner';
import type { TestRunner } from '../tools/types';
import type { FrameworkAdapter, RunnerOpts } from './types';

/** Map a URL to a deterministic .cy.ts path under `outDir`. */
function specPathForUrl(url: string, outDir = 'cypress/e2e'): string {
  let pathname = '/';
  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = '/';
  }
  const slug =
    pathname
      .split('/')
      .filter(Boolean)
      .join('-')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '') || 'home';
  return `${outDir}/${slug}.cy.ts`;
}

const GENERATE_GUIDANCE = [
  'The spec MUST:',
  '- be a Cypress e2e test using describe(...) and it(...);',
  '- use cy.visit(\'/...\') relative paths (baseUrl is preconfigured in cypress.config);',
  "- locate elements by data-testid: cy.get('[data-testid=\"...\"]') — never brittle text or CSS-structure selectors;",
  '- use retry-able Cypress assertions — .should(\'be.visible\'), .should(\'have.text\', ...),',
  '  .should(\'have.value\', ...). NEVER use cy.wait(<number>) fixed waits;',
  '- prove a successful login by asserting an element that only appears AFTER login',
  '  (e.g. a post-login nav or cart testid) — do NOT assert on the URL;',
  '- include meaningful assertions on the primary flow (e.g. the cart count changes);',
  '- be one focused, deterministic test, self-contained and runnable with no manual edits.',
].join('\n');

export class CypressAdapter implements FrameworkAdapter {
  readonly name = 'cypress' as const;

  specPathForUrl(url: string, outDir?: string): string {
    return specPathForUrl(url, outDir);
  }

  generateGuidance(): string {
    return GENERATE_GUIDANCE;
  }

  healGuidance(specPath: string, selector: string): string {
    return [
      `The spec at ${specPath} uses a stale locator that no longer matches the page.`,
      `The correct current selector is: ${selector}`,
      '',
      'Steps:',
      '1. Read the spec with fs_read.',
      "2. Replace ONLY the stale locator(s) — rewrite the cy.get(...) argument to the correct",
      "   selector (prefer cy.get('[data-testid=\"...\"]')). Do not change the test's intent,",
      '   assertions, or flow — locators only.',
      '3. Write the fixed spec back with fs_write to the same path.',
      '4. Run it with test_run to check it now passes; if not, inspect the DOM and adjust.',
    ].join('\n');
  }

  createRunner(opts: RunnerOpts): TestRunner {
    return new CypressTestRunner(opts);
  }
}

import { SeleniumTestRunner } from '../runtime/selenium-runner';
import type { TestRunner } from '../tools/types';
import type { FrameworkAdapter, RunnerOpts } from './types';

/** Map a URL to a deterministic .test.ts path under `outDir`. */
function specPathForUrl(url: string, outDir = 'tests/selenium'): string {
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
  return `${outDir}/${slug}.test.ts`;
}

const GENERATE_GUIDANCE = [
  'The spec MUST:',
  "- be a Mocha test (describe/it) driving selenium-webdriver;",
  "- import { Builder, By, until } from 'selenium-webdriver';",
  "- create the driver in a before() hook (new Builder().forBrowser('chrome').build())",
  '  and quit it in an after() hook (await driver.quit());',
  '- navigate with await driver.get(<full URL>) — use the exact URL you are given;',
  "- locate elements by data-testid: driver.findElement(By.css('[data-testid=\"...\"]')) —",
  '  never brittle text or XPath-by-structure selectors;',
  '- wait explicitly with driver.wait(until.elementLocated(By.css(...)), 5000) and',
  '  until.elementIsVisible(...). NEVER use a fixed sleep/setTimeout;',
  '- prove a successful login by waiting for an element that only appears AFTER login',
  '  (e.g. a post-login nav or cart testid) — do NOT assert on the URL;',
  "- assert with node:assert (e.g. assert.strictEqual(await el.getText(), 'Cart (1)'));",
  '- be one focused, deterministic test, self-contained and runnable with no manual edits.',
].join('\n');

export class SeleniumAdapter implements FrameworkAdapter {
  readonly name = 'selenium' as const;

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
      "2. Replace ONLY the stale locator(s) — rewrite the By.css(...) argument to the correct",
      "   selector (prefer By.css('[data-testid=\"...\"]')). Do not change the test's intent,",
      '   assertions, or flow — locators only.',
      '3. Write the fixed spec back with fs_write to the same path.',
      '4. Run it with test_run to check it now passes; if not, inspect the DOM and adjust.',
    ].join('\n');
  }

  createRunner(opts: RunnerOpts): TestRunner {
    return new SeleniumTestRunner(opts);
  }
}

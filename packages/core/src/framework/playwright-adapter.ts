import { PlaywrightTestRunner } from '../runtime/playwright-runner';
import type { TestRunner } from '../tools/types';
import type { FrameworkAdapter, RunnerOpts } from './types';

/** Map a URL to a deterministic spec path under `outDir`. */
function specPathForUrl(url: string, outDir = 'tests/generated'): string {
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
  return `${outDir}/${slug}.spec.ts`;
}

const GENERATE_GUIDANCE = [
  'The spec MUST:',
  "- import { test, expect } from '@playwright/test';",
  '- use getByTestId(...) locators (never brittle text or CSS-structure selectors);',
  '- use web-first assertions that auto-wait — expect(locator).toBeVisible(),',
  '  toHaveText(...), toHaveValue(...). NEVER use page.waitForTimeout or fixed sleeps;',
  '- prove a successful login by asserting an element that only appears AFTER login',
  '  (e.g. a post-login nav or cart testid) — do NOT assert on a URL regex;',
  '- include meaningful assertions on the primary flow (e.g. the cart count changes);',
  '- be one focused, deterministic test, self-contained and runnable with no manual edits;',
  "- baseURL is preconfigured, so use page.goto('/...') relative paths.",
].join('\n');

export class PlaywrightAdapter implements FrameworkAdapter {
  readonly name = 'playwright' as const;

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
      "2. Replace ONLY the stale locator(s) with the correct selector. Do not change the test's",
      '   intent, assertions, or flow — locators only.',
      '3. Write the fixed spec back with fs_write to the same path.',
      '4. Run it with test_run to check it now passes; if not, inspect the DOM and adjust.',
    ].join('\n');
  }

  createRunner(opts: RunnerOpts): TestRunner {
    return new PlaywrightTestRunner(opts);
  }
}

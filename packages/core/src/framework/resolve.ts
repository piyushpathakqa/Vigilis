import { detectFramework, pickFramework } from './detect';
import { CypressAdapter } from './cypress-adapter';
import { PlaywrightAdapter } from './playwright-adapter';
import { SeleniumAdapter } from './selenium-adapter';
import type { Framework, FrameworkAdapter } from './types';

const ADAPTERS: Partial<Record<Framework, () => FrameworkAdapter>> = {
  playwright: () => new PlaywrightAdapter(),
  cypress: () => new CypressAdapter(),
  selenium: () => new SeleniumAdapter(),
};

/**
 * Resolve the adapter for a project. An explicit `override` (CLI --framework / config)
 * wins; otherwise detect from cwd; otherwise default to Playwright.
 */
export async function resolveAdapter(cwd: string, override?: Framework): Promise<FrameworkAdapter> {
  const chosen = override ?? pickFramework(await detectFramework(cwd)) ?? 'playwright';
  const make = ADAPTERS[chosen];
  if (!make) {
    const source = override ? 'requested' : 'detected';
    throw new Error(
      `Framework "${chosen}" was ${source} but its adapter is not yet implemented. ` +
      `Supported: ${Object.keys(ADAPTERS).join(', ')}.`,
    );
  }
  return make();
}

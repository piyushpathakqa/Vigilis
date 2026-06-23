import { defineTool } from '../types';
import { testRun } from './test-run';

/** @deprecated Use `test_run`. Kept one release so existing agents/configs don't break. */
export const playwrightRun = defineTool({ ...testRun, name: 'playwright_run' });

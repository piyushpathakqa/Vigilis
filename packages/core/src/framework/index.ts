export { FRAMEWORKS } from './types';
export type { Framework, FrameworkAdapter, RunnerOpts } from './types';
export { detectFramework, pickFramework } from './detect';
export type { FrameworkScore, DetectFs } from './detect';
export { PlaywrightAdapter } from './playwright-adapter';
export { CypressAdapter } from './cypress-adapter';
export { SeleniumAdapter } from './selenium-adapter';
export { resolveAdapter } from './resolve';

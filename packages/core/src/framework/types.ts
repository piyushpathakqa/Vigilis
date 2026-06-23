import type { Exec } from '../runtime/playwright-runner';
import type { TestRunner } from '../tools/types';

/** Test frameworks Vigilis can drive. */
export const FRAMEWORKS = ['playwright', 'cypress', 'selenium'] as const;
export type Framework = (typeof FRAMEWORKS)[number];

export interface RunnerOpts {
  cwd: string;
  exec?: Exec;
  artifactsDir?: string;
}

/**
 * A pluggable per-framework strategy. The attestation core must NOT depend on this —
 * only behaviors and the test_run tool read it (via ctx.adapter).
 */
export interface FrameworkAdapter {
  readonly name: Framework;
  /** Map a URL to the spec file path this framework expects. */
  specPathForUrl(url: string, outDir?: string): string;
  /** Framework-specific fragment injected into the generate system prompt. */
  generateGuidance(): string;
  /** Framework-specific fragment for the heal system prompt. */
  healGuidance(specPath: string, selector: string): string;
  /** Build the TestRunner that runs this framework's CLI and parses → TestRunResult. */
  createRunner(opts: RunnerOpts): TestRunner;
}

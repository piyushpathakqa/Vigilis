# SP1 — Framework Adapter Abstraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a `FrameworkAdapter` seam so the agent's generate/gate/triage/heal loop is no longer hardcoded to Playwright — refactoring the existing Playwright path into the first adapter with **zero behavior change**.

**Architecture:** A `FrameworkAdapter` interface (detect · spec-path conventions · generate/heal prompt guidance · runner factory) is carried on `ToolContext` alongside the existing `runner`. Behaviors read framework specifics from `ctx.adapter` instead of inline Playwright strings. A generic `test_run` tool replaces `playwright_run` (kept as a deprecated alias). The attestation core stays framework-agnostic. This is the keystone for SP2 (Cypress) and SP3 (Selenium).

**Tech Stack:** TypeScript (ESM), Vitest, Zod. Monorepo package `@argus/core`.

---

## File Structure

**New files (`packages/core/src/framework/`):**
- `types.ts` — `Framework` union, `FRAMEWORKS` const, `FrameworkAdapter` + `RunnerOpts` interfaces.
- `detect.ts` — `detectFramework(cwd, deps?)` → confidence list; `pickFramework(...)`; `resolveAdapter(cwd, override?)`.
- `playwright-adapter.ts` — `PlaywrightAdapter` implementing `FrameworkAdapter` (owns the spec-path + prompt guidance previously inline in behaviors).
- `index.ts` — barrel re-export.
- Tests: `types.test.ts`, `detect.test.ts`, `playwright-adapter.test.ts`.

**New tool:**
- `packages/core/src/tools/definitions/test-run.ts` (+ `test-run.test.ts`) — generic `test_run` tool; `playwright_run` becomes a thin deprecated alias.

**Modified:**
- `packages/core/src/tools/types.ts` — add `adapter: FrameworkAdapter` to `ToolContext`.
- `packages/core/src/tools/definitions/index.ts` — swap `playwrightRun` → `testRun` (+ keep alias) in `ALL_TOOLS`.
- `packages/core/src/behaviors/generate.ts` — pull spec path + guidance from `ctx.adapter`.
- `packages/core/src/behaviors/heal.ts` — pull heal guidance from `ctx.adapter`.
- `packages/core/src/behaviors/triage.ts` — parameterise the one framework noun via `ctx.adapter.name`.
- `packages/core/src/tools/testing/fakes.ts` — default `adapter` in the ctx fake.
- `packages/core/src/index.ts` — `export * from './framework'`.
- `packages/mcp/src/context.ts`, `packages/cli/src/index.ts` (×4) — add `adapter` when building `ToolContext`.

**Boundary check:** nothing under `packages/core/src/agent/` (the attestation core) may import from `framework/`.

---

### Task 1: `Framework` type + `FrameworkAdapter` interface

**Files:**
- Create: `packages/core/src/framework/types.ts`
- Test: `packages/core/src/framework/types.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/framework/types.test.ts
import { describe, it, expect } from 'vitest';
import { FRAMEWORKS } from './types';

describe('framework types', () => {
  it('lists the three v1 frameworks in a stable order', () => {
    expect(FRAMEWORKS).toEqual(['playwright', 'cypress', 'selenium']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run src/framework/types.test.ts`
Expected: FAIL — cannot find module `./types`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/core/src/framework/types.ts
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
  /** Confidence (0..1) that this is the project's framework, from deps + config files in cwd. */
  detect(cwd: string): Promise<number>;
  /** Map a URL to the spec file path this framework expects. */
  specPathForUrl(url: string, outDir?: string): string;
  /** Framework-specific fragment injected into the generate system prompt. */
  generateGuidance(): string;
  /** Framework-specific fragment for the heal system prompt. */
  healGuidance(specPath: string, selector: string): string;
  /** Build the TestRunner that runs this framework's CLI and parses → TestRunResult. */
  createRunner(opts: RunnerOpts): TestRunner;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && npx vitest run src/framework/types.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/framework/types.ts packages/core/src/framework/types.test.ts
git commit -m "feat(core): FrameworkAdapter interface + Framework union"
```

---

### Task 2: `detectFramework` + `pickFramework`

**Files:**
- Create: `packages/core/src/framework/detect.ts`
- Test: `packages/core/src/framework/detect.test.ts`

Detection reads `package.json` deps and looks for config files. fs access is injected so tests stay pure.

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/framework/detect.test.ts
import { describe, it, expect } from 'vitest';
import { detectFramework, pickFramework } from './detect';

const fakeFs = (files: Record<string, string>) => ({
  readFile: async (p: string) => {
    if (p in files) return files[p];
    throw new Error('ENOENT');
  },
  exists: async (p: string) => p in files,
});

describe('detectFramework', () => {
  it('detects playwright from a dependency', async () => {
    const fs = fakeFs({ '/app/package.json': JSON.stringify({ devDependencies: { '@playwright/test': '1' } }) });
    const got = await detectFramework('/app', fs);
    expect(pickFramework(got)).toBe('playwright');
  });

  it('detects cypress from a config file even without the dep', async () => {
    const fs = fakeFs({ '/app/package.json': '{}', '/app/cypress.config.ts': '' });
    const got = await detectFramework('/app', fs);
    expect(pickFramework(got)).toBe('cypress');
  });

  it('detects selenium from its dependency', async () => {
    const fs = fakeFs({ '/app/package.json': JSON.stringify({ dependencies: { 'selenium-webdriver': '4' } }) });
    const got = await detectFramework('/app', fs);
    expect(pickFramework(got)).toBe('selenium');
  });

  it('returns null framework when nothing matches', async () => {
    const fs = fakeFs({ '/app/package.json': '{}' });
    expect(pickFramework(await detectFramework('/app', fs))).toBeNull();
  });

  it('ranks the higher-confidence framework first when several match', async () => {
    const fs = fakeFs({
      '/app/package.json': JSON.stringify({ devDependencies: { '@playwright/test': '1', cypress: '13' } }),
      '/app/playwright.config.ts': '',
    });
    // playwright matches dep + config (higher) vs cypress dep only
    expect(pickFramework(await detectFramework('/app', fs))).toBe('playwright');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run src/framework/detect.test.ts`
Expected: FAIL — cannot find module `./detect`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/core/src/framework/detect.ts
import { readFile as fsReadFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FRAMEWORKS, type Framework } from './types';

export interface DetectFs {
  readFile(path: string): Promise<string>;
  exists(path: string): Promise<boolean>;
}

const nodeFs: DetectFs = {
  readFile: (p) => fsReadFile(p, 'utf8'),
  exists: async (p) => {
    try {
      await fsReadFile(p);
      return true;
    } catch {
      return false;
    }
  },
};

interface Signature {
  deps: string[];
  configs: string[];
}

const SIGNATURES: Record<Framework, Signature> = {
  playwright: { deps: ['@playwright/test', 'playwright'], configs: ['playwright.config.ts', 'playwright.config.js', 'playwright.config.mjs'] },
  cypress: { deps: ['cypress'], configs: ['cypress.config.ts', 'cypress.config.js', 'cypress.json'] },
  selenium: { deps: ['selenium-webdriver'], configs: [] },
};

export interface FrameworkScore {
  framework: Framework;
  confidence: number;
}

/** Score each framework 0..1 from package.json deps + config-file presence. */
export async function detectFramework(cwd: string, fs: DetectFs = nodeFs): Promise<FrameworkScore[]> {
  let deps: Record<string, string> = {};
  try {
    const pkg = JSON.parse(await fs.readFile(join(cwd, 'package.json'))) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    deps = { ...pkg.dependencies, ...pkg.devDependencies };
  } catch {
    deps = {};
  }

  const scores: FrameworkScore[] = [];
  for (const framework of FRAMEWORKS) {
    const sig = SIGNATURES[framework];
    const hasDep = sig.deps.some((d) => d in deps);
    let hasConfig = false;
    for (const c of sig.configs) {
      if (await fs.exists(join(cwd, c))) {
        hasConfig = true;
        break;
      }
    }
    const confidence = (hasDep ? 0.6 : 0) + (hasConfig ? 0.4 : 0);
    if (confidence > 0) scores.push({ framework, confidence });
  }
  return scores.sort((a, b) => b.confidence - a.confidence);
}

/** Highest-confidence framework, or null if none detected. */
export function pickFramework(scores: FrameworkScore[]): Framework | null {
  return scores[0]?.framework ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && npx vitest run src/framework/detect.test.ts`
Expected: PASS (all 5).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/framework/detect.ts packages/core/src/framework/detect.test.ts
git commit -m "feat(core): framework detection from deps + config files"
```

---

### Task 3: `PlaywrightAdapter`

Moves the spec-path logic and the Playwright prompt fragments out of the behaviors and behind the interface — verbatim, so behavior is unchanged.

**Files:**
- Create: `packages/core/src/framework/playwright-adapter.ts`
- Test: `packages/core/src/framework/playwright-adapter.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/framework/playwright-adapter.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run src/framework/playwright-adapter.test.ts`
Expected: FAIL — cannot find module `./playwright-adapter`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/core/src/framework/playwright-adapter.ts
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
  'Write ONE runnable Playwright end-to-end test for the web app at the given URL.',
  '',
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

  async detect(): Promise<number> {
    return 1; // detection is centralised in detect.ts; adapter self-detect is a convenience.
  }

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && npx vitest run src/framework/playwright-adapter.test.ts`
Expected: PASS.

- [ ] **Step 5: Create the barrel + wire `detect` to the adapter**

```ts
// packages/core/src/framework/index.ts
export { FRAMEWORKS } from './types';
export type { Framework, FrameworkAdapter, RunnerOpts } from './types';
export { detectFramework, pickFramework } from './detect';
export type { FrameworkScore, DetectFs } from './detect';
export { PlaywrightAdapter } from './playwright-adapter';
export { resolveAdapter } from './resolve';
```

```ts
// packages/core/src/framework/resolve.ts
import { detectFramework, pickFramework } from './detect';
import { PlaywrightAdapter } from './playwright-adapter';
import type { Framework, FrameworkAdapter } from './types';

const ADAPTERS: Partial<Record<Framework, () => FrameworkAdapter>> = {
  playwright: () => new PlaywrightAdapter(),
  // cypress, selenium land in SP2 / SP3
};

/**
 * Resolve the adapter for a project. An explicit `override` (CLI --framework / config)
 * wins; otherwise detect from cwd; otherwise default to Playwright.
 */
export async function resolveAdapter(cwd: string, override?: Framework): Promise<FrameworkAdapter> {
  const chosen = override ?? pickFramework(await detectFramework(cwd)) ?? 'playwright';
  const make = ADAPTERS[chosen];
  if (!make) throw new Error(`Framework "${chosen}" is detected but its adapter is not built yet.`);
  return make();
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/framework/playwright-adapter.ts packages/core/src/framework/playwright-adapter.test.ts packages/core/src/framework/index.ts packages/core/src/framework/resolve.ts
git commit -m "feat(core): PlaywrightAdapter + resolveAdapter"
```

---

### Task 4: Generic `test_run` tool (+ `playwright_run` alias)

**Files:**
- Create: `packages/core/src/tools/definitions/test-run.ts`
- Test: `packages/core/src/tools/definitions/test-run.test.ts`
- Modify: `packages/core/src/tools/definitions/playwright.ts`, `packages/core/src/tools/definitions/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/tools/definitions/test-run.test.ts
import { describe, it, expect } from 'vitest';
import { testRun } from './test-run';
import { makeCtx } from '../testing/fakes';

describe('test_run tool', () => {
  it('delegates to ctx.runner and reports counts', async () => {
    const ctx = makeCtx({
      runner: { run: async () => ({ passed: 3, failed: 0, summary: '3 passed, 0 failed', artifactsDir: 'r' }) },
    });
    const res = await testRun.handler({ specPath: 'a.spec.ts' }, ctx);
    expect(res.content).toBe('3 passed, 0 failed');
    expect(res.meta).toMatchObject({ passed: 3, failed: 0, artifactsDir: 'r' });
  });

  it('is registered under the framework-neutral name', () => {
    expect(testRun.name).toBe('test_run');
  });
});
```

> Note: confirm `makeCtx` is the exported fake helper in `packages/core/src/tools/testing/fakes.ts`; if it has a different name, use that. (Task 6 adds the `adapter` default there — until then `makeCtx` may need an `adapter` override; if the test fails only on a missing `adapter`, do Task 6 first.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run src/tools/definitions/test-run.test.ts`
Expected: FAIL — cannot find module `./test-run`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/core/src/tools/definitions/test-run.ts
import { z } from 'zod';
import { defineTool } from '../types';

/** Framework-neutral test runner tool. Delegates to ctx.runner (built by the active adapter). */
export const testRun = defineTool({
  name: 'test_run',
  description: 'Run the project test suite (any supported framework) and report pass/fail counts and the artifacts directory.',
  input: z.object({
    specPath: z.string().optional().describe('A specific spec to run; omit to run all specs'),
  }),
  handler: async ({ specPath }, ctx) => {
    const r = await ctx.runner.run(specPath);
    return {
      content: r.summary,
      meta: { passed: r.passed, failed: r.failed, artifactsDir: r.artifactsDir },
    };
  },
});
```

- [ ] **Step 4: Make `playwright_run` a deprecated alias**

```ts
// packages/core/src/tools/definitions/playwright.ts
import { defineTool } from '../types';
import { testRun } from './test-run';

/** @deprecated Use `test_run`. Kept one release so existing agents/configs don't break. */
export const playwrightRun = defineTool({ ...testRun, name: 'playwright_run' });
```

- [ ] **Step 5: Register `testRun` first in `ALL_TOOLS`**

```ts
// packages/core/src/tools/definitions/index.ts  (edit the imports + ALL_TOOLS array)
import { testRun } from './test-run';
import { playwrightRun } from './playwright';
// ...
export const ALL_TOOLS = [
  fsRead,
  fsWrite,
  fsList,
  browserNavigate,
  browserClick,
  browserType,
  browserSnapshot,
  domQuery,
  domTestids,
  testRun,
  playwrightRun, // deprecated alias — remove next release
];
```

- [ ] **Step 6: Run tests**

Run: `cd packages/core && npx vitest run src/tools/definitions/test-run.test.ts src/tools/default-registry.test.ts`
Expected: PASS. If `default-registry.test.ts` asserts an exact tool list/count, update it to include `test_run` (and the alias).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/tools/definitions/test-run.ts packages/core/src/tools/definitions/test-run.test.ts packages/core/src/tools/definitions/playwright.ts packages/core/src/tools/definitions/index.ts packages/core/src/tools/default-registry.test.ts
git commit -m "feat(core): generic test_run tool; playwright_run becomes deprecated alias"
```

---

### Task 5: Add `adapter` to `ToolContext` + default it in the test fake

**Files:**
- Modify: `packages/core/src/tools/types.ts:9-16`
- Modify: `packages/core/src/tools/testing/fakes.ts` (the ctx fake, ~line 95-105)

- [ ] **Step 1: Add the field to the interface**

```ts
// packages/core/src/tools/types.ts — inside ToolContext, after `runner: TestRunner;`
  /** The active framework adapter (Playwright/Cypress/Selenium). Selected by detection/config. */
  adapter: import('../framework/types').FrameworkAdapter;
```

> Use the inline `import('...')` type to avoid a value import cycle (`framework/types` imports `TestRunner` from this file).

- [ ] **Step 2: Default `adapter` in the fake ctx**

In `packages/core/src/tools/testing/fakes.ts`, add an import and extend the ctx builder so existing callers don't have to pass an adapter:

```ts
// at top of fakes.ts
import { PlaywrightAdapter } from '../../framework/playwright-adapter';
// ...inside the ctx fake object (next to `runner: over.runner ?? new FakeTestRunner(),`)
    adapter: over.adapter ?? new PlaywrightAdapter(),
```

Ensure the `over` (overrides) type for the fake includes `adapter?: FrameworkAdapter` (widen the `Partial<ToolContext>` if it's typed explicitly).

- [ ] **Step 3: Run the whole core suite**

Run: `cd packages/core && npx vitest run`
Expected: PASS. Type errors about missing `adapter` in any test that hand-builds a ctx → switch it to `makeCtx`/the fake, or add `adapter: new PlaywrightAdapter()`.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/tools/types.ts packages/core/src/tools/testing/fakes.ts
git commit -m "feat(core): carry FrameworkAdapter on ToolContext"
```

---

### Task 6: Refactor `generate` to read from `ctx.adapter`

**Files:**
- Modify: `packages/core/src/behaviors/generate.ts`
- Check: `packages/core/src/behaviors/generate.test.ts`

- [ ] **Step 1: Replace the inline spec-path + Playwright prompt with adapter calls**

In `generate.ts`:
- Delete the local `specPathForUrl` function body and instead call `ctx.adapter.specPathForUrl(url, outDir)`.
  Keep the existing `export function specPathForUrl` as a thin re-export from the adapter for back-compat:
  `export { } ` — simplest: keep importing for the behaviors/index export by re-exporting from the adapter module.
- Replace the framework-specific lines of `GENERATE_SYSTEM` with `ctx.adapter.generateGuidance()`, keeping the generic process/role lines:

```ts
const GENERATE_SYSTEM_HEAD = [
  'You are Vigilis, a senior SDET. Your job is to write ONE runnable end-to-end test',
  'for the web app at the given URL.',
  '',
  'Process:',
  '1. Navigate to the URL and explore with browser_snapshot and dom_testids.',
  '2. If the app requires login, find the credentials shown on the page and log in.',
  '3. Exercise the primary user flow (e.g. log in, then add an item to the cart).',
  '4. Write exactly one spec file to the EXACT path you are given, using fs_write.',
  '',
].join('\n');

// inside generate(), after destructuring ctx:
const specPath = ctx.adapter.specPathForUrl(url, outDir);
const system = `${GENERATE_SYSTEM_HEAD}\n${ctx.adapter.generateGuidance()}\n\nKeep exploration focused to limit cost. After writing the file, briefly report what you wrote.`;
// pass `system` to runAgentLoop instead of GENERATE_SYSTEM
```

- [ ] **Step 2: Preserve the `specPathForUrl` export**

`behaviors/index.ts` re-exports `specPathForUrl` from `./generate`. Keep that working:

```ts
// generate.ts
import { PlaywrightAdapter } from '../framework/playwright-adapter';
const defaultAdapter = new PlaywrightAdapter();
/** @deprecated prefer ctx.adapter.specPathForUrl — kept for back-compat. */
export function specPathForUrl(url: string, outDir = 'tests/generated'): string {
  return defaultAdapter.specPathForUrl(url, outDir);
}
```

- [ ] **Step 3: Run generate tests**

Run: `cd packages/core && npx vitest run src/behaviors/generate.test.ts`
Expected: PASS. If a test asserts the exact `GENERATE_SYSTEM` string, relax it to assert the prompt **contains** the key guidance (`@playwright/test`, `getByTestId`) — the content is identical, just sourced from the adapter.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/behaviors/generate.ts packages/core/src/behaviors/generate.test.ts
git commit -m "refactor(core): generate reads spec path + guidance from ctx.adapter"
```

---

### Task 7: Refactor `heal` and `triage` to the adapter

**Files:**
- Modify: `packages/core/src/behaviors/heal.ts`
- Modify: `packages/core/src/behaviors/triage.ts`
- Check: their `.test.ts` siblings

- [ ] **Step 1: heal — source guidance from `ctx.adapter`**

In `heal.ts`, replace `healSystem(specPath, suggestedSelector)` body with a generic head + adapter guidance, and ensure the verification call stays `ctx.runner.run(specPath)`:

```ts
function healSystem(adapterGuidance: string): string {
  return [
    'You are Vigilis, fixing a DOM-drift test failure (NOT a real bug).',
    adapterGuidance,
    '',
    'Report briefly when done.',
  ].join('\n');
}
// in heal():  system: healSystem(ctx.adapter.healGuidance(specPath, suggestedSelector)),
```

Heal currently calls `createDefaultRegistry()` internally — leave as-is (it now includes `test_run`).

- [ ] **Step 2: triage — parameterise the framework noun**

In `triage.ts`, change the first line of `TRIAGE_SYSTEM` from a constant to use `ctx.adapter.name`. Make `TRIAGE_SYSTEM` a function:

```ts
const triageSystem = (framework: string) => [
  `You are Vigilis triaging a FAILED ${framework} test. Classify the failure as exactly one of:`,
  // ...rest unchanged...
].join('\n');
// in triage():  system: triageSystem(ctx.adapter.name),
// and the prompt line: `A ${ctx.adapter.name} test failed. Spec: ${specPath}. App under test: ${url}.`
```

- [ ] **Step 3: Run heal + triage tests**

Run: `cd packages/core && npx vitest run src/behaviors/heal.test.ts src/behaviors/triage.test.ts`
Expected: PASS. Relax any exact-prompt-string assertions to `toContain` checks as in Task 6.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/behaviors/heal.ts packages/core/src/behaviors/triage.ts packages/core/src/behaviors/heal.test.ts packages/core/src/behaviors/triage.test.ts
git commit -m "refactor(core): heal + triage read framework specifics from ctx.adapter"
```

---

### Task 8: Wire `adapter` into real `ToolContext` construction (MCP + CLI)

**Files:**
- Modify: `packages/core/src/index.ts` (export the framework module)
- Modify: `packages/mcp/src/context.ts:~28`
- Modify: `packages/cli/src/index.ts` (4 ctx sites: ~136, ~224, ~283, ~403)

- [ ] **Step 1: Export the framework module**

```ts
// packages/core/src/index.ts — add with the other `export *` lines
export * from './framework';
```

- [ ] **Step 2: MCP context**

In `packages/mcp/src/context.ts`, build the adapter once and add it to the ctx. Replace the inline `runner: new PlaywrightTestRunner(...)` block:

```ts
import { resolveAdapter } from '@argus/core';
// where the ctx is assembled (make the surrounding fn async if needed):
const adapter = await resolveAdapter(process.cwd());
// ctx object:
  workspaceRoot: process.cwd(),
  browser: /* existing */,
  runner: adapter.createRunner({ cwd: process.cwd() }),
  adapter,
```

- [ ] **Step 3: CLI contexts (×4)**

In `packages/cli/src/index.ts`, at each of the four sites that currently do
`const runner = new PlaywrightTestRunner({ cwd: process.cwd() })` (or inline `runner:`),
resolve the adapter and derive the runner from it. Add a `--framework <name>` option to the
`generate`, `triage`, `heal`, and `smoke` commands and thread it in:

```ts
import { resolveAdapter, type Framework } from '@argus/core';
// per command handler (these are already async):
const adapter = await resolveAdapter(process.cwd(), opts.framework as Framework | undefined);
const runner = adapter.createRunner({ cwd: process.cwd() });
// ctx: { workspaceRoot: process.cwd(), browser: session, runner, adapter }
```

Add the option to each command definition, e.g.:
`.option('--framework <name>', 'Test framework: playwright | cypress | selenium (default: auto-detect)')`.

> SP1 only ships the Playwright adapter, so `--framework cypress|selenium` will throw the clear "adapter not built yet" error from `resolveAdapter`. That is intended and honest until SP2/SP3.

- [ ] **Step 4: Build everything + full test + typecheck**

```bash
cd /Users/piyushpathak/Work/argus
pnpm -r build
pnpm -r test
```
Expected: all packages build; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/index.ts packages/mcp/src/context.ts packages/cli/src/index.ts
git commit -m "feat(cli,mcp): resolve FrameworkAdapter into ToolContext (+ --framework flag)"
```

---

### Task 9: Zero-behavior-change verification against `sample-shop`

**Files:** none (verification task).

- [ ] **Step 1: Confirm the attestation core never imports the framework module**

Run: `grep -rn "framework" packages/core/src/agent || echo "clean — agent core is framework-agnostic"`
Expected: `clean`.

- [ ] **Step 2: Confirm `test_run` and the alias both register**

Run: `cd packages/core && npx vitest run src/tools/default-registry.test.ts`
Expected: PASS, with `test_run` present.

- [ ] **Step 3: Smoke the CLI generate against the sample app (manual, needs ANTHROPIC_API_KEY + chromium)**

Start the sample app, then:
```bash
node packages/cli/dist/index.js generate http://localhost:3000 --run
```
Expected: identical behaviour to before SP1 — a Playwright `.spec.ts` is written under `tests/generated/` and runs. (Auto-detect resolves Playwright; the agent now calls `test_run` instead of `playwright_run`, which is functionally identical.)

- [ ] **Step 4: Final commit (if Step 1-3 produced any test fixups)**

```bash
git add -A && git commit -m "test(core): verify framework-agnostic core + zero behavior change (SP1)"
```

---

## Self-Review

**Spec coverage:** SP1 design items — adapter interface (Task 1), detection (Task 2), Playwright-as-adapter + resolveAdapter (Task 3), generic `test_run` + alias (Task 4), `ctx.adapter` (Task 5), behaviors refactor (Tasks 6-7), CLI/MCP wiring + `--framework` (Task 8), framework-agnostic-core + zero-behavior-change acceptance (Task 9). All covered.

**Placeholder scan:** No TBDs. Every new module has complete code; refactor tasks show the exact transformation. The one judgement call (relaxing exact-string prompt assertions to `toContain`) is spelled out where it occurs.

**Type consistency:** `FrameworkAdapter`/`RunnerOpts`/`Framework` names are consistent across types.ts, detect.ts, playwright-adapter.ts, resolve.ts, ToolContext, and the CLI/MCP wiring. `Exec` is imported from `runtime/playwright-runner` (where it is defined). `test_run` is the tool name everywhere; `playwright_run` is the alias only.

**Risk note:** the inline `import('../framework/types')` type in `ToolContext` avoids a value-import cycle (framework/types imports `TestRunner` from tools/types). If TS still flags a cycle, move `Exec` into a `runtime/exec.ts` and import from there in both places.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-23-sp1-framework-adapter-abstraction.md`. Two execution options:

1. **Subagent-Driven (recommended)** — a fresh subagent per task, two-stage review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session with checkpoints for review.

Which approach?

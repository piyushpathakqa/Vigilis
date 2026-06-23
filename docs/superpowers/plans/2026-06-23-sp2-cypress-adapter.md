# SP2 — Cypress Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fully-working `CypressAdapter` so `vigilis generate/triage/heal --framework cypress` produces, runs, triages, and self-heals Cypress (`.cy.ts`) tests — built on the SP1 `FrameworkAdapter` seam, with no change to Playwright behavior.

**Architecture:** Mirror the Playwright path. A `CypressTestRunner implements TestRunner` runs `npx cypress run --reporter json` and parses the Mocha-JSON result; a `CypressAdapter implements FrameworkAdapter` supplies Cypress spec-path conventions, generate/heal prompt guidance, and that runner; register it in `resolve.ts`. The agent still explores the live app over the shared Playwright/CDP browser session — only authoring/running/healing differ.

**Tech Stack:** TypeScript (ESM), Vitest, Zod. Package `@argus/core`. Cypress is the *user's* dependency (invoked via `npx`), not a core dependency — the runner uses injected `Exec`, so core tests never spawn Cypress.

---

## File Structure

**New (`packages/core/src/`):**
- `runtime/cypress-runner.ts` (+ `.test.ts`) — `parseCypressJson` (pure), `extractCypressFailures` (pure), `CypressTestRunner implements TestRunner`.
- `framework/cypress-adapter.ts` (+ `.test.ts`) — `CypressAdapter implements FrameworkAdapter`.

**Modified:**
- `packages/core/src/runtime/index.ts` — export the Cypress runner symbols.
- `packages/core/src/framework/resolve.ts` — register `cypress` in `ADAPTERS`.
- `packages/core/src/framework/index.ts` — export `CypressAdapter`.
- `packages/core/src/framework/resolve.test.ts` (create if absent) — assert cypress now resolves.
- `packages/cli/src/index.ts` — drop the hardcoded `--out` default so the adapter picks the default spec dir per framework.

**Boundary check (unchanged from SP1):** nothing in `packages/core/src/agent/` may import `framework/` or the Cypress runner.

---

### Task 1: `parseCypressJson` + `extractCypressFailures` (pure)

Cypress's `--reporter json` emits the Mocha JSON shape:
```json
{ "stats": { "tests": 3, "passes": 2, "pending": 0, "failures": 1 },
  "failures": [ { "fullTitle": "...", "file": "cypress/e2e/cart.cy.ts", "err": { "message": "..." } } ] }
```

**Files:**
- Create: `packages/core/src/runtime/cypress-runner.ts`
- Test: `packages/core/src/runtime/cypress-runner.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/runtime/cypress-runner.test.ts
import { describe, it, expect } from 'vitest';
import { parseCypressJson, extractCypressFailures, type CypressMochaReport } from './cypress-runner';

const report: CypressMochaReport = {
  stats: { tests: 3, passes: 2, pending: 1, failures: 1 },
  failures: [
    { fullTitle: 'cart adds item', file: 'cypress/e2e/cart.cy.ts', err: { message: 'expected pay button' } },
  ],
};

describe('parseCypressJson', () => {
  it('summarises passes/failures into a TestRunResult', () => {
    const r = parseCypressJson(report, 'cypress/screenshots');
    expect(r.passed).toBe(2);
    expect(r.failed).toBe(1);
    expect(r.summary).toContain('2 passed');
    expect(r.summary).toContain('1 failed');
    expect(r.artifactsDir).toBe('cypress/screenshots');
  });

  it('treats an empty/garbage report as zero counts', () => {
    const r = parseCypressJson({}, 'd');
    expect(r.passed).toBe(0);
    expect(r.failed).toBe(0);
  });
});

describe('extractCypressFailures', () => {
  it('returns spec path, title, and error per failure', () => {
    const f = extractCypressFailures(report);
    expect(f).toEqual([
      { specPath: 'cypress/e2e/cart.cy.ts', title: 'cart adds item', error: 'expected pay button' },
    ]);
  });

  it('is empty when there are no failures', () => {
    expect(extractCypressFailures({ stats: { tests: 1, passes: 1, pending: 0, failures: 0 } })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run src/runtime/cypress-runner.test.ts`
Expected: FAIL — cannot find module `./cypress-runner`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/core/src/runtime/cypress-runner.ts
import { spawn } from 'node:child_process';
import type { TestRunner, TestRunResult } from '../tools/types';
import type { Exec, ExecResult } from './playwright-runner';

export interface CypressStats {
  tests?: number;
  passes?: number;
  pending?: number;
  failures?: number;
}
export interface CypressFailureRaw {
  fullTitle?: string;
  title?: string;
  file?: string;
  err?: { message?: string };
}
export interface CypressMochaReport {
  stats?: CypressStats;
  failures?: CypressFailureRaw[];
}

export interface CypressFailure {
  specPath: string;
  title: string;
  error: string;
}

/** Walk a Cypress (Mocha JSON) report's failures. Pure. */
export function extractCypressFailures(report: CypressMochaReport): CypressFailure[] {
  return (report.failures ?? []).map((f) => ({
    specPath: f.file ?? '',
    title: f.fullTitle ?? f.title ?? '',
    error: f.err?.message ?? 'unknown failure',
  }));
}

/** Turn Cypress `--reporter json` output into a TestRunResult. Pure. */
export function parseCypressJson(report: CypressMochaReport, artifactsDir: string): TestRunResult {
  const s = report.stats ?? {};
  const passed = s.passes ?? 0;
  const failed = s.failures ?? 0;
  const parts = [`${passed} passed`, `${failed} failed`];
  if (s.pending) parts.push(`${s.pending} pending`);
  return { passed, failed, summary: parts.join(', '), artifactsDir };
}

/** Cypress prints the JSON among other output; grab the outermost JSON object. */
export function extractJsonBlob(stdout: string): string {
  const start = stdout.indexOf('{');
  const end = stdout.lastIndexOf('}');
  return start >= 0 && end > start ? stdout.slice(start, end + 1) : '{}';
}

const defaultExec: Exec = (cmd, args, opts) =>
  new Promise<ExecResult>((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: opts.cwd });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += String(d)));
    child.stderr.on('data', (d) => (stderr += String(d)));
    child.on('error', reject);
    child.on('close', (code) => resolve({ stdout, stderr, code }));
  });

export interface CypressTestRunnerOptions {
  cwd: string;
  exec?: Exec;
  artifactsDir?: string;
}

/** Runs `npx cypress run --reporter json [--spec <path>]` and parses the result. */
export class CypressTestRunner implements TestRunner {
  constructor(private readonly opts: CypressTestRunnerOptions) {}

  async run(specPath?: string): Promise<TestRunResult> {
    const exec = this.opts.exec ?? defaultExec;
    const artifactsDir = this.opts.artifactsDir ?? 'cypress/screenshots';
    const args = ['cypress', 'run', '--reporter', 'json', ...(specPath ? ['--spec', specPath] : [])];
    const { stdout } = await exec('npx', args, { cwd: this.opts.cwd });
    let report: CypressMochaReport = {};
    try {
      report = JSON.parse(extractJsonBlob(stdout)) as CypressMochaReport;
    } catch {
      report = {};
    }
    return parseCypressJson(report, artifactsDir);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && npx vitest run src/runtime/cypress-runner.test.ts`
Expected: PASS (all 4).

- [ ] **Step 5: Export from runtime barrel**

```ts
// packages/core/src/runtime/index.ts — add:
export { CypressTestRunner, parseCypressJson, extractCypressFailures, extractJsonBlob } from './cypress-runner';
export type { CypressMochaReport, CypressFailure } from './cypress-runner';
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/runtime/cypress-runner.ts packages/core/src/runtime/cypress-runner.test.ts packages/core/src/runtime/index.ts
git commit -m "feat(core): Cypress test runner + JSON parsing"
```

---

### Task 2: `CypressAdapter`

**Files:**
- Create: `packages/core/src/framework/cypress-adapter.ts`
- Test: `packages/core/src/framework/cypress-adapter.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/framework/cypress-adapter.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run src/framework/cypress-adapter.test.ts`
Expected: FAIL — cannot find module `./cypress-adapter`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/core/src/framework/cypress-adapter.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && npx vitest run src/framework/cypress-adapter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/framework/cypress-adapter.ts packages/core/src/framework/cypress-adapter.test.ts
git commit -m "feat(core): CypressAdapter (.cy.ts conventions, Cypress idioms, runner)"
```

---

### Task 3: Register Cypress in `resolveAdapter`

**Files:**
- Modify: `packages/core/src/framework/resolve.ts`
- Modify: `packages/core/src/framework/index.ts`
- Test: `packages/core/src/framework/resolve.test.ts` (create if it doesn't exist)

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/framework/resolve.test.ts
import { describe, it, expect } from 'vitest';
import { resolveAdapter } from './resolve';

describe('resolveAdapter', () => {
  it('returns the CypressAdapter for an explicit cypress override', async () => {
    const a = await resolveAdapter(process.cwd(), 'cypress');
    expect(a.name).toBe('cypress');
  });

  it('returns the PlaywrightAdapter for an explicit playwright override', async () => {
    const a = await resolveAdapter(process.cwd(), 'playwright');
    expect(a.name).toBe('playwright');
  });

  it('still throws a clear error for the not-yet-built selenium adapter', async () => {
    await expect(resolveAdapter(process.cwd(), 'selenium')).rejects.toThrow(/not yet implemented/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run src/framework/resolve.test.ts`
Expected: FAIL — cypress override throws "not yet implemented".

- [ ] **Step 3: Register the adapter**

```ts
// packages/core/src/framework/resolve.ts — add the import and map entry
import { CypressAdapter } from './cypress-adapter';
// ...
const ADAPTERS: Partial<Record<Framework, () => FrameworkAdapter>> = {
  playwright: () => new PlaywrightAdapter(),
  cypress: () => new CypressAdapter(),
  // selenium lands in SP3
};
```

```ts
// packages/core/src/framework/index.ts — add:
export { CypressAdapter } from './cypress-adapter';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && npx vitest run src/framework/resolve.test.ts`
Expected: PASS (all 3).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/framework/resolve.ts packages/core/src/framework/index.ts packages/core/src/framework/resolve.test.ts
git commit -m "feat(core): register CypressAdapter in resolveAdapter"
```

---

### Task 4: Let the adapter choose the default spec dir (CLI `--out`)

Today the CLI `generate` command hardcodes `--out` default `'tests/generated'`, which would force Cypress specs into the wrong directory. Drop the default so `ctx.adapter.specPathForUrl` uses each framework's own default (`tests/generated` for Playwright, `cypress/e2e` for Cypress).

**Files:**
- Modify: `packages/cli/src/index.ts`

- [ ] **Step 1: Drop the hardcoded default**

Change the generate command's option from:
```ts
  .option('--out <dir>', 'output directory for the spec', 'tests/generated')
```
to:
```ts
  .option('--out <dir>', 'output directory for the spec (default: framework convention)')
```
The action already passes `outDir: opts.out` to `generate`, and `generate` calls `ctx.adapter.specPathForUrl(url, outDir)` where `outDir` is now `undefined` unless `--out` was given — so the adapter default applies. Confirm the `opts` type for `out` becomes optional (`out?: string`).

- [ ] **Step 2: Build + sanity check**

Run:
```bash
cd /Users/piyushpathak/Work/argus && pnpm --filter vigilis build
node packages/cli/dist/index.js generate --help | grep -A1 -- '--out'
```
Expected: builds; `--out` shows the new description with no default.

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/index.ts
git commit -m "feat(cli): let the framework adapter choose the default spec dir"
```

---

### Task 5: Cypress fixture for manual end-to-end acceptance

Automated tests above are unit-level (pure parse + guidance + resolution). This task adds a minimal Cypress setup so the maintainer can manually verify the full loop against `apps/sample-shop`. Keep it small and self-contained; do NOT wire it into CI.

**Files:**
- Create: `apps/sample-shop/cypress.config.ts`
- Create: `apps/sample-shop/cypress/e2e/.gitkeep`
- Modify: `apps/sample-shop/package.json` (add `cypress` devDependency + a `cy:run` script)

- [ ] **Step 1: Add a minimal Cypress config**

```ts
// apps/sample-shop/cypress.config.ts
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: false,
    video: false,
  },
});
```

- [ ] **Step 2: Add the dep + script (do not install in CI)**

In `apps/sample-shop/package.json`, add to `devDependencies`: `"cypress": "^13"`, and to `scripts`: `"cy:run": "cypress run --reporter json"`. Add `.gitkeep` so `cypress/e2e/` exists for generated specs.

- [ ] **Step 3: Document the manual acceptance (no automated assertion)**

This task has no unit test — it is a manual fixture. Record the manual steps in the commit body:
```
Manual acceptance (needs ANTHROPIC_API_KEY + chromium + `pnpm --filter sample-shop install`):
  1. pnpm --filter sample-shop dev            # app on :3000
  2. node packages/cli/dist/index.js generate http://localhost:3000 --framework cypress --run
     → writes apps/sample-shop/cypress/e2e/home.cy.ts and runs it green
  3. break a data-testid, then: vigilis heal http://localhost:3000 --framework cypress --spec <file>
     → triage=dom-drift, locator rewritten, verified green
```

- [ ] **Step 4: Commit**

```bash
git add apps/sample-shop/cypress.config.ts apps/sample-shop/cypress/e2e/.gitkeep apps/sample-shop/package.json
git commit -m "test(sample-shop): minimal Cypress fixture for manual e2e acceptance"
```

---

### Task 6: Full verification

**Files:** none (verification).

- [ ] **Step 1: Build + test everything**

Run:
```bash
cd /Users/piyushpathak/Work/argus && pnpm -r build && pnpm -r test
```
Expected: all packages build; all tests pass (core gains the Cypress runner + adapter + resolve tests; cli 6; mcp 2).

- [ ] **Step 2: Confirm the boundary still holds**

Run: `grep -rn "framework\|cypress-runner" packages/core/src/agent || echo "clean — attestation core untouched"`
Expected: `clean`.

- [ ] **Step 3: Confirm Playwright behavior is unchanged**

Run: `cd packages/core && npx vitest run src/framework/playwright-adapter.test.ts src/behaviors`
Expected: PASS — SP2 added Cypress without touching the Playwright path.

- [ ] **Step 4: Honesty check**

Run: `grep -rin "cypress" apps/web/src packages/*/README.md 2>/dev/null || echo "no site/README cypress claims yet (correct — SP4 flips copy)"`
Expected: nothing user-facing claims Cypress support yet (CLI `--help` listing it as an option is fine — it now actually works).

---

## Self-Review

**Spec coverage:** design-doc SP2 items — Cypress runner + JSON parse (Task 1), `CypressAdapter` with `.cy.ts` + idioms + heal guidance (Task 2), registration so `--framework cypress` works (Task 3), correct default spec dir (Task 4), sample-shop fixture for manual acceptance (Task 5), verification incl. boundary + Playwright-unchanged + honesty (Task 6). Covered.

**Placeholder scan:** none — all new modules have complete code and tests; the only non-tested task (the fixture) is explicitly a manual artifact with documented steps.

**Type consistency:** `Exec`/`ExecResult` reused from `runtime/playwright-runner` (already exported). `CypressTestRunner`/`CypressAdapter` implement the existing `TestRunner`/`FrameworkAdapter` interfaces unchanged. `parseCypressJson(report, artifactsDir)` mirrors `parsePlaywrightJson`'s signature. `ADAPTERS` map keyed by `Framework`.

**Risk:** Cypress's `--reporter json` can interleave non-JSON output on stdout; `extractJsonBlob` grabs the outermost `{...}`. If a real run shows the blob is unreliable, switch to `--reporter json --reporter-options output=<file>` and read the file in the runner (note for the manual acceptance step).

---

## Execution Handoff

Plan saved to `docs/superpowers/plans/2026-06-23-sp2-cypress-adapter.md`. Continuing **subagent-driven** (same as SP1), per the chosen workflow — no need to re-ask.

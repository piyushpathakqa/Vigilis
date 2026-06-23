# SP3 — Selenium Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fully-working `SeleniumAdapter` (`selenium-webdriver` + Mocha) so `vigilis generate/triage/heal --framework selenium` produces, runs, triages, and self-heals Selenium (`*.test.ts`) tests — completing the three-framework v1, with no change to Playwright or Cypress behavior.

**Architecture:** Selenium tests are Mocha tests driving `selenium-webdriver`. Mocha's JSON reporter emits the SAME Mocha-JSON shape Cypress already produces, so SP3 first extracts that parser into a shared `runtime/mocha-json.ts` (Cypress refactored to reuse it), then `SeleniumTestRunner` reuses it too. A `SeleniumAdapter implements FrameworkAdapter` supplies Selenium spec conventions + prompt guidance + the runner; register it in `resolve.ts`. Same fail-closed discipline as Cypress (file-based reporter; missing report = failure, never a false green).

**Tech Stack:** TypeScript (ESM), Vitest, Zod. Package `@argus/core`. `selenium-webdriver`, `mocha`, and a TS loader (`tsx`) are the *user's* dependencies (invoked via `npx`); core uses injected `Exec`/`readReport`, so core tests never spawn a browser or Mocha.

---

## File Structure

**New (`packages/core/src/`):**
- `runtime/mocha-json.ts` (+ `.test.ts`) — `parseMochaJson`, `extractMochaFailures`, `MochaReport`/`MochaFailure` types (extracted from the Cypress runner; the canonical Mocha-JSON parser).
- `runtime/selenium-runner.ts` (+ `.test.ts`) — `SeleniumTestRunner implements TestRunner` (runs `npx mocha … --reporter json`, reads the file report, fails closed).
- `framework/selenium-adapter.ts` (+ `.test.ts`) — `SeleniumAdapter implements FrameworkAdapter`.

**Modified:**
- `runtime/cypress-runner.ts` — delegate parsing to `mocha-json.ts`; keep `parseCypressJson`/`extractCypressFailures`/`CypressMochaReport`/`CypressFailure` as re-export aliases so SP2 tests stay green.
- `runtime/index.ts` — export the Mocha-JSON parser + the Selenium runner.
- `framework/resolve.ts` — register `selenium` in `ADAPTERS`.
- `framework/index.ts` — export `SeleniumAdapter`.
- `framework/resolve.test.ts` — selenium now RESOLVES (was "throws not yet implemented").
- `apps/sample-shop/package.json` (+ `.mocharc.json`, fixture dir) — manual acceptance.

**Boundary check (unchanged):** nothing in `packages/core/src/agent/` may import `framework/` or any runner.

---

### Task 1: Extract the shared Mocha-JSON parser

Cypress and Selenium both emit Mocha-JSON. Move the parser to one module; make Cypress reuse it.

**Files:**
- Create: `packages/core/src/runtime/mocha-json.ts`
- Test: `packages/core/src/runtime/mocha-json.test.ts`
- Modify: `packages/core/src/runtime/cypress-runner.ts`, `packages/core/src/runtime/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/runtime/mocha-json.test.ts
import { describe, it, expect } from 'vitest';
import { parseMochaJson, extractMochaFailures, type MochaReport } from './mocha-json';

const report: MochaReport = {
  stats: { tests: 3, passes: 2, pending: 1, failures: 1 },
  failures: [
    { fullTitle: 'cart adds item', file: 'tests/selenium/cart.test.ts', err: { message: 'no pay button' } },
  ],
};

describe('parseMochaJson', () => {
  it('summarises passes/failures into a TestRunResult', () => {
    const r = parseMochaJson(report, 'artifacts');
    expect(r.passed).toBe(2);
    expect(r.failed).toBe(1);
    expect(r.summary).toContain('2 passed');
    expect(r.summary).toContain('1 failed');
    expect(r.artifactsDir).toBe('artifacts');
  });

  it('treats a report with no stats as zero counts (caller decides fail-closed)', () => {
    const r = parseMochaJson({}, 'd');
    expect(r.passed).toBe(0);
    expect(r.failed).toBe(0);
  });
});

describe('extractMochaFailures', () => {
  it('returns spec path, title, and error per failure', () => {
    expect(extractMochaFailures(report)).toEqual([
      { specPath: 'tests/selenium/cart.test.ts', title: 'cart adds item', error: 'no pay button' },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run src/runtime/mocha-json.test.ts`
Expected: FAIL — cannot find module `./mocha-json`.

- [ ] **Step 3: Write the parser (move the logic out of cypress-runner)**

```ts
// packages/core/src/runtime/mocha-json.ts
import type { TestRunResult } from '../tools/types';

export interface MochaStats {
  tests?: number;
  passes?: number;
  pending?: number;
  failures?: number;
}
export interface MochaFailureRaw {
  fullTitle?: string;
  title?: string;
  file?: string;
  err?: { message?: string };
}
export interface MochaReport {
  stats?: MochaStats;
  failures?: MochaFailureRaw[];
}

export interface MochaFailure {
  specPath: string;
  title: string;
  error: string;
}

/** Walk a Mocha-JSON report's failures. Pure. */
export function extractMochaFailures(report: MochaReport): MochaFailure[] {
  return (report.failures ?? []).map((f) => ({
    specPath: f.file ?? '',
    title: f.fullTitle ?? f.title ?? '',
    error: f.err?.message ?? 'unknown failure',
  }));
}

/** Turn a Mocha-JSON report into a TestRunResult. Pure. */
export function parseMochaJson(report: MochaReport, artifactsDir: string): TestRunResult {
  const s = report.stats ?? {};
  const passed = s.passes ?? 0;
  const failed = s.failures ?? 0;
  const parts = [`${passed} passed`, `${failed} failed`];
  if (s.pending) parts.push(`${s.pending} pending`);
  return { passed, failed, summary: parts.join(', '), artifactsDir };
}

/** True when a report carries no usable stats — callers should treat this as a failure. */
export function reportHasNoStats(report: MochaReport): boolean {
  return !report.stats || Object.keys(report.stats).length === 0;
}
```

- [ ] **Step 4: Refactor `cypress-runner.ts` to reuse it (keep its public names as aliases)**

In `cypress-runner.ts`: delete the local `CypressStats`/`CypressFailureRaw`/`CypressMochaReport`/`parseCypressJson`/`extractCypressFailures` definitions and replace with re-export aliases + internal use of the shared parser:

```ts
import { parseMochaJson, extractMochaFailures, reportHasNoStats, type MochaReport } from './mocha-json';
// back-compat aliases (SP2 imported these names from this module):
export { parseMochaJson as parseCypressJson, extractMochaFailures as extractCypressFailures } from './mocha-json';
export type { MochaReport as CypressMochaReport, MochaFailure as CypressFailure } from './mocha-json';
```
Update `CypressTestRunner.run()` to call `parseMochaJson(...)` and use `reportHasNoStats(...)` for its fail-closed branch (it should already fail closed from SP2 — keep that behavior, just sourced from the shared helper). Confirm `cypress-runner.test.ts` still passes unchanged.

- [ ] **Step 5: Update the runtime barrel**

```ts
// packages/core/src/runtime/index.ts — add:
export { parseMochaJson, extractMochaFailures, reportHasNoStats } from './mocha-json';
export type { MochaReport, MochaFailure } from './mocha-json';
```
(Keep the existing Cypress re-exports working.)

- [ ] **Step 6: Run tests**

Run: `cd packages/core && npx vitest run src/runtime`
Expected: PASS — new mocha-json tests + existing cypress-runner tests all green.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/runtime/mocha-json.ts packages/core/src/runtime/mocha-json.test.ts packages/core/src/runtime/cypress-runner.ts packages/core/src/runtime/index.ts
git commit -m "refactor(core): extract shared Mocha-JSON parser; cypress reuses it"
```

---

### Task 2: `SeleniumTestRunner`

**Files:**
- Create: `packages/core/src/runtime/selenium-runner.ts`
- Test: `packages/core/src/runtime/selenium-runner.test.ts`
- Modify: `packages/core/src/runtime/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/runtime/selenium-runner.test.ts
import { describe, it, expect } from 'vitest';
import { SeleniumTestRunner } from './selenium-runner';
import type { Exec } from './exec';

const fakeExec = (out: string): Exec => async () => ({ stdout: out, stderr: '', code: 0 });

describe('SeleniumTestRunner', () => {
  it('runs mocha with the json reporter writing to a file, and parses it', async () => {
    let calledArgs: string[] = [];
    const exec: Exec = async (_cmd, args) => {
      calledArgs = args;
      return { stdout: '', stderr: '', code: 0 };
    };
    const runner = new SeleniumTestRunner({
      cwd: '/ws',
      exec,
      readReport: async () => JSON.stringify({ stats: { tests: 2, passes: 2, failures: 0 } }),
    });
    const r = await runner.run('tests/selenium/cart.test.ts');
    expect(r.passed).toBe(2);
    expect(r.failed).toBe(0);
    expect(calledArgs).toContain('--reporter');
    expect(calledArgs.some((a) => a.startsWith('output='))).toBe(true);
    expect(calledArgs).toContain('tests/selenium/cart.test.ts');
  });

  it('fails closed when the report is missing (read throws)', async () => {
    const runner = new SeleniumTestRunner({
      cwd: '/ws',
      exec: fakeExec(''),
      readReport: async () => {
        throw new Error('ENOENT');
      },
    });
    const r = await runner.run('x.test.ts');
    expect(r.failed).toBeGreaterThan(0);
  });

  it('fails closed when the report has no stats', async () => {
    const runner = new SeleniumTestRunner({ cwd: '/ws', exec: fakeExec(''), readReport: async () => '{}' });
    const r = await runner.run('x.test.ts');
    expect(r.failed).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run src/runtime/selenium-runner.test.ts`
Expected: FAIL — cannot find module `./selenium-runner`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/core/src/runtime/selenium-runner.ts
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestRunner, TestRunResult } from '../tools/types';
import { defaultExec, type Exec } from './exec';
import { parseMochaJson, reportHasNoStats, type MochaReport } from './mocha-json';

export interface SeleniumTestRunnerOptions {
  cwd: string;
  exec?: Exec;
  artifactsDir?: string;
  readReport?: (path: string) => Promise<string>;
}

/** Runs `npx mocha <spec> --reporter json` (writing JSON to a file) and parses it. Fails closed. */
export class SeleniumTestRunner implements TestRunner {
  constructor(private readonly opts: SeleniumTestRunnerOptions) {}

  async run(specPath?: string): Promise<TestRunResult> {
    const exec = this.opts.exec ?? defaultExec;
    const readReport = this.opts.readReport ?? ((p: string) => readFile(p, 'utf8'));
    const artifactsDir = this.opts.artifactsDir ?? 'test-results';
    const reportPath = join(tmpdir(), 'vigilis-selenium-report.json');
    const failClosed: TestRunResult = {
      passed: 0,
      failed: 1,
      summary: 'mocha/selenium produced no parseable report (treated as failure)',
      artifactsDir,
    };

    const args = [
      'mocha',
      ...(specPath ? [specPath] : ['tests/selenium/**/*.test.ts']),
      '--reporter',
      'json',
      '--reporter-options',
      `output=${reportPath}`,
    ];
    await exec('npx', args, { cwd: this.opts.cwd });

    let report: MochaReport;
    try {
      report = JSON.parse(await readReport(reportPath)) as MochaReport;
    } catch {
      return failClosed;
    }
    if (reportHasNoStats(report)) return failClosed;
    return parseMochaJson(report, artifactsDir);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && npx vitest run src/runtime/selenium-runner.test.ts`
Expected: PASS (all 3).

- [ ] **Step 5: Export from the barrel**

```ts
// packages/core/src/runtime/index.ts — add:
export { SeleniumTestRunner } from './selenium-runner';
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/runtime/selenium-runner.ts packages/core/src/runtime/selenium-runner.test.ts packages/core/src/runtime/index.ts
git commit -m "feat(core): Selenium (mocha) test runner, fails closed on missing report"
```

---

### Task 3: `SeleniumAdapter`

**Files:**
- Create: `packages/core/src/framework/selenium-adapter.ts`
- Test: `packages/core/src/framework/selenium-adapter.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/framework/selenium-adapter.test.ts
import { describe, it, expect } from 'vitest';
import { SeleniumAdapter } from './selenium-adapter';

const a = new SeleniumAdapter();

describe('SeleniumAdapter', () => {
  it('is named selenium', () => {
    expect(a.name).toBe('selenium');
  });

  it('maps a URL to a .test.ts path under tests/selenium by default', () => {
    expect(a.specPathForUrl('https://shop.test/cart')).toBe('tests/selenium/cart.test.ts');
    expect(a.specPathForUrl('https://shop.test/')).toBe('tests/selenium/home.test.ts');
  });

  it('generate guidance names selenium-webdriver idioms (Builder, By.css, until)', () => {
    const g = a.generateGuidance();
    expect(g).toContain('selenium-webdriver');
    expect(g).toContain('By.css');
    expect(g).toContain('until');
    expect(g).toContain('data-testid');
    expect(g).not.toContain('@playwright/test');
  });

  it('heal guidance references the spec, the selector, and test_run', () => {
    const h = a.healGuidance('tests/selenium/cart.test.ts', '[data-testid="pay"]');
    expect(h).toContain('tests/selenium/cart.test.ts');
    expect(h).toContain('[data-testid="pay"]');
    expect(h).toContain('test_run');
  });

  it('creates a Selenium TestRunner', () => {
    expect(typeof a.createRunner({ cwd: '/ws' }).run).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run src/framework/selenium-adapter.test.ts`
Expected: FAIL — cannot find module `./selenium-adapter`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/core/src/framework/selenium-adapter.ts
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
  '- create the driver in a before() hook (new Builder().forBrowser(\'chrome\').build())',
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && npx vitest run src/framework/selenium-adapter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/framework/selenium-adapter.ts packages/core/src/framework/selenium-adapter.test.ts
git commit -m "feat(core): SeleniumAdapter (selenium-webdriver + Mocha idioms, runner)"
```

---

### Task 4: Register Selenium in `resolveAdapter`

**Files:**
- Modify: `packages/core/src/framework/resolve.ts`, `packages/core/src/framework/index.ts`, `packages/core/src/framework/resolve.test.ts`

- [ ] **Step 1: Update the resolve test (selenium now resolves)**

In `resolve.test.ts`, replace the "selenium still throws" case with:
```ts
  it('returns the SeleniumAdapter for an explicit selenium override', async () => {
    const a = await resolveAdapter(process.cwd(), 'selenium');
    expect(a.name).toBe('selenium');
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd packages/core && npx vitest run src/framework/resolve.test.ts`
Expected: FAIL — selenium currently throws "not yet implemented".

- [ ] **Step 3: Register the adapter**

```ts
// packages/core/src/framework/resolve.ts
import { SeleniumAdapter } from './selenium-adapter';
// ...
const ADAPTERS: Partial<Record<Framework, () => FrameworkAdapter>> = {
  playwright: () => new PlaywrightAdapter(),
  cypress: () => new CypressAdapter(),
  selenium: () => new SeleniumAdapter(),
};
```

```ts
// packages/core/src/framework/index.ts — add:
export { SeleniumAdapter } from './selenium-adapter';
```

Since all three frameworks are now built, the `ADAPTERS` map is complete — but KEEP the `if (!make)` guard in `resolveAdapter` (it's still correct defensive code if a future `Framework` value is added).

- [ ] **Step 4: Run it to verify it passes**

Run: `cd packages/core && npx vitest run src/framework/resolve.test.ts`
Expected: PASS — all three frameworks resolve.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/framework/resolve.ts packages/core/src/framework/index.ts packages/core/src/framework/resolve.test.ts
git commit -m "feat(core): register SeleniumAdapter — all three frameworks resolve"
```

---

### Task 5: Selenium fixture for manual end-to-end acceptance

**Files:**
- Create: `apps/sample-shop/.mocharc.json`
- Create: `apps/sample-shop/tests/selenium/.gitkeep`
- Modify: `apps/sample-shop/package.json`

- [ ] **Step 1: Mocha config with a TS loader**

```json
// apps/sample-shop/.mocharc.json
{
  "extension": ["ts"],
  "spec": "tests/selenium/**/*.test.ts",
  "require": "tsx",
  "timeout": 30000
}
```

- [ ] **Step 2: Add deps + script (do NOT install in CI)**

In `apps/sample-shop/package.json`, add to `devDependencies`: `"selenium-webdriver": "^4"`, `"mocha": "^10"`, `"tsx": "^4"`, and to `scripts`: `"selenium:run": "mocha --reporter json"`. Add `tests/selenium/.gitkeep`.

- [ ] **Step 3: Document manual acceptance in the commit body**

```
Manual acceptance (needs ANTHROPIC_API_KEY + chrome + chromedriver + `pnpm --filter sample-shop install`):
  1. pnpm --filter sample-shop dev        # app on :3000
  2. node packages/cli/dist/index.js generate http://localhost:3000 --framework selenium --run
     → writes apps/sample-shop/tests/selenium/home.test.ts and runs it green
  3. break a data-testid, then vigilis heal http://localhost:3000 --framework selenium --spec <file>
     → triage=dom-drift, By.css locator rewritten, verified green
```

- [ ] **Step 4: Commit**

```bash
git add apps/sample-shop/.mocharc.json apps/sample-shop/tests/selenium/.gitkeep apps/sample-shop/package.json
git commit -m "test(sample-shop): minimal Selenium (mocha+webdriver) fixture for manual e2e"
```

---

### Task 6: Full verification

**Files:** none (verification).

- [ ] **Step 1: Build + test everything**

Run: `cd /Users/piyushpathak/Work/argus && pnpm -r build && pnpm -r test`
Expected: all packages build; all tests pass (core gains mocha-json + selenium-runner + selenium-adapter + updated resolve tests; cli 6; mcp 2).

- [ ] **Step 2: Boundary intact**

Run: `grep -rn "framework\|-runner\|mocha-json" packages/core/src/agent || echo "clean — attestation core untouched"`
Expected: `clean`.

- [ ] **Step 3: Playwright + Cypress unchanged**

Run: `cd packages/core && npx vitest run src/framework/playwright-adapter.test.ts src/framework/cypress-adapter.test.ts src/runtime/cypress-runner.test.ts src/behaviors`
Expected: PASS — SP3 added Selenium without touching the other paths.

- [ ] **Step 4: All three resolve; honesty check**

Run: `grep -n "playwright\|cypress\|selenium" packages/core/src/framework/resolve.ts` (all three registered) and `grep -rin "selenium\|cypress" apps/web/src 2>/dev/null || echo "no site claims yet (SP4 flips copy)"`.
Expected: three adapters registered; no site claims yet.

---

## Self-Review

**Spec coverage:** design-doc SP3 items — Selenium runner via Mocha + JSON parsing (Tasks 1-2), `SeleniumAdapter` with selenium-webdriver idioms + heal guidance (Task 3), registration so `--framework selenium` works and all three resolve (Task 4), sample-shop fixture (Task 5), verification incl. boundary + other-frameworks-unchanged + honesty (Task 6). Covered. The shared Mocha-JSON extraction (Task 1) also retires the Cypress/Selenium parser duplication before it's created.

**Placeholder scan:** none — all modules have complete code + tests; the fixture is an explicit manual artifact with documented steps.

**Type consistency:** `SeleniumTestRunner`/`SeleniumAdapter` implement the existing `TestRunner`/`FrameworkAdapter` interfaces unchanged. `parseMochaJson(report, artifactsDir)` matches the `parseCypressJson` signature it replaces. `Exec` imported from `runtime/exec`. Fail-closed sentinel mirrors the Cypress runner's (SP2). `ADAPTERS` keyed by `Framework`; all three keys now present.

**Risk:** running TS Mocha specs needs a loader (`tsx` via `.mocharc.json`) and Selenium needs chrome + chromedriver — surfaced only in the manual fixture, not core tests (which inject `exec`/`readReport`). Mocha's built-in `json` reporter supports `--reporter-options output=<file>`; if a Mocha version rejects it, the fixture's `.mocharc.json` can set `reporterOptions` instead (note for manual acceptance).

---

## Execution Handoff

Plan saved to `docs/superpowers/plans/2026-06-23-sp3-selenium-adapter.md`. Continuing **subagent-driven** (same as SP1/SP2). After SP3, SP4 flips the site/README/CLI copy to the now-true "Playwright, Cypress & Selenium" and wires the `framework` config field — and is gated on the documented Cypress/Selenium manual acceptance passing.

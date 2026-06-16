# Generate Behavior Implementation Plan (TRE-33)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Generate behavior — `generate()` drives `runAgentLoop` to write a runnable Playwright spec to a deterministic path — plus a `playwright.config.ts` and a real `argus generate <url> [--run]`.

**Architecture:** `generate()` computes a deterministic spec path from the URL, runs the loop with a spec-writing system prompt, and captures `fs_write` paths via a composed observer. A minimal `playwright.config.ts` makes specs runnable; the CLI optionally runs the new spec via `PlaywrightTestRunner`.

**Tech Stack:** TypeScript ESM strict, `@argus/core` (loop/registry/runtime), `@playwright/test@^1.60.0` (runner), Vitest, commander.

**Spec:** `docs/superpowers/specs/2026-06-12-generate-behavior-design.md`.

**Conventions:** extensionless relative imports; `import type` for type-only; run from repo root; scoped tests via `pnpm --filter @argus/core test <path>`.

---

### Task 1: `specPathForUrl` (pure) + behaviors scaffold

**Files:**
- Create: `packages/core/src/behaviors/generate.ts` (path helper this task)
- Test: `packages/core/src/behaviors/generate.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { specPathForUrl } from './generate';

describe('specPathForUrl', () => {
  it('maps the root path to home', () => {
    expect(specPathForUrl('http://localhost:3100/')).toBe('tests/generated/home.spec.ts');
  });
  it('maps a single segment to its slug', () => {
    expect(specPathForUrl('http://localhost:3100/login')).toBe('tests/generated/login.spec.ts');
  });
  it('joins nested segments with a dash and lowercases', () => {
    expect(specPathForUrl('http://localhost:3100/Products/42')).toBe(
      'tests/generated/products-42.spec.ts',
    );
  });
  it('honours a custom outDir', () => {
    expect(specPathForUrl('http://x/login', 'tests/e2e')).toBe('tests/e2e/login.spec.ts');
  });
  it('falls back to home for an empty/garbage path', () => {
    expect(specPathForUrl('http://x')).toBe('tests/generated/home.spec.ts');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @argus/core test src/behaviors/generate.test.ts`
Expected: FAIL — cannot find module `./generate`.

- [ ] **Step 3: Write `specPathForUrl` in `generate.ts`**

```ts
/** Map a URL to a deterministic spec path under `outDir`. */
export function specPathForUrl(url: string, outDir = 'tests/generated'): string {
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @argus/core test src/behaviors/generate.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/behaviors/generate.ts packages/core/src/behaviors/generate.test.ts
git commit -m "TRE-33: specPathForUrl (deterministic spec path)"
```

---

### Task 2: `generate()` behavior

**Files:**
- Modify: `packages/core/src/behaviors/generate.ts` (append the behavior)
- Modify: `packages/core/src/behaviors/generate.test.ts` (append a behavior test)

- [ ] **Step 1: Write the failing test (append)**

```ts
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generate } from './generate';
import { createDefaultRegistry } from '../tools/definitions';
import { FakeAnthropicClient, makeFakeCtx, makeMessage } from '../tools/testing/fakes';

describe('generate', () => {
  it('writes the spec to the deterministic path and reports it', async () => {
    const root = await mkdtemp(join(tmpdir(), 'argus-gen-'));
    try {
      const SPEC = "import { test, expect } from '@playwright/test';\ntest('x', async () => {});\n";
      const client = new FakeAnthropicClient([
        makeMessage([{ type: 'tool_use', id: 'tu_1', name: 'browser_snapshot', input: {} }], 'tool_use'),
        makeMessage(
          [
            {
              type: 'tool_use',
              id: 'tu_2',
              name: 'fs_write',
              input: { path: 'tests/generated/login.spec.ts', content: SPEC },
            },
          ],
          'tool_use',
        ),
        makeMessage([{ type: 'text', text: 'Wrote the login test.' }], 'end_turn'),
      ]);

      const result = await generate({
        client,
        url: 'http://localhost:3100/login',
        registry: createDefaultRegistry(),
        ctx: makeFakeCtx({ workspaceRoot: root }),
      });

      expect(result.specPath).toBe('tests/generated/login.spec.ts');
      expect(result.writtenFiles).toContain('tests/generated/login.spec.ts');
      expect(result.run.stopReason).toBe('end_turn');
      expect(await readFile(join(root, 'tests/generated/login.spec.ts'), 'utf8')).toBe(SPEC);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @argus/core test src/behaviors/generate.test.ts`
Expected: FAIL — `generate` is not exported.

- [ ] **Step 3: Append the behavior to `generate.ts`**

```ts
import { resolveModel } from '../index';
import { runAgentLoop, type AgentRunResult } from '../agent/loop';
import type { AnthropicLike } from '../agent/client';
import type { AgentObserver } from '../agent/observer';
import type { ToolRegistry } from '../tools/registry';
import type { ToolContext } from '../tools/types';

export interface GenerateOptions {
  client: AnthropicLike;
  url: string;
  registry: ToolRegistry;
  ctx: ToolContext;
  model?: string;
  outDir?: string;
  maxSteps?: number;
  observer?: AgentObserver;
}

export interface GenerateResult {
  specPath: string;
  writtenFiles: string[];
  run: AgentRunResult;
}

const GENERATE_SYSTEM = [
  'You are Argus, a senior SDET. Your job is to write ONE runnable Playwright end-to-end test',
  'for the web app at the given URL.',
  '',
  'Process:',
  '1. Navigate to the URL and explore with browser_snapshot and dom_testids.',
  '2. If the app requires login, find the credentials shown on the page and log in.',
  '3. Exercise the primary user flow (e.g. log in, then add an item to the cart).',
  '4. Write exactly one spec file to the EXACT path you are given, using fs_write.',
  '',
  'The spec MUST:',
  "- import { test, expect } from '@playwright/test';",
  '- use getByTestId(...) or [data-testid=\"...\"] locators (never brittle text/CSS);',
  '- include meaningful expect(...) assertions;',
  '- be self-contained and runnable with no manual edits (baseURL is preconfigured,',
  "  so use page.goto('/...') relative paths).",
  '',
  'Keep exploration focused to limit cost. After writing the file, briefly report what you wrote.',
].join('\n');

const OPUS_TIER = /opus|sonnet-4-6|fable/;

export async function generate(opts: GenerateOptions): Promise<GenerateResult> {
  const { client, url, registry, ctx, model = resolveModel('primary'), outDir, maxSteps = 20, observer } = opts;
  const specPath = specPathForUrl(url, outDir);
  const writtenFiles: string[] = [];

  const composed: AgentObserver = {
    ...observer,
    onToolResult: (e) => {
      observer?.onToolResult?.(e);
      if (e.name === 'fs_write' && !e.result.isError) {
        const p = e.result.meta?.path;
        if (typeof p === 'string') writtenFiles.push(p);
      }
    },
  };

  const run = await runAgentLoop({
    client,
    system: GENERATE_SYSTEM,
    prompt: `Generate a Playwright test for the app at ${url}. Write the spec to exactly: ${specPath}`,
    registry,
    ctx,
    model,
    thinking: OPUS_TIER.test(model),
    maxSteps,
    observer: composed,
  });

  return { specPath, writtenFiles, run };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @argus/core test src/behaviors/generate.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/behaviors/generate.ts packages/core/src/behaviors/generate.test.ts
git commit -m "TRE-33: generate() behavior — loop writes a spec, captures fs_write paths"
```

---

### Task 3: behaviors barrel + package exports

**Files:**
- Create: `packages/core/src/behaviors/index.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/behaviors/exports.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import * as core from '../index';

describe('@argus/core behavior exports', () => {
  it('exposes generate + specPathForUrl', () => {
    expect('generate' in core).toBe(true);
    expect('specPathForUrl' in core).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @argus/core test src/behaviors/exports.test.ts`
Expected: FAIL — names not in `core`.

- [ ] **Step 3: Write `behaviors/index.ts`**

```ts
export { generate, specPathForUrl } from './generate';
export type { GenerateOptions, GenerateResult } from './generate';
```

- [ ] **Step 4: Append to `packages/core/src/index.ts`**

```ts
export * from './behaviors/index';
```

- [ ] **Step 5: Run test + typecheck + full core suite**

Run: `pnpm --filter @argus/core test src/behaviors/exports.test.ts && pnpm --filter @argus/core typecheck && pnpm --filter @argus/core test`
Expected: exports test PASS; typecheck clean; all suites pass.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/behaviors/index.ts packages/core/src/index.ts packages/core/src/behaviors/exports.test.ts
git commit -m "TRE-33: behaviors barrel + package exports"
```

---

### Task 4: `playwright.config.ts` + `@playwright/test`

**Files:**
- Create: `playwright.config.ts` (repo root)
- Modify: `package.json` (root devDependencies)

- [ ] **Step 1: Add `@playwright/test` to root devDependencies**

Edit root `package.json` `devDependencies` to add (keep alphabetical-ish near other deps):

```json
    "@playwright/test": "^1.60.0",
```

- [ ] **Step 2: Install**

Run: `pnpm install`
Expected: `@playwright/test@1.60.x` linked at the root.

- [ ] **Step 3: Write `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  use: { baseURL: 'http://localhost:3100' },
  webServer: {
    command: 'pnpm --filter @argus/sample-shop dev',
    url: 'http://localhost:3100',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
```

- [ ] **Step 4: Verify it loads + lint/typecheck still pass**

Run: `node -e "import('@playwright/test').then(()=>console.log('pw ok'))" && pnpm lint && pnpm typecheck`
Expected: `pw ok`; lint + typecheck clean. (The config is plain TS at the repo root; eslint already ignores `dist`/`.next` and lints `.ts` — if eslint flags the config for an unused import or env, fix inline.)

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml playwright.config.ts
git commit -m "TRE-33: add @playwright/test + playwright.config.ts (baseURL :3100)"
```

---

### Task 5: real `argus generate` command

**Files:** Modify `packages/cli/src/index.ts`

- [ ] **Step 1: Add `generate` to the core import block**

Update the existing import from `@argus/core` to add `generate`:

```ts
import {
  ConsoleObserver,
  createAnthropicClient,
  createDefaultRegistry,
  createPlaywrightSession,
  generate,
  PlaywrightTestRunner,
  resolveModel,
  runAgentLoop,
} from '@argus/core';
```

- [ ] **Step 2: Replace the placeholder `generate` command**

Replace the existing `program.command('generate')…` block with:

```ts
program
  .command('generate')
  .argument('<url>', 'URL of the app under test')
  .option('--model <id>', 'model id (default: primary/Opus)')
  .option('--run', 'run the generated spec after writing it')
  .option('--out <dir>', 'output directory for the spec', 'tests/generated')
  .option('--max-steps <n>', 'max agent steps', '20')
  .description('Explore the app and write a runnable Playwright spec (needs ANTHROPIC_API_KEY + chromium)')
  .action(
    async (
      url: string,
      opts: { model?: string; run?: boolean; out: string; maxSteps: string },
    ) => {
      const model = opts.model ?? resolveModel('primary');
      const { session, close } = await createPlaywrightSession({ headless: true });
      const runner = new PlaywrightTestRunner({ cwd: process.cwd() });
      try {
        const result = await generate({
          client: createAnthropicClient(),
          url,
          registry: createDefaultRegistry(),
          ctx: { workspaceRoot: process.cwd(), browser: session, runner },
          model,
          outDir: opts.out,
          maxSteps: Number(opts.maxSteps),
          observer: new ConsoleObserver(),
        });

        console.log(
          '\n[vigilis] wrote: ' + (result.writtenFiles.join(', ') || '(no file written)'),
        );
        const price = PRICES[model];
        const cost = price
          ? `$${((result.run.usage.inputTokens / 1e6) * price.in + (result.run.usage.outputTokens / 1e6) * price.out).toFixed(4)}`
          : 'n/a';
        console.log(
          `[vigilis] ${result.run.steps} steps · ${result.run.usage.inputTokens} in / ${result.run.usage.outputTokens} out · ~${cost} (${model})`,
        );

        if (opts.run && result.writtenFiles.includes(result.specPath)) {
          console.log(`\n[vigilis] running ${result.specPath} …`);
          const tr = await runner.run(result.specPath);
          console.log(`[vigilis] ${tr.summary} (artifacts: ${tr.artifactsDir})`);
          if (tr.failed > 0) process.exitCode = 1;
        } else if (opts.run) {
          console.log('[vigilis] --run skipped: no spec file was written');
        }
      } finally {
        await close();
      }
    },
  );
```

- [ ] **Step 3: Build core + cli and verify the command surface**

Run: `pnpm --filter @argus/core build && pnpm --filter @argus/cli build && node packages/cli/dist/index.js generate --help`
Expected: prints the `generate` usage with `--model`, `--run`, `--out`, `--max-steps`.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/index.ts
git commit -m "TRE-33: real argus generate <url> [--run]"
```

---

### Task 6: Full verification + docs

**Files:** Modify `docs/ROADMAP.md`, `docs/STATUS.md`, `README.md`

- [ ] **Step 1: Full canonical suite**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: all green.

- [ ] **Step 2: Confirm the built export**

Run:
```bash
node --input-type=module -e "
import * as core from './packages/core/dist/index.js';
console.log(['generate','specPathForUrl'].map(k=>k+'='+(k in core)).join(' '));
"
```
Expected: both `=true`.

- [ ] **Step 3: ROADMAP — mark TRE-33 done, TRE-34 next**

```markdown
| `TRE-33` | Generate behavior: explore app → emit runnable Playwright specs | ✅ |
| `TRE-34` | Prompt & context engineering for Generate (system prompt + DOM snapshot) | 🔜 **next** |
```

- [ ] **Step 4: STATUS — next ticket `TRE-34`; add a "Done: TRE-33" section**

- "Continue right now" → next is `TRE-34` (refine the Generate system prompt + DOM context).
- `@argus/core` row: add the Generate behavior.
- New "Done: `TRE-33`" subsection: `generate()` + `specPathForUrl`, `playwright.config.ts`, `argus generate <url> [--run]`; note default Opus, deterministic path, fake-client+temp-fs test.
- Update the smoke/E2E note to mention `argus generate http://localhost:3100 --run`.

- [ ] **Step 5: README — under "Watch the agent run", add the generate example**

Add after the smoke block:
```markdown
Or have it **write a test** and run it:

\`\`\`bash
node --env-file=.env packages/cli/dist/index.js generate http://localhost:3100/login --run
\`\`\`

It writes `tests/generated/login.spec.ts` and runs it green against sample-shop.
```

- [ ] **Step 6: Commit**

```bash
git add docs/ROADMAP.md docs/STATUS.md README.md
git commit -m "M1: Generate behavior complete (TRE-33); docs point to TRE-34"
```

---

## Self-Review notes (author)

- **Spec coverage:** specPathForUrl (T1) · generate() incl. fs_write capture + thinking gate (T2) · exports (T3) · playwright.config + @playwright/test (T4) · CLI generate + --run (T5) · verify + docs (T6). All §9 spec tests represented (path helper cases + behavior fake-client/temp-fs).
- **Type consistency:** `GenerateOptions`/`GenerateResult` defined in T2 and exported in T3; `generate`/`specPathForUrl` imported by the CLI (T5); reuses `runAgentLoop`/`AgentObserver`/`AnthropicLike`/`ToolRegistry`/`ToolContext` (TRE-31/32) and the `PRICES` map already in the CLI (added with `smoke`). `result.run.usage` matches `AgentRunResult.usage` (`inputTokens`/`outputTokens`).
- **Soft spots:** the `composed` observer spreads `observer` then overrides `onToolResult` — if the caller also set `onToolResult` it is still called inside the override (explicit `observer?.onToolResult?.(e)`), so no event is dropped. `fs_write` `meta.path` is the relative path passed in (TRE-31), which equals `specPath`, so `writtenFiles.includes(result.specPath)` holds.
- **Deferred (not here):** prompt/context engineering (TRE-34), other behaviors (M3), CI wiring (TRE-36).

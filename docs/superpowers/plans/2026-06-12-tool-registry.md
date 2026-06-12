# Tool Registry Implementation Plan (TRE-31)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the single QA Tool Registry in `@argus/core` — Zod-backed tool definitions with real handlers over an injected `ToolContext`, plus Anthropic and MCP adapters.

**Architecture:** Each tool is a `ToolDefinition` (name, description, Zod object schema, handler). Handlers depend only on an injected `ToolContext` (`workspaceRoot`, a `BrowserSession`, a `TestRunner`), so they're real and unit-testable with fakes; the real Playwright-backed context is injected later in TRE-32. A `ToolRegistry` validates input, runs handlers (never throwing), and adapts the tool set to the Anthropic Messages API (`toAnthropic`) and MCP (`toMcp`).

**Tech Stack:** TypeScript (ESM, strict), Zod v4 (native `z.toJSONSchema`), Vitest, tsup. Workspace: pnpm. Build/typecheck/test/lint from repo root.

**Spec:** `docs/superpowers/specs/2026-06-12-tool-registry-design.md`.

**Conventions for every step:**
- Relative imports are extensionless (the package uses `moduleResolution: Bundler`).
- `verbatimModuleSyntax` is on: import types with `import type`, re-export types with `export type`.
- Run commands from the repo root `/Users/piyushpathak/Work/argus`.
- Per-task scoped test command: `pnpm --filter @argus/core test <path>`.

---

### Task 1: Add the Zod dependency

**Files:**
- Modify: `packages/core/package.json`

- [ ] **Step 1: Add `zod` to dependencies**

Edit `packages/core/package.json` so the `dependencies` block reads:

```json
  "dependencies": {
    "@anthropic-ai/sdk": "^0.32.1",
    "zod": "^4.4.3"
  }
```

- [ ] **Step 2: Install**

Run: `pnpm install`
Expected: completes; `zod@4.x` linked into `@argus/core`.

- [ ] **Step 3: Verify zod resolves for the package**

Run: `pnpm --filter @argus/core exec node -e "import('zod').then(m=>console.log('zod ok', typeof m.z.toJSONSchema))"`
Expected: prints `zod ok function`.

- [ ] **Step 4: Commit**

```bash
git add packages/core/package.json pnpm-lock.yaml
git commit -m "TRE-31: add zod dependency to @argus/core"
```

---

### Task 2: Core types and `ToolError`

Pure type/interface definitions plus one tiny error class and a `defineTool` helper for inference. No unit test (interfaces have no runtime behavior); verified by `pnpm typecheck` and exercised by every later task.

**Files:**
- Create: `packages/core/src/tools/types.ts`

- [ ] **Step 1: Write `types.ts`**

```ts
import type { z } from 'zod';

/** Thrown by tool handlers for a clean, user-facing error message. */
export class ToolError extends Error {
  override name = 'ToolError';
}

/** Runtime dependencies a tool handler may use. Injected by the caller. */
export interface ToolContext {
  /** Absolute directory that all fs_* tools are sandboxed to. */
  workspaceRoot: string;
  /** Live page/browser. Real impl injected by the agent loop (TRE-32); faked in tests. */
  browser: BrowserSession;
  /** Runs Playwright specs. Real impl injected by TRE-32; faked in tests. */
  runner: TestRunner;
}

/** Matched element returned by a DOM query. */
export interface DomMatch {
  tag: string;
  text: string;
  attributes: Record<string, string>;
}

/** The single seam for all browser + DOM tools. */
export interface BrowserSession {
  navigate(url: string): Promise<void>;
  click(selector: string): Promise<void>;
  type(selector: string, text: string): Promise<void>;
  /** Trimmed HTML / a11y summary of the current page, for the agent to "see" it. */
  snapshot(): Promise<string>;
  /** Matched elements for a selector. */
  query(selector: string): Promise<DomMatch[]>;
  /** All data-testid values currently present on the page. */
  testids(): Promise<string[]>;
  /** Current page URL. */
  url(): string;
}

/** Result of running Playwright specs. */
export interface TestRunResult {
  passed: number;
  failed: number;
  summary: string;
  /** Directory holding traces/screenshots/logs (fuel for Triage). */
  artifactsDir: string;
}

/** Runs Playwright specs and reports results + artifact location. */
export interface TestRunner {
  run(specPath?: string): Promise<TestRunResult>;
}

/** What a tool returns. Never throws out of the registry — errors come back here. */
export interface ToolResult {
  content: string;
  meta?: Record<string, unknown>;
  isError?: boolean;
}

/** A Zod object schema for a tool's input. */
export type ToolInputSchema = z.ZodObject<z.ZodRawShape>;

/** A single tool: identity, input schema, and a handler over the context. */
export interface ToolDefinition<S extends ToolInputSchema = ToolInputSchema> {
  name: string;
  description: string;
  input: S;
  handler: (input: z.infer<S>, ctx: ToolContext) => Promise<ToolResult>;
}

/** Identity helper that preserves input-type inference in the handler. */
export function defineTool<S extends ToolInputSchema>(def: ToolDefinition<S>): ToolDefinition {
  return def as unknown as ToolDefinition;
}

/** Anthropic Messages API tool param shape (structural — no SDK import). */
export interface AnthropicToolParam {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
    [k: string]: unknown;
  };
}

/** MCP tool registration payload (Zod raw shape; the MCP server consumes it in TRE-42). */
export interface McpToolParam {
  name: string;
  description: string;
  inputSchema: z.ZodRawShape;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @argus/core typecheck`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/tools/types.ts
git commit -m "TRE-31: add tool registry core types"
```

---

### Task 3: `ToolRegistry` — register/get/list/execute

**Files:**
- Create: `packages/core/src/tools/registry.ts`
- Test: `packages/core/src/tools/registry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { ToolRegistry } from './registry';
import { defineTool, ToolError, type ToolContext } from './types';

const ctx = {} as ToolContext;

const echo = defineTool({
  name: 'echo',
  description: 'Echo a message',
  input: z.object({ msg: z.string() }),
  handler: async ({ msg }) => ({ content: `echo: ${msg}` }),
});

const boom = defineTool({
  name: 'boom',
  description: 'Always throws',
  input: z.object({}),
  handler: async () => {
    throw new ToolError('kaboom');
  },
});

describe('ToolRegistry', () => {
  it('registers, lists, and gets tools', () => {
    const r = new ToolRegistry();
    r.register(echo);
    expect(r.list().map((t) => t.name)).toEqual(['echo']);
    expect(r.get('echo')?.description).toBe('Echo a message');
    expect(r.get('nope')).toBeUndefined();
  });

  it('rejects duplicate names', () => {
    const r = new ToolRegistry();
    r.register(echo);
    expect(() => r.register(echo)).toThrow(/already registered/i);
  });

  it('executes a tool with valid input', async () => {
    const r = new ToolRegistry();
    r.register(echo);
    expect(await r.execute('echo', { msg: 'hi' }, ctx)).toEqual({ content: 'echo: hi' });
  });

  it('returns isError for an unknown tool', async () => {
    const r = new ToolRegistry();
    const res = await r.execute('ghost', {}, ctx);
    expect(res.isError).toBe(true);
    expect(res.content).toMatch(/unknown tool: ghost/i);
  });

  it('returns isError for invalid input instead of throwing', async () => {
    const r = new ToolRegistry();
    r.register(echo);
    const res = await r.execute('echo', { msg: 123 }, ctx);
    expect(res.isError).toBe(true);
    expect(res.content).toMatch(/invalid input for echo/i);
  });

  it('defaults nullish input to {} before validating', async () => {
    const r = new ToolRegistry();
    r.register(boom);
    const res = await r.execute('boom', undefined, ctx);
    expect(res.isError).toBe(true);
    expect(res.content).toBe('kaboom');
  });

  it('catches a throwing handler and reports it as isError', async () => {
    const r = new ToolRegistry();
    r.register(boom);
    const res = await r.execute('boom', {}, ctx);
    expect(res).toEqual({ content: 'kaboom', isError: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @argus/core test src/tools/registry.test.ts`
Expected: FAIL — cannot find module `./registry`.

- [ ] **Step 3: Write minimal implementation**

```ts
import type {
  AnthropicToolParam,
  McpToolParam,
  ToolContext,
  ToolDefinition,
  ToolResult,
} from './types';

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  register(def: ToolDefinition): void {
    if (this.tools.has(def.name)) {
      throw new Error(`Tool "${def.name}" is already registered`);
    }
    this.tools.set(def.name, def);
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  async execute(name: string, rawInput: unknown, ctx: ToolContext): Promise<ToolResult> {
    const def = this.tools.get(name);
    if (!def) {
      return { content: `Unknown tool: ${name}`, isError: true };
    }
    const parsed = def.input.safeParse(rawInput ?? {});
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ');
      return { content: `Invalid input for ${name}: ${detail}`, isError: true };
    }
    try {
      return await def.handler(parsed.data, ctx);
    } catch (err) {
      return { content: err instanceof Error ? err.message : String(err), isError: true };
    }
  }

  // Adapters land in Task 4.
  toAnthropic(): AnthropicToolParam[] {
    throw new Error('not implemented');
  }

  toMcp(): McpToolParam[] {
    throw new Error('not implemented');
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @argus/core test src/tools/registry.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/tools/registry.ts packages/core/src/tools/registry.test.ts
git commit -m "TRE-31: ToolRegistry register/get/list/execute"
```

---

### Task 4: Adapters — `toAnthropic` and `toMcp`

**Files:**
- Modify: `packages/core/src/tools/registry.ts`
- Test: `packages/core/src/tools/adapters.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { ToolRegistry } from './registry';
import { defineTool } from './types';

const tool = defineTool({
  name: 'nav',
  description: 'Navigate',
  input: z.object({ url: z.string().describe('target URL'), wait: z.number().optional() }),
  handler: async () => ({ content: 'ok' }),
});

describe('registry adapters', () => {
  it('toAnthropic emits {name, description, input_schema} without $schema', () => {
    const r = new ToolRegistry();
    r.register(tool);
    const [t] = r.toAnthropic();
    expect(t.name).toBe('nav');
    expect(t.description).toBe('Navigate');
    expect(t.input_schema.type).toBe('object');
    expect(Object.keys(t.input_schema.properties ?? {})).toEqual(['url', 'wait']);
    expect(t.input_schema.required).toEqual(['url']);
    expect('$schema' in t.input_schema).toBe(false);
  });

  it('toMcp exposes the Zod raw shape', () => {
    const r = new ToolRegistry();
    r.register(tool);
    const [t] = r.toMcp();
    expect(t.name).toBe('nav');
    expect(Object.keys(t.inputSchema)).toEqual(['url', 'wait']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @argus/core test src/tools/adapters.test.ts`
Expected: FAIL — `toAnthropic` throws `not implemented`.

- [ ] **Step 3: Replace the two adapter stubs with real implementations**

At the top of `registry.ts`, add the zod import:

```ts
import { z } from 'zod';
```

Replace the `toAnthropic` and `toMcp` stub methods with:

```ts
  toAnthropic(): AnthropicToolParam[] {
    return this.list().map((def) => {
      const schema = z.toJSONSchema(def.input) as Record<string, unknown>;
      delete schema.$schema;
      return {
        name: def.name,
        description: def.description,
        input_schema: schema as AnthropicToolParam['input_schema'],
      };
    });
  }

  toMcp(): McpToolParam[] {
    return this.list().map((def) => ({
      name: def.name,
      description: def.description,
      inputSchema: def.input.shape,
    }));
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @argus/core test src/tools/adapters.test.ts`
Expected: PASS (2 tests). Also re-run `src/tools/registry.test.ts` — still PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/tools/registry.ts packages/core/src/tools/adapters.test.ts
git commit -m "TRE-31: toAnthropic + toMcp registry adapters"
```

---

### Task 5: fs tools — `fs_read`, `fs_write`, `fs_list` (sandboxed)

**Files:**
- Create: `packages/core/src/tools/definitions/fs.ts`
- Test: `packages/core/src/tools/definitions/fs.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fsRead, fsWrite, fsList } from './fs';
import type { ToolContext } from '../types';

let root: string;
const ctx = (): ToolContext => ({ workspaceRoot: root }) as ToolContext;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'argus-fs-'));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('fs tools', () => {
  it('fs_write creates parent dirs and fs_read returns the content', async () => {
    const w = await fsWrite.handler({ path: 'tests/a.spec.ts', content: 'hello' }, ctx());
    expect(w.isError).toBeUndefined();
    expect(w.meta?.bytes).toBe(5);
    const r = await fsRead.handler({ path: 'tests/a.spec.ts' }, ctx());
    expect(r.content).toBe('hello');
  });

  it('fs_list lists entries, marking directories with a trailing slash', async () => {
    await mkdir(join(root, 'sub'));
    await writeFile(join(root, 'top.txt'), 'x');
    const res = await fsList.handler({}, ctx());
    expect(res.content.split('\n').sort()).toEqual(['sub/', 'top.txt']);
  });

  it('rejects path traversal outside the workspace', async () => {
    await expect(fsRead.handler({ path: '../escape.txt' }, ctx())).rejects.toThrow(
      /escapes the workspace/i,
    );
    await expect(
      fsWrite.handler({ path: '/etc/passwd', content: 'x' }, ctx()),
    ).rejects.toThrow(/escapes the workspace/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @argus/core test src/tools/definitions/fs.test.ts`
Expected: FAIL — cannot find module `./fs`.

- [ ] **Step 3: Write the implementation**

```ts
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { z } from 'zod';
import { defineTool, ToolError } from '../types';

/** Resolve `p` under `root`, rejecting anything that escapes the workspace. */
function resolveInWorkspace(root: string, p: string): string {
  const abs = resolve(root, p);
  const rel = relative(root, abs);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new ToolError(`Path escapes the workspace: ${p}`);
  }
  return abs;
}

export const fsRead = defineTool({
  name: 'fs_read',
  description: 'Read a UTF-8 text file within the workspace.',
  input: z.object({ path: z.string().describe('Path relative to the workspace root') }),
  handler: async ({ path }, ctx) => {
    const abs = resolveInWorkspace(ctx.workspaceRoot, path);
    const content = await readFile(abs, 'utf8');
    return { content, meta: { path, bytes: Buffer.byteLength(content) } };
  },
});

export const fsWrite = defineTool({
  name: 'fs_write',
  description: 'Write a UTF-8 text file within the workspace, creating parent directories.',
  input: z.object({
    path: z.string().describe('Path relative to the workspace root'),
    content: z.string().describe('File contents'),
  }),
  handler: async ({ path, content }, ctx) => {
    const abs = resolveInWorkspace(ctx.workspaceRoot, path);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, content, 'utf8');
    const bytes = Buffer.byteLength(content);
    return { content: `Wrote ${bytes} bytes to ${path}`, meta: { path, bytes } };
  },
});

export const fsList = defineTool({
  name: 'fs_list',
  description: 'List entries in a workspace directory (directories end with "/").',
  input: z.object({
    dir: z.string().optional().describe('Directory relative to the workspace root (default ".")'),
  }),
  handler: async ({ dir }, ctx) => {
    const abs = resolveInWorkspace(ctx.workspaceRoot, dir ?? '.');
    const entries = await readdir(abs, { withFileTypes: true });
    const names = entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
    return { content: names.join('\n'), meta: { dir: dir ?? '.', count: names.length } };
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @argus/core test src/tools/definitions/fs.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/tools/definitions/fs.ts packages/core/src/tools/definitions/fs.test.ts
git commit -m "TRE-31: fs tools with workspace sandboxing"
```

---

### Task 6: Test fakes + browser/dom tools

**Files:**
- Create: `packages/core/src/tools/testing/fakes.ts`
- Create: `packages/core/src/tools/definitions/browser.ts`
- Create: `packages/core/src/tools/definitions/dom.ts`
- Test: `packages/core/src/tools/definitions/browser-dom.test.ts`

- [ ] **Step 1: Write the test fakes**

`packages/core/src/tools/testing/fakes.ts`:

```ts
import type {
  BrowserSession,
  DomMatch,
  TestRunResult,
  TestRunner,
  ToolContext,
} from '../types';

/** Records calls and returns canned data. For unit tests only. */
export class FakeBrowserSession implements BrowserSession {
  calls: string[] = [];
  current = 'about:blank';
  snapshotHtml = '<html></html>';
  queryResult: DomMatch[] = [];
  testidList: string[] = [];

  async navigate(url: string): Promise<void> {
    this.calls.push(`navigate:${url}`);
    this.current = url;
  }
  async click(selector: string): Promise<void> {
    this.calls.push(`click:${selector}`);
  }
  async type(selector: string, text: string): Promise<void> {
    this.calls.push(`type:${selector}:${text}`);
  }
  async snapshot(): Promise<string> {
    this.calls.push('snapshot');
    return this.snapshotHtml;
  }
  async query(selector: string): Promise<DomMatch[]> {
    this.calls.push(`query:${selector}`);
    return this.queryResult;
  }
  async testids(): Promise<string[]> {
    this.calls.push('testids');
    return this.testidList;
  }
  url(): string {
    return this.current;
  }
}

/** Returns a canned run result. For unit tests only. */
export class FakeTestRunner implements TestRunner {
  lastSpec: string | undefined;
  result: TestRunResult = { passed: 0, failed: 0, summary: 'no run', artifactsDir: '/tmp/none' };

  async run(specPath?: string): Promise<TestRunResult> {
    this.lastSpec = specPath;
    return this.result;
  }
}

/** Build a ToolContext wired to the given (or fresh) fakes. */
export function makeFakeCtx(over: Partial<ToolContext> = {}): ToolContext {
  return {
    workspaceRoot: over.workspaceRoot ?? '/tmp/argus-ws',
    browser: over.browser ?? new FakeBrowserSession(),
    runner: over.runner ?? new FakeTestRunner(),
  };
}
```

- [ ] **Step 2: Write the failing test**

`packages/core/src/tools/definitions/browser-dom.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { browserNavigate, browserClick, browserType, browserSnapshot } from './browser';
import { domQuery, domTestids } from './dom';
import { FakeBrowserSession, makeFakeCtx } from '../testing/fakes';

describe('browser tools', () => {
  it('navigate/click/type delegate to the session', async () => {
    const browser = new FakeBrowserSession();
    const ctx = makeFakeCtx({ browser });
    await browserNavigate.handler({ url: 'http://x/' }, ctx);
    await browserClick.handler({ selector: '#go' }, ctx);
    await browserType.handler({ selector: '#q', text: 'hi' }, ctx);
    expect(browser.calls).toEqual(['navigate:http://x/', 'click:#go', 'type:#q:hi']);
  });

  it('snapshot returns the page HTML and current url in meta', async () => {
    const browser = new FakeBrowserSession();
    browser.snapshotHtml = '<main>shop</main>';
    browser.current = 'http://x/products';
    const res = await browserSnapshot.handler({}, makeFakeCtx({ browser }));
    expect(res.content).toBe('<main>shop</main>');
    expect(res.meta?.url).toBe('http://x/products');
  });
});

describe('dom tools', () => {
  it('dom_query formats matches and reports a count', async () => {
    const browser = new FakeBrowserSession();
    browser.queryResult = [{ tag: 'button', text: 'Add', attributes: { 'data-testid': 'add' } }];
    const res = await domQuery.handler({ selector: 'button' }, makeFakeCtx({ browser }));
    expect(res.meta?.count).toBe(1);
    expect(res.content).toMatch(/button/);
    expect(res.content).toMatch(/Add/);
  });

  it('dom_testids lists ids and reports a count', async () => {
    const browser = new FakeBrowserSession();
    browser.testidList = ['login-submit', 'cart-count'];
    const res = await domTestids.handler({}, makeFakeCtx({ browser }));
    expect(res.meta?.count).toBe(2);
    expect(res.content).toBe('login-submit\ncart-count');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @argus/core test src/tools/definitions/browser-dom.test.ts`
Expected: FAIL — cannot find module `./browser`.

- [ ] **Step 4: Write `browser.ts`**

```ts
import { z } from 'zod';
import { defineTool } from '../types';

export const browserNavigate = defineTool({
  name: 'browser_navigate',
  description: 'Navigate the browser to a URL.',
  input: z.object({ url: z.string().describe('Absolute URL to open') }),
  handler: async ({ url }, ctx) => {
    await ctx.browser.navigate(url);
    return { content: `Navigated to ${url}`, meta: { url } };
  },
});

export const browserClick = defineTool({
  name: 'browser_click',
  description: 'Click the first element matching a selector.',
  input: z.object({ selector: z.string().describe('CSS or testid selector') }),
  handler: async ({ selector }, ctx) => {
    await ctx.browser.click(selector);
    return { content: `Clicked ${selector}` };
  },
});

export const browserType = defineTool({
  name: 'browser_type',
  description: 'Type text into the element matching a selector.',
  input: z.object({
    selector: z.string().describe('CSS or testid selector'),
    text: z.string().describe('Text to type'),
  }),
  handler: async ({ selector, text }, ctx) => {
    await ctx.browser.type(selector, text);
    return { content: `Typed into ${selector}` };
  },
});

export const browserSnapshot = defineTool({
  name: 'browser_snapshot',
  description: 'Return a trimmed HTML/a11y snapshot of the current page.',
  input: z.object({}),
  handler: async (_input, ctx) => {
    const html = await ctx.browser.snapshot();
    return { content: html, meta: { url: ctx.browser.url() } };
  },
});
```

- [ ] **Step 5: Write `dom.ts`**

```ts
import { z } from 'zod';
import { defineTool } from '../types';
import type { DomMatch } from '../types';

function formatMatch(m: DomMatch): string {
  const attrs = Object.entries(m.attributes)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
  const head = attrs ? `<${m.tag} ${attrs}>` : `<${m.tag}>`;
  return m.text ? `${head} ${m.text}` : head;
}

export const domQuery = defineTool({
  name: 'dom_query',
  description: 'Query the current page for elements matching a selector.',
  input: z.object({ selector: z.string().describe('CSS or testid selector') }),
  handler: async ({ selector }, ctx) => {
    const matches = await ctx.browser.query(selector);
    const content = matches.length ? matches.map(formatMatch).join('\n') : '(no matches)';
    return { content, meta: { count: matches.length } };
  },
});

export const domTestids = defineTool({
  name: 'dom_testids',
  description: 'List all data-testid values present on the current page.',
  input: z.object({}),
  handler: async (_input, ctx) => {
    const ids = await ctx.browser.testids();
    return { content: ids.length ? ids.join('\n') : '(none)', meta: { count: ids.length } };
  },
});
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @argus/core test src/tools/definitions/browser-dom.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/tools/testing/fakes.ts packages/core/src/tools/definitions/browser.ts packages/core/src/tools/definitions/dom.ts packages/core/src/tools/definitions/browser-dom.test.ts
git commit -m "TRE-31: browser + dom tools and test fakes"
```

---

### Task 7: playwright tool — `playwright_run`

**Files:**
- Create: `packages/core/src/tools/definitions/playwright.ts`
- Test: `packages/core/src/tools/definitions/playwright.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { playwrightRun } from './playwright';
import { FakeTestRunner, makeFakeCtx } from '../testing/fakes';

describe('playwright_run', () => {
  it('delegates to the runner and reports results in meta', async () => {
    const runner = new FakeTestRunner();
    runner.result = { passed: 3, failed: 1, summary: '3 passed, 1 failed', artifactsDir: '/runs/1' };
    const res = await playwrightRun.handler({ specPath: 'tests/cart.spec.ts' }, makeFakeCtx({ runner }));
    expect(runner.lastSpec).toBe('tests/cart.spec.ts');
    expect(res.content).toBe('3 passed, 1 failed');
    expect(res.meta).toEqual({ passed: 3, failed: 1, artifactsDir: '/runs/1' });
    expect(res.isError).toBeUndefined();
  });

  it('runs all specs when no path is given', async () => {
    const runner = new FakeTestRunner();
    const res = await playwrightRun.handler({}, makeFakeCtx({ runner }));
    expect(runner.lastSpec).toBeUndefined();
    expect(res.content).toBe('no run');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @argus/core test src/tools/definitions/playwright.test.ts`
Expected: FAIL — cannot find module `./playwright`.

- [ ] **Step 3: Write the implementation**

```ts
import { z } from 'zod';
import { defineTool } from '../types';

export const playwrightRun = defineTool({
  name: 'playwright_run',
  description: 'Run Playwright specs and report pass/fail counts and the artifacts directory.',
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

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @argus/core test src/tools/definitions/playwright.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/tools/definitions/playwright.ts packages/core/src/tools/definitions/playwright.test.ts
git commit -m "TRE-31: playwright_run tool"
```

---

### Task 8: `createDefaultRegistry` + barrels + package exports

**Files:**
- Create: `packages/core/src/tools/definitions/index.ts`
- Create: `packages/core/src/tools/index.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/tools/default-registry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { createDefaultRegistry } from './definitions';

const EXPECTED = [
  'fs_read',
  'fs_write',
  'fs_list',
  'browser_navigate',
  'browser_click',
  'browser_type',
  'browser_snapshot',
  'dom_query',
  'dom_testids',
  'playwright_run',
];

describe('createDefaultRegistry', () => {
  it('registers all 10 tools', () => {
    const r = createDefaultRegistry();
    expect(r.list().map((t) => t.name).sort()).toEqual([...EXPECTED].sort());
  });

  it('adapts every tool for Anthropic and MCP', () => {
    const r = createDefaultRegistry();
    expect(r.toAnthropic()).toHaveLength(10);
    expect(r.toMcp()).toHaveLength(10);
    for (const t of r.toAnthropic()) {
      expect(t.input_schema.type).toBe('object');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @argus/core test src/tools/default-registry.test.ts`
Expected: FAIL — cannot find module `./definitions`.

- [ ] **Step 3: Write `definitions/index.ts`**

```ts
import { ToolRegistry } from '../registry';
import { fsRead, fsWrite, fsList } from './fs';
import { browserNavigate, browserClick, browserType, browserSnapshot } from './browser';
import { domQuery, domTestids } from './dom';
import { playwrightRun } from './playwright';

/** Every built-in tool, in a stable order. */
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
  playwrightRun,
];

/** A fresh registry with all built-in tools registered. */
export function createDefaultRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  for (const tool of ALL_TOOLS) {
    registry.register(tool);
  }
  return registry;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @argus/core test src/tools/default-registry.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write `tools/index.ts` (subsystem barrel)**

```ts
export { ToolRegistry } from './registry';
export { ALL_TOOLS, createDefaultRegistry } from './definitions';
export { defineTool, ToolError } from './types';
export type {
  AnthropicToolParam,
  BrowserSession,
  DomMatch,
  McpToolParam,
  TestRunner,
  TestRunResult,
  ToolContext,
  ToolDefinition,
  ToolInputSchema,
  ToolResult,
} from './types';
```

- [ ] **Step 6: Re-export the tools subsystem from the package entry**

Append to `packages/core/src/index.ts`:

```ts

export * from './tools/index';
```

- [ ] **Step 7: Typecheck + run the whole core test suite**

Run: `pnpm --filter @argus/core typecheck && pnpm --filter @argus/core test`
Expected: typecheck PASS; all tests PASS (existing model tests + the new registry/adapters/fs/browser-dom/playwright/default-registry suites).

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/tools/definitions/index.ts packages/core/src/tools/index.ts packages/core/src/index.ts packages/core/src/tools/default-registry.test.ts
git commit -m "TRE-31: createDefaultRegistry + tools barrel + package exports"
```

---

### Task 9: Full verification + docs

**Files:**
- Modify: `docs/ROADMAP.md`
- Modify: `docs/STATUS.md`

- [ ] **Step 1: Run the full canonical suite from the repo root**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: all green.

- [ ] **Step 2: Mark TRE-31 done in the roadmap**

In `docs/ROADMAP.md`, change the M1 table rows so `TRE-31` is `✅` and `TRE-32` is `🔜 **next**`:

```markdown
| `TRE-31` | Tool Registry: browser / dom / fs / playwright tool definitions | ✅ |
| `TRE-32` | @argus/core: Claude agent loop (Messages API + tool-use orchestration) | 🔜 **next** |
```

- [ ] **Step 3: Update STATUS.md**

- In the "▶ To continue right now" section, change the next ticket to **`TRE-32`** (the agent loop), noting it provides the real `BrowserSession` + `TestRunner` that the registry's `ToolContext` expects.
- In the package inventory, update the `@argus/core` row to: registry built (10 tools across fs/dom/browser/playwright), Zod schemas, `toAnthropic`/`toMcp` adapters, real handlers over an injected `ToolContext`; agent loop still pending (TRE-32).
- Add a "Done: `TRE-31`" subsection summarizing the registry, the `ToolContext` seam (interfaces faked in tests, real Playwright impl in TRE-32), and that `zod@4` was added (native `z.toJSONSchema`, no `zod-to-json-schema`).

- [ ] **Step 4: Commit**

```bash
git add docs/ROADMAP.md docs/STATUS.md
git commit -m "M1: Tool Registry complete (TRE-31); docs point to TRE-32"
```

---

## Self-Review notes (author)

- **Spec coverage:** types (Task 2) · registry execute contract incl. never-throw, unknown-tool, bad-input, nullish-default (Task 3) · adapters incl. `$schema` strip + Zod shape (Task 4) · fs incl. traversal rejection (Task 5) · browser/dom via fake session (Task 6) · `playwright_run` via fake runner (Task 7) · `createDefaultRegistry` all-10 + both adapters (Task 8) · full green + docs (Task 9). All §9 spec tests are represented.
- **Type consistency:** `defineTool` returns the default-generic `ToolDefinition`; tool consts are imported by name and assembled in `ALL_TOOLS`; `ToolContext` fields (`workspaceRoot`/`browser`/`runner`) match the fakes and every handler; adapter return types match `AnthropicToolParam`/`McpToolParam`.
- **Deferred (not in this plan, per spec non-goals):** real Playwright `BrowserSession`/`TestRunner` (TRE-32), the agent loop + observer hook, git tools.

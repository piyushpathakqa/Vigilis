# Tool Registry — Design Spec (TRE-31)

> Status: approved 2026-06-12. Implements milestone **M1 / `TRE-31`**.
> See `docs/DESIGN.md` §2 ("one core, two consumers") for the architectural why.

## 1. Goal

Define Argus's QA tools **once** in `@argus/core` as a single registry, and adapt that registry
to its two consumers:

1. the **agent loop** (TRE-32) — via the Anthropic Messages API tool-use format, and
2. the **MCP server** (TRE-42) — via the MCP tool format.

TRE-31 delivers the registry, the tool definitions with **real handlers**, and both adapters.
Tool *execution* runs against an injected `ToolContext`, so handlers are real and unit-testable
without a browser. The Playwright-backed context is injected later by TRE-32.

## 2. Non-goals (YAGNI for TRE-31)

- Real Playwright wiring, browser launch, or session lifecycle — TRE-32 provides the real
  `BrowserSession` / `TestRunner`.
- The agent loop itself (TRE-32) and any observer/telemetry hook (e.g. the optional Treeship
  layer).
- **Git tools.** `docs/DESIGN.md`'s registry diagram lists `git`, but that serves Heal (TRE-39,
  open a PR). It is out of scope here; TRE-31's surface is `browser / dom / fs / playwright`.

## 3. Decisions (resolved)

| Decision | Choice | Why |
|----------|--------|-----|
| Schema library | **Zod (v3)** | One schema per tool → runtime input validation + TS inference; v3 matches `@modelcontextprotocol/sdk@^1`. Single source of truth for both adapters. |
| JSON Schema for Anthropic | **`zod-to-json-schema`** | Anthropic `tool.input_schema` is JSON Schema; derive it from the Zod schema rather than hand-writing. |
| Handler execution model | **Real handlers over an injected `ToolContext`** | Handlers do real work (fs, dom, browser, run) but depend on injected interfaces, so they're testable with fakes and the real Playwright impl lands in TRE-32. |
| DOM/browser injection point | **Single `BrowserSession` interface** | Both `browser_*` and `dom_*` tools route through it — one seam to fake/implement. |

## 4. Module layout

```
packages/core/src/
  index.ts                    # re-exports MODELS/resolveModel (existing) + tools barrel
  tools/
    index.ts                  # barrel for the tools subsystem
    types.ts                  # ToolDefinition, ToolContext, BrowserSession, TestRunner, ToolResult
    registry.ts               # ToolRegistry class + adapters
    definitions/
      index.ts                # createDefaultRegistry()
      fs.ts                   # fs_read, fs_write, fs_list
      browser.ts              # browser_navigate, browser_click, browser_type, browser_snapshot
      dom.ts                  # dom_query, dom_testids
      playwright.ts           # playwright_run
```

## 5. Core types (`tools/types.ts`)

```ts
import type { z } from 'zod';

/** Runtime dependencies a tool handler may use. Injected by the caller. */
export interface ToolContext {
  /** Absolute directory that all fs_* tools are sandboxed to. */
  workspaceRoot: string;
  /** Live page/browser. Real impl injected by the agent loop (TRE-32); faked in tests. */
  browser: BrowserSession;
  /** Runs Playwright specs. Real impl injected by TRE-32; faked in tests. */
  runner: TestRunner;
}

/** The single seam for all browser + DOM tools. */
export interface BrowserSession {
  navigate(url: string): Promise<void>;
  click(selector: string): Promise<void>;
  type(selector: string, text: string): Promise<void>;
  /** Trimmed HTML / a11y summary of the current page, for the agent to "see" it. */
  snapshot(): Promise<string>;
  /** Matched elements for a selector: tag, text, and key attributes. */
  query(selector: string): Promise<DomMatch[]>;
  /** All data-testid values currently present on the page. */
  testids(): Promise<string[]>;
  /** Current page URL. */
  url(): string;
}

export interface DomMatch {
  tag: string;
  text: string;
  attributes: Record<string, string>;
}

/** Runs Playwright specs and reports results + where artifacts landed. */
export interface TestRunner {
  run(specPath?: string): Promise<TestRunResult>;
}

export interface TestRunResult {
  passed: number;
  failed: number;
  summary: string;
  /** Directory holding traces/screenshots/logs (fuel for Triage). */
  artifactsDir: string;
}

export interface ToolDefinition<I = unknown> {
  name: string;
  description: string;
  /** Zod schema for the tool's input object. */
  input: z.ZodType<I>;
  handler: (input: I, ctx: ToolContext) => Promise<ToolResult>;
}

export interface ToolResult {
  /** Text payload returned to the model / CLI. */
  content: string;
  /** Optional structured metadata (e.g. file path, match count, artifactsDir). */
  meta?: Record<string, unknown>;
  /** True when the call failed; surfaced to the model as a tool error to self-correct. */
  isError?: boolean;
}
```

## 6. Registry (`tools/registry.ts`)

```ts
class ToolRegistry {
  register(def: ToolDefinition): void;       // throws on duplicate name
  list(): ToolDefinition[];
  get(name: string): ToolDefinition | undefined;

  /** Validate input against the Zod schema, run the handler, never throw. */
  execute(name: string, rawInput: unknown, ctx: ToolContext): Promise<ToolResult>;

  /** Anthropic Messages API tool params: { name, description, input_schema }. */
  toAnthropic(): AnthropicToolParam[];

  /** MCP registration payload: { name, description, inputSchema (Zod) }. */
  toMcp(): McpToolParam[];
}

export function createDefaultRegistry(): ToolRegistry; // registers all 10 tool defs
```

**`execute` contract (the important part):**

1. Look up the tool. Unknown name → `{ isError: true, content: "Unknown tool: <name>" }`.
2. `def.input.safeParse(rawInput)`. On failure → `{ isError: true, content: "Invalid input: <zod message>" }`.
3. `await def.handler(parsed, ctx)` inside try/catch. On throw → `{ isError: true, content: <error message> }`.
4. **Never throws.** The agent loop needs every outcome as a `tool_result` block so the model can
   recover on the next turn. This mirrors Anthropic tool-use error convention (`is_error: true`).

## 7. Tools

### fs (real `node:fs`, sandboxed)
- `fs_read({ path })` → file contents.
- `fs_write({ path, content })` → creates parent dirs, writes, returns bytes written in `meta`.
- `fs_list({ dir? })` → entries under `dir` (defaults to `workspaceRoot`).

**Sandbox guard:** resolve `path` against `workspaceRoot` with `path.resolve`, then require the
resolved path to be inside `workspaceRoot` (string prefix on the normalized path + separator).
Reject traversal (`../…`, absolute escapes) with an `isError` result. Security-relevant; tested.

### browser (delegate to `ctx.browser`)
- `browser_navigate({ url })`
- `browser_click({ selector })`
- `browser_type({ selector, text })`
- `browser_snapshot({})` → `ctx.browser.snapshot()`

### dom (delegate to `ctx.browser`)
- `dom_query({ selector })` → `ctx.browser.query(selector)`, rendered as readable text + `meta.count`.
- `dom_testids({})` → `ctx.browser.testids()`, list of stable test ids on the page.

### playwright (delegate to `ctx.runner`)
- `playwright_run({ specPath? })` → `ctx.runner.run(specPath)`; returns the summary as `content`
  and `{ passed, failed, artifactsDir }` in `meta`.

## 8. Adapters

- `toAnthropic()` — map each def to `{ name, description, input_schema: zodToJsonSchema(def.input) }`.
  Typed against the Anthropic SDK's tool param type. The exact `zod-to-json-schema` options
  (e.g. `target`, `$refStrategy: 'none'`) are settled during implementation to produce a flat,
  Anthropic-friendly schema.
- `toMcp()` — map each def to `{ name, description, inputSchema: def.input }` (or its Zod raw
  shape) for the MCP server (TRE-42) to register. The exact registration call belongs to TRE-42;
  TRE-31 only exposes the data the server needs.

## 9. Testing (Vitest, in `@argus/core`)

- **registry:** register/duplicate/get/list; `execute` happy path; `execute` rejects bad input
  with `isError`; `execute` catches a throwing handler; `execute` on unknown tool; `toAnthropic`
  emits `input_schema` with the right `required`/`properties`; `toMcp` shape.
- **fs:** against a `mkdtemp` workspace — read/write round-trip, `fs_list`, and **path-traversal
  rejection** (`../escape`, absolute path outside root).
- **browser/dom:** a `FakeBrowserSession` that records calls and returns canned snapshot/query/
  testids; assert each tool calls the right method and formats the result.
- **playwright:** a `FakeTestRunner` returning a canned `TestRunResult`; assert `content`/`meta`.

## 10. Dependencies

Add to `packages/core/package.json`:
- `zod` (`^3`)
- `zod-to-json-schema` (`^3`)

Not added: `playwright` / `@playwright/test` (TRE-32 owns the real session + runner).

## 11. Done when

- `@argus/core` exports `createDefaultRegistry`, the registry class, and the tool/context types.
- All 10 tools are defined with Zod schemas and real handlers over `ToolContext`.
- `toAnthropic()` and `toMcp()` produce valid payloads for their respective SDKs.
- Vitest covers the registry contract, fs sandboxing, and the browser/dom/playwright handlers via
  fakes.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` is green.

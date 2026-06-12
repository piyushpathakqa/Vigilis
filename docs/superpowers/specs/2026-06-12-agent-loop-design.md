# Agent Loop + Real ToolContext — Design Spec (TRE-32)

> Status: approved 2026-06-12. Implements milestone **M1 / `TRE-32`**.
> Builds on the Tool Registry (`TRE-31`, see `docs/superpowers/specs/2026-06-12-tool-registry-design.md`).

## 1. Goal

The hand-rolled Claude agent loop in `@argus/core` — the engine the four behaviors (Author /
Generate / Triage / Heal) drive — plus the **real, Playwright-backed `BrowserSession` and
`TestRunner`** that satisfy the registry's `ToolContext`. Per `docs/DESIGN.md`, the loop is
**hand-rolled** (not the SDK tool runner) to demonstrate understanding of agent orchestration.

Also ships an `argus smoke <url>` command so the loop can be **run and watched end-to-end**
against `sample-shop` before any behavior (Generate = TRE-33) exists.

## 2. Non-goals (deferred)

- Behavior-specific system prompts + DOM context engineering — **TRE-34**.
- The behaviors themselves (Generate/Triage/Heal) — **TRE-33, TRE-38, TRE-39**.
- Prompt caching, streaming, context editing — later optimizations; the loop is non-streaming.
- Git tools (serve Heal) — **TRE-39**.
- CI browser provisioning (`npx playwright install`) — **TRE-36**; here the browser tests
  self-skip when chromium is absent so `pnpm test` stays green everywhere.

## 3. Decisions (resolved)

| Decision | Choice | Why |
|----------|--------|-----|
| SDK version | **Upgrade `@anthropic-ai/sdk` → `^0.104.1`** | The pinned `0.32.1` predates adaptive thinking, `output_config.effort`, and current typed errors. |
| Loop scope | **Loop + real Playwright session/runner in one ticket** | Generate (TRE-33) needs a real browser to exercise; keep the runtime with the loop. |
| Client coupling | **Injected `AnthropicLike` interface** | The loop is provider-real but depends on a narrow interface, so it's unit-tested with a scripted fake — no API key, no network. |
| Thinking / effort | **`thinking` defaults on** (`thinking:{type:"adaptive"}`); `effort` is **only sent when set** (no default) | Adaptive thinking + `effort` are Opus-4.6+/Sonnet-4.6/Fable-tier features — they **400 on Haiku 4.5**. The loop's default model is the Opus primary, so `thinking:true` is safe by default; callers on Haiku (e.g. `smoke`) pass `thinking:false`. Omitting `effort` lets each model use its own default. Full `response.content` (incl. thinking blocks) is echoed back across tool turns. |
| Model | `resolveModel('primary')` = `claude-opus-4-8` default; loop accepts an override | Matches existing `MODELS` config; smoke defaults to the fast model for cost. |
| Browser injection | The real `BrowserSession`/`TestRunner` are the **only** new implementations of the TRE-31 interfaces | One seam; fakes still serve unit tests. |
| Manual verification | **Add `argus smoke <url>`** | The only way to watch the loop run E2E until TRE-33. |

## 4. Module layout

```
packages/core/src/
  index.ts                      # re-exports agent + runtime barrels
  agent/
    index.ts                    # barrel
    client.ts                   # AnthropicLike + createAnthropicClient()
    observer.ts                 # AgentObserver + ConsoleObserver
    loop.ts                     # runAgentLoop()
  runtime/
    index.ts                    # barrel
    playwright-session.ts       # PlaywrightBrowserSession + createPlaywrightSession()
    playwright-runner.ts        # PlaywrightTestRunner + parsePlaywrightJson()
  tools/testing/fakes.ts        # extend: FakeAnthropicClient + makeMessage() helper

packages/cli/src/index.ts       # add the `smoke <url>` command
```

## 5. Core types (`agent/client.ts`, `agent/observer.ts`, `agent/loop.ts`)

```ts
import type Anthropic from '@anthropic-ai/sdk';

/** The narrow slice of the Anthropic SDK the loop needs. `new Anthropic()` satisfies it. */
export interface AnthropicLike {
  messages: {
    create(body: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>;
  };
}

/** Real client. Reads ANTHROPIC_API_KEY from the environment by default. */
export function createAnthropicClient(): AnthropicLike;

/** Optional observability hook — the seam reused by TRE-37 (artifacts) and TRE-46 (Treeship). */
export interface AgentObserver {
  onLoopStart?(e: { system: string; model: string }): void;
  onModelRequest?(e: { step: number; messageCount: number }): void;
  onModelResponse?(e: { step: number; stopReason: string | null; usage: Anthropic.Usage }): void;
  onToolCall?(e: { step: number; name: string; input: unknown }): void;
  onToolResult?(e: { step: number; name: string; result: ToolResult }): void;
  onLoopEnd?(e: { steps: number; stopReason: AgentStopReason }): void;
}

/** Logs each step to the console. Used by `argus smoke`. */
export class ConsoleObserver implements AgentObserver { /* ... */ }

export type AgentStopReason = 'end_turn' | 'refusal' | 'max_tokens' | 'max_steps' | 'stop_sequence';

export interface AgentRunResult {
  finalText: string;
  stopReason: AgentStopReason;
  steps: number;
  messages: Anthropic.MessageParam[];   // full transcript
  usage: { inputTokens: number; outputTokens: number };  // summed across steps
}

export interface RunAgentLoopOptions {
  client: AnthropicLike;
  system: string;
  prompt: string;
  registry: ToolRegistry;
  ctx: ToolContext;
  model?: string;          // default resolveModel('primary')
  effort?: 'low' | 'medium' | 'high' | 'max';  // omitted when unset (model default applies); unsupported on Haiku
  thinking?: boolean;      // default true (adaptive); set false on Haiku-tier models
  maxSteps?: number;       // default 25
  maxTokens?: number;      // default 16000
  observer?: AgentObserver;
}

export function runAgentLoop(opts: RunAgentLoopOptions): Promise<AgentRunResult>;
```

## 6. The loop (`runAgentLoop`)

```
messages = [{ role: 'user', content: prompt }]
observer.onLoopStart
for step in 1..maxSteps:
  observer.onModelRequest
  res = await client.messages.create({
    model, max_tokens, system,
    messages,
    tools: registry.toAnthropic(),
    ...(thinking ? { thinking: { type: 'adaptive' } } : {}),
    ...(effort ? { output_config: { effort } } : {}),   // omit on Haiku / when unset
  })
  accumulate usage; observer.onModelResponse
  messages.push({ role: 'assistant', content: res.content })   // FULL content (thinking + tool_use preserved)
  if res.stop_reason !== 'tool_use':
     return { finalText: text-blocks joined, stopReason: res.stop_reason, ... }
  toolResults = []
  for block in res.content where block.type === 'tool_use':
     observer.onToolCall
     result = await registry.execute(block.name, block.input, ctx)   // never throws; isError on failure
     observer.onToolResult
     toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result.content, is_error: !!result.isError })
  messages.push({ role: 'user', content: toolResults })
# loop exhausted:
return { stopReason: 'max_steps', ... }
```

Contract notes:
- **Full `response.content` is echoed back** every turn — required so adaptive thinking blocks
  replay correctly and `tool_use` blocks pair with their `tool_result`s.
- **`registry.execute` never throws** (TRE-31), so tool failures return as `is_error` tool_results
  and the model self-corrects rather than crashing the loop.
- **API errors propagate.** The loop does not catch SDK exceptions (`RateLimitError`, etc.); the
  SDK already auto-retries 429/5xx. Callers (behaviors) decide how to handle a hard failure.
- **`refusal`** ends the loop with `stopReason:'refusal'` and whatever text was returned.
- **`max_steps`** guards against runaway loops.
- The exact request-body typing for `thinking`/`output_config` is verified against the installed
  `@anthropic-ai/sdk@^0.104.1` types during implementation; if a field isn't yet in the param
  type, it's passed via a typed extension rather than guessed.

## 7. AgentObserver

Interface in §5. All methods optional; the loop calls them defensively (`observer?.onX?.(…)`).
`ConsoleObserver` prints a compact line per event (e.g. `→ browser_navigate {"url":"…"}`,
`✓ dom_testids (8 ids)`), used by `argus smoke`. This is the hook TRE-37 and TRE-46 build on.

## 8. Real `BrowserSession` (`runtime/playwright-session.ts`)

`PlaywrightBrowserSession implements BrowserSession` (TRE-31 interface), wrapping a chromium
`Page`:

| Method | Implementation |
|--------|----------------|
| `navigate(url)` | `page.goto(url, { waitUntil: 'domcontentloaded' })` |
| `click(selector)` | `page.locator(selector).first().click()` |
| `type(selector, text)` | `page.locator(selector).first().fill(text)` |
| `snapshot()` | trimmed page HTML (`page.content()` truncated to ~20 000 chars) — refined in TRE-34 |
| `query(selector)` | `page.locator(selector)`, first ~20 → `DomMatch[]` (tag, text, attributes) |
| `testids()` | `page.$$eval('[data-testid]', els => els.map(e => e.getAttribute('data-testid')))` |
| `url()` | `page.url()` |

Selectors are raw Playwright strings; the agent uses `[data-testid="…"]` discovered via
`dom_testids` / `snapshot`. Factory `createPlaywrightSession({ headless?, baseUrl? }):
Promise<{ session: PlaywrightBrowserSession; close: () => Promise<void> }>` launches chromium,
creates a context + page, and returns a `close()` that tears the browser down.

## 9. Real `TestRunner` (`runtime/playwright-runner.ts`)

- **`parsePlaywrightJson(report): TestRunResult`** — pure function turning Playwright's
  `--reporter=json` output (`stats.expected` / `stats.unexpected` / `stats.flaky` / `stats.skipped`)
  into `{ passed, failed, summary, artifactsDir }`. Unit-tested in isolation.
- **`PlaywrightTestRunner implements TestRunner`** — `run(specPath?)` spawns
  `npx playwright test [specPath] --reporter=json` in `workspaceRoot` via `node:child_process`,
  collects stdout, and passes it to `parsePlaywrightJson`. `artifactsDir` defaults to
  `test-results`. The spawn wrapper is thin; correctness lives in the pure parser.

## 10. The `argus smoke <url>` command (`packages/cli/src/index.ts`)

```
argus smoke <url> [--model <id>] [--headed] [--max-steps <n>]
```
Wires the real pieces into one watchable run:
1. `createPlaywrightSession({ headless: !headed })` → `ctx = { workspaceRoot: cwd, browser, runner: new PlaywrightTestRunner() }`.
2. `registry = createDefaultRegistry()`, `observer = new ConsoleObserver()`.
3. `runAgentLoop({ client: createAnthropicClient(), system: SMOKE_SYSTEM, prompt: \`Explore ${url} …\`, registry, ctx, model: model ?? resolveModel('fast'), thinking: false, maxSteps, observer })` — `thinking:false` because the smoke default is Haiku (no adaptive thinking / effort). Pass `--model claude-opus-4-8` to opt into Opus; if you do, the command enables `thinking` for Opus-tier models.
4. Prints the final text, then a usage/cost summary (input/output tokens × the model's per-token
   price), then `await close()`.

- **Default model is the fast model** (`claude-haiku-4-5`) for cost; `--model` overrides.
- `SMOKE_SYSTEM` is a throwaway "explore and report; do not write files" prompt — *not* the real
  Generate prompt (that's TRE-34).
- Requires `ANTHROPIC_API_KEY` in the environment and chromium installed
  (`npx playwright install chromium`). Documented in the command help and README. Run with
  `node --env-file=.env packages/cli/dist/index.js smoke …` to load `.env` (Node ≥20; no dotenv dep).

## 11. Testing (Vitest)

- **`loop.test.ts`** (no key, no browser): a `FakeAnthropicClient` scripted with a queue of
  `Anthropic.Message`s (via a `makeMessage()` helper) + the real `createDefaultRegistry()` + the
  TRE-31 `makeFakeCtx()`. Cases: a `tool_use` turn dispatches to `registry.execute` and feeds a
  `tool_result` back; an `end_turn` turn returns `finalText`; `maxSteps` returns
  `stopReason:'max_steps'`; `refusal` ends cleanly; observer callbacks fire; thinking blocks are
  echoed back in `messages`.
- **`playwright-runner.test.ts`**: `parsePlaywrightJson` for all-pass, some-fail, and
  empty/zero-test reports.
- **`playwright-session.test.ts`** (integration): launch chromium in `beforeAll`; on launch
  failure set `available = false` and `it.skipIf(!available)` every case. Uses
  `page.setContent('<…data-testid…>')` (no server) to assert `testids`, `query`, `snapshot`,
  `click`, `type`, `url`. CI installs chromium (TRE-36); locally it self-skips if absent.

## 12. Dependencies

- `packages/core/package.json`: bump `@anthropic-ai/sdk` to `^0.104.1`; add `playwright`
  (`^1.60.0`).
- `packages/cli/package.json`: no new deps (uses `@argus/core` + existing `commander`).
- Browsers are **not** vendored; `npx playwright install chromium` is a documented one-time step.

## 13. Done when

- `@argus/core` exports `runAgentLoop`, `createAnthropicClient`, `AgentObserver`/`ConsoleObserver`,
  `createPlaywrightSession`/`PlaywrightBrowserSession`, `PlaywrightTestRunner`/`parsePlaywrightJson`.
- `runAgentLoop` orchestrates a multi-step tool-use conversation over the registry, proven by the
  fake-client unit tests.
- The Playwright session + runner implement the TRE-31 interfaces against real chromium.
- `argus smoke <url>` runs the loop against `sample-shop` and prints a step trace + cost summary.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` is green (browser test self-skips
  without chromium).

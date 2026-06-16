# Agent Loop + Real ToolContext Implementation Plan (TRE-32)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the hand-rolled Claude agent loop in `@argus/core`, the real Playwright-backed `BrowserSession`/`TestRunner`, and an `argus smoke <url>` command to run the loop end-to-end against sample-shop.

**Architecture:** `runAgentLoop` drives a manual Messages-API tool-use conversation over the TRE-31 registry, depending on an injected `AnthropicLike` client (fake in tests). The real `PlaywrightBrowserSession`/`PlaywrightTestRunner` implement the TRE-31 `ToolContext` interfaces. An `AgentObserver` hook (with `ConsoleObserver`) exposes loop events. The `smoke` CLI command wires the real pieces together.

**Tech Stack:** TypeScript ESM strict, `@anthropic-ai/sdk@^0.104.1` (adaptive thinking + `output_config.effort` are typed — confirmed), `playwright@^1.60.0`, Vitest, tsup, commander.

**Spec:** `docs/superpowers/specs/2026-06-12-agent-loop-design.md`.

**Conventions:** extensionless relative imports (Bundler resolution); `import type` for type-only; run from repo root; scoped tests via `pnpm --filter @argus/core test <path>`. Deps (`@anthropic-ai/sdk@^0.104.1`, `playwright@^1.60.0`) are **already installed** — Task 1 only verifies.

---

### Task 1: Verify deps (already bumped + installed)

**Files:** `packages/core/package.json` (already edited)

- [ ] **Step 1: Confirm versions + typecheck baseline**

Run: `pnpm --filter @argus/core exec node -e "console.log(require('@anthropic-ai/sdk/package.json').version, require('playwright/package.json').version)"`
Expected: `0.104.1 1.60.x`

- [ ] **Step 2: Confirm the existing suite still passes on the new SDK**

Run: `pnpm --filter @argus/core test && pnpm --filter @argus/core typecheck`
Expected: 22 tests pass; typecheck clean (registry code doesn't touch the SDK).

- [ ] **Step 3: Commit**

```bash
git add packages/core/package.json pnpm-lock.yaml
git commit -m "TRE-32: upgrade @anthropic-ai/sdk to ^0.104.1, add playwright"
```

---

### Task 2: `AnthropicLike` client + test fakes

**Files:**
- Create: `packages/core/src/agent/client.ts`
- Modify: `packages/core/src/tools/testing/fakes.ts` (append client fakes)

- [ ] **Step 1: Write `client.ts`**

```ts
import Anthropic from '@anthropic-ai/sdk';

/** The narrow slice of the Anthropic SDK the agent loop depends on. */
export interface AnthropicLike {
  messages: {
    create(body: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>;
  };
}

/** Real client. Reads ANTHROPIC_API_KEY from the environment. */
export function createAnthropicClient(): AnthropicLike {
  return new Anthropic();
}
```

- [ ] **Step 2: Append client fakes to `fakes.ts`**

```ts
import type Anthropic from '@anthropic-ai/sdk';
import type { AnthropicLike } from '../agent/client';

/** Build a minimal valid Anthropic.Message for tests. */
export function makeMessage(
  content: Anthropic.ContentBlock[],
  stopReason: Anthropic.Message['stop_reason'],
): Anthropic.Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-4-8',
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: 10,
      output_tokens: 5,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    },
  } as unknown as Anthropic.Message;
}

/** Returns queued messages in order; records the request bodies it received. */
export class FakeAnthropicClient implements AnthropicLike {
  bodies: Anthropic.MessageCreateParamsNonStreaming[] = [];
  constructor(private queue: Anthropic.Message[]) {}
  messages = {
    create: async (body: Anthropic.MessageCreateParamsNonStreaming) => {
      this.bodies.push(body);
      const next = this.queue.shift();
      if (!next) throw new Error('FakeAnthropicClient: queue exhausted');
      return next;
    },
  };
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @argus/core typecheck`
Expected: PASS. (If `makeMessage`'s `usage` literal errors on extra required fields, the `as unknown as` cast already absorbs it.)

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/agent/client.ts packages/core/src/tools/testing/fakes.ts
git commit -m "TRE-32: AnthropicLike client + Anthropic test fakes"
```

---

### Task 3: `AgentObserver` + `ConsoleObserver`

**Files:** Create `packages/core/src/agent/observer.ts`

- [ ] **Step 1: Write `observer.ts`**

```ts
import type Anthropic from '@anthropic-ai/sdk';
import type { ToolResult } from '../tools/types';

export type AgentStopReason =
  | 'end_turn'
  | 'refusal'
  | 'max_tokens'
  | 'max_steps'
  | 'stop_sequence';

/** Optional observability hook — the seam reused by TRE-37 (artifacts) and TRE-46 (Treeship). */
export interface AgentObserver {
  onLoopStart?(e: { system: string; model: string }): void;
  onModelRequest?(e: { step: number; messageCount: number }): void;
  onModelResponse?(e: { step: number; stopReason: string | null; usage: Anthropic.Usage }): void;
  onToolCall?(e: { step: number; name: string; input: unknown }): void;
  onToolResult?(e: { step: number; name: string; result: ToolResult }): void;
  onLoopEnd?(e: { steps: number; stopReason: AgentStopReason }): void;
}

/** Logs a compact line per loop event. Used by `argus smoke`. */
export class ConsoleObserver implements AgentObserver {
  onLoopStart(e: { system: string; model: string }): void {
    console.log(`[vigilis] loop start · model=${e.model}`);
  }
  onToolCall(e: { step: number; name: string; input: unknown }): void {
    console.log(`[vigilis]  → ${e.name} ${JSON.stringify(e.input)}`);
  }
  onToolResult(e: { step: number; name: string; result: ToolResult }): void {
    const flag = e.result.isError ? '✗' : '✓';
    const preview = e.result.content.slice(0, 80).replace(/\s+/g, ' ');
    console.log(`[vigilis]  ${flag} ${e.name}: ${preview}`);
  }
  onLoopEnd(e: { steps: number; stopReason: AgentStopReason }): void {
    console.log(`[vigilis] loop end · ${e.steps} steps · ${e.stopReason}`);
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @argus/core typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/agent/observer.ts
git commit -m "TRE-32: AgentObserver interface + ConsoleObserver"
```

---

### Task 4: `runAgentLoop`

**Files:**
- Create: `packages/core/src/agent/loop.ts`
- Test: `packages/core/src/agent/loop.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { runAgentLoop } from './loop';
import { createDefaultRegistry } from '../tools/definitions';
import { FakeAnthropicClient, FakeBrowserSession, makeFakeCtx, makeMessage } from '../tools/testing/fakes';

describe('runAgentLoop', () => {
  it('runs a tool_use turn, feeds the result back, and returns final text', async () => {
    const client = new FakeAnthropicClient([
      makeMessage(
        [{ type: 'tool_use', id: 'tu_1', name: 'browser_navigate', input: { url: 'http://x/' } }],
        'tool_use',
      ),
      makeMessage([{ type: 'text', text: 'Done exploring.' }], 'end_turn'),
    ]);
    const browser = new FakeBrowserSession();
    const ctx = makeFakeCtx({ browser });

    const calls: string[] = [];
    const result = await runAgentLoop({
      client,
      system: 'sys',
      prompt: 'go',
      registry: createDefaultRegistry(),
      ctx,
      thinking: false,
      observer: { onToolCall: (e) => calls.push(e.name) },
    });

    expect(browser.calls).toEqual(['navigate:http://x/']);   // tool actually executed via registry
    expect(calls).toEqual(['browser_navigate']);             // observer fired
    expect(result.finalText).toBe('Done exploring.');
    expect(result.stopReason).toBe('end_turn');
    expect(result.steps).toBe(2);
    // second request carried the assistant turn + tool_result back
    expect(client.bodies[1].messages).toHaveLength(3);       // user, assistant, tool_result(user)
    expect(result.usage.inputTokens).toBe(20);               // 10 per call * 2
  });

  it('stops at maxSteps when the model keeps calling tools', async () => {
    const loop = () =>
      makeMessage(
        [{ type: 'tool_use', id: 'tu', name: 'dom_testids', input: {} }],
        'tool_use',
      );
    const client = new FakeAnthropicClient([loop(), loop(), loop()]);
    const result = await runAgentLoop({
      client,
      system: 'sys',
      prompt: 'go',
      registry: createDefaultRegistry(),
      ctx: makeFakeCtx(),
      thinking: false,
      maxSteps: 2,
    });
    expect(result.stopReason).toBe('max_steps');
    expect(result.steps).toBe(2);
  });

  it('ends cleanly on refusal', async () => {
    const client = new FakeAnthropicClient([makeMessage([], 'refusal')]);
    const result = await runAgentLoop({
      client, system: 'sys', prompt: 'go',
      registry: createDefaultRegistry(), ctx: makeFakeCtx(), thinking: false,
    });
    expect(result.stopReason).toBe('refusal');
  });

  it('omits thinking/output_config by default-off and includes them when set', async () => {
    const client = new FakeAnthropicClient([makeMessage([{ type: 'text', text: 'hi' }], 'end_turn')]);
    await runAgentLoop({
      client, system: 'sys', prompt: 'go',
      registry: createDefaultRegistry(), ctx: makeFakeCtx(),
      thinking: true, effort: 'high',
    });
    const body = client.bodies[0] as Record<string, unknown>;
    expect(body.thinking).toEqual({ type: 'adaptive' });
    expect(body.output_config).toEqual({ effort: 'high' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @argus/core test src/agent/loop.test.ts`
Expected: FAIL — cannot find module `./loop`.

- [ ] **Step 3: Write `loop.ts`**

```ts
import type Anthropic from '@anthropic-ai/sdk';
import { resolveModel } from '../index';
import type { ToolRegistry } from '../tools/registry';
import type { ToolContext } from '../tools/types';
import type { AnthropicLike } from './client';
import type { AgentObserver, AgentStopReason } from './observer';

export interface AgentRunResult {
  finalText: string;
  stopReason: AgentStopReason;
  steps: number;
  messages: Anthropic.MessageParam[];
  usage: { inputTokens: number; outputTokens: number };
}

export interface RunAgentLoopOptions {
  client: AnthropicLike;
  system: string;
  prompt: string;
  registry: ToolRegistry;
  ctx: ToolContext;
  model?: string;
  effort?: 'low' | 'medium' | 'high' | 'max';
  thinking?: boolean;
  maxSteps?: number;
  maxTokens?: number;
  observer?: AgentObserver;
}

const TERMINAL: AgentStopReason[] = ['end_turn', 'refusal', 'max_tokens', 'stop_sequence'];

function coerceStop(reason: string | null): AgentStopReason {
  return (TERMINAL as string[]).includes(reason ?? '') ? (reason as AgentStopReason) : 'end_turn';
}

export async function runAgentLoop(opts: RunAgentLoopOptions): Promise<AgentRunResult> {
  const {
    client, system, prompt, registry, ctx,
    model = resolveModel('primary'),
    effort,
    thinking = true,
    maxSteps = 25,
    maxTokens = 16000,
    observer,
  } = opts;

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }];
  const usage = { inputTokens: 0, outputTokens: 0 };
  observer?.onLoopStart?.({ system, model });

  let steps = 0;
  while (steps < maxSteps) {
    steps += 1;
    observer?.onModelRequest?.({ step: steps, messageCount: messages.length });

    const body: Anthropic.MessageCreateParamsNonStreaming = {
      model,
      max_tokens: maxTokens,
      system,
      messages,
      tools: registry.toAnthropic() as unknown as Anthropic.Tool[],
      ...(thinking ? { thinking: { type: 'adaptive' } } : {}),
      ...(effort ? { output_config: { effort } } : {}),
    };

    const res = await client.messages.create(body);
    usage.inputTokens += res.usage.input_tokens;
    usage.outputTokens += res.usage.output_tokens;
    observer?.onModelResponse?.({ step: steps, stopReason: res.stop_reason, usage: res.usage });

    messages.push({ role: 'assistant', content: res.content as Anthropic.ContentBlockParam[] });

    if (res.stop_reason !== 'tool_use') {
      const finalText = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n');
      const stopReason = coerceStop(res.stop_reason);
      observer?.onLoopEnd?.({ steps, stopReason });
      return { finalText, stopReason, steps, messages, usage };
    }

    const toolUses = res.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUses) {
      observer?.onToolCall?.({ step: steps, name: block.name, input: block.input });
      const result = await registry.execute(block.name, block.input, ctx);
      observer?.onToolResult?.({ step: steps, name: block.name, result });
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: result.content,
        is_error: result.isError ?? false,
      });
    }
    messages.push({ role: 'user', content: toolResults });
  }

  observer?.onLoopEnd?.({ steps, stopReason: 'max_steps' });
  return { finalText: '', stopReason: 'max_steps', steps, messages, usage };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @argus/core test src/agent/loop.test.ts`
Expected: PASS (4 tests). If `messages.push({content: res.content})` errors on the cast, the `as Anthropic.ContentBlockParam[]` already present handles it.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/agent/loop.ts packages/core/src/agent/loop.test.ts
git commit -m "TRE-32: hand-rolled runAgentLoop (tool-use orchestration)"
```

---

### Task 5: `parsePlaywrightJson` (pure)

**Files:**
- Create: `packages/core/src/runtime/playwright-runner.ts` (parser only this task)
- Test: `packages/core/src/runtime/playwright-runner.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { parsePlaywrightJson } from './playwright-runner';

describe('parsePlaywrightJson', () => {
  it('maps expected→passed and unexpected→failed', () => {
    const r = parsePlaywrightJson({ stats: { expected: 3, unexpected: 1, flaky: 0, skipped: 0 } }, 'test-results');
    expect(r).toEqual({ passed: 3, failed: 1, summary: '3 passed, 1 failed', artifactsDir: 'test-results' });
  });

  it('treats flaky as failed and reports it in the summary', () => {
    const r = parsePlaywrightJson({ stats: { expected: 2, unexpected: 0, flaky: 1, skipped: 1 } }, 'test-results');
    expect(r.passed).toBe(2);
    expect(r.failed).toBe(1);
    expect(r.summary).toMatch(/flaky/);
  });

  it('handles a missing/empty stats block', () => {
    const r = parsePlaywrightJson({}, 'out');
    expect(r).toEqual({ passed: 0, failed: 0, summary: '0 passed, 0 failed', artifactsDir: 'out' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @argus/core test src/runtime/playwright-runner.test.ts`
Expected: FAIL — cannot find module `./playwright-runner`.

- [ ] **Step 3: Write the parser**

```ts
export interface PlaywrightStats {
  expected?: number;
  unexpected?: number;
  flaky?: number;
  skipped?: number;
}

export interface PlaywrightJsonReport {
  stats?: PlaywrightStats;
}

import type { TestRunResult } from '../tools/types';

/** Turn Playwright's --reporter=json output into a TestRunResult. Pure. */
export function parsePlaywrightJson(report: PlaywrightJsonReport, artifactsDir: string): TestRunResult {
  const s = report.stats ?? {};
  const passed = s.expected ?? 0;
  const failed = (s.unexpected ?? 0) + (s.flaky ?? 0);
  const parts = [`${passed} passed`, `${failed} failed`];
  if (s.flaky) parts.push(`${s.flaky} flaky`);
  if (s.skipped) parts.push(`${s.skipped} skipped`);
  return { passed, failed, summary: parts.join(', '), artifactsDir };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @argus/core test src/runtime/playwright-runner.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/runtime/playwright-runner.ts packages/core/src/runtime/playwright-runner.test.ts
git commit -m "TRE-32: parsePlaywrightJson (pure report parser)"
```

---

### Task 6: `PlaywrightTestRunner`

**Files:**
- Modify: `packages/core/src/runtime/playwright-runner.ts` (append the runner)
- Modify: `packages/core/src/runtime/playwright-runner.test.ts` (append a fake-exec test)

- [ ] **Step 1: Write the failing test (append)**

```ts
import { PlaywrightTestRunner } from './playwright-runner';

describe('PlaywrightTestRunner', () => {
  it('runs the json reporter and returns the parsed result', async () => {
    let calledWith: { cmd: string; args: string[] } | undefined;
    const fakeExec = async (cmd: string, args: string[]) => {
      calledWith = { cmd, args };
      return { stdout: JSON.stringify({ stats: { expected: 5, unexpected: 0 } }), stderr: '', code: 0 };
    };
    const runner = new PlaywrightTestRunner({ cwd: '/ws', exec: fakeExec });
    const result = await runner.run('tests/cart.spec.ts');
    expect(calledWith?.cmd).toBe('npx');
    expect(calledWith?.args).toEqual(['playwright', 'test', 'tests/cart.spec.ts', '--reporter=json']);
    expect(result.passed).toBe(5);
    expect(result.failed).toBe(0);
  });

  it('runs all specs when no path is given', async () => {
    const fakeExec = async () => ({ stdout: JSON.stringify({ stats: {} }), stderr: '', code: 1 });
    const runner = new PlaywrightTestRunner({ cwd: '/ws', exec: fakeExec });
    const result = await runner.run();
    expect(result.summary).toBe('0 passed, 0 failed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @argus/core test src/runtime/playwright-runner.test.ts`
Expected: FAIL — `PlaywrightTestRunner` is not exported.

- [ ] **Step 3: Append the runner to `playwright-runner.ts`**

```ts
import { spawn } from 'node:child_process';
import type { TestRunner, TestRunResult } from '../tools/types';

export interface ExecResult {
  stdout: string;
  stderr: string;
  code: number | null;
}
export type Exec = (cmd: string, args: string[], opts: { cwd: string }) => Promise<ExecResult>;

const defaultExec: Exec = (cmd, args, opts) =>
  new Promise<ExecResult>((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: opts.cwd });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => resolve({ stdout, stderr, code }));
  });

export interface PlaywrightTestRunnerOptions {
  cwd: string;
  exec?: Exec;
  artifactsDir?: string;
}

/** Runs `npx playwright test ... --reporter=json` and parses the result. */
export class PlaywrightTestRunner implements TestRunner {
  constructor(private readonly opts: PlaywrightTestRunnerOptions) {}

  async run(specPath?: string): Promise<TestRunResult> {
    const exec = this.opts.exec ?? defaultExec;
    const artifactsDir = this.opts.artifactsDir ?? 'test-results';
    const args = ['playwright', 'test', ...(specPath ? [specPath] : []), '--reporter=json'];
    const { stdout } = await exec('npx', args, { cwd: this.opts.cwd });
    let report: PlaywrightJsonReport = {};
    try {
      report = JSON.parse(stdout) as PlaywrightJsonReport;
    } catch {
      report = {};
    }
    return parsePlaywrightJson(report, artifactsDir);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @argus/core test src/runtime/playwright-runner.test.ts`
Expected: PASS (5 tests total).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/runtime/playwright-runner.ts packages/core/src/runtime/playwright-runner.test.ts
git commit -m "TRE-32: PlaywrightTestRunner (spawns json reporter, injectable exec)"
```

---

### Task 7: `PlaywrightBrowserSession`

**Files:**
- Create: `packages/core/src/runtime/playwright-session.ts`
- Test: `packages/core/src/runtime/playwright-session.test.ts`

- [ ] **Step 1: Write the implementation**

```ts
import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import type { BrowserSession, DomMatch } from '../tools/types';

const SNAPSHOT_LIMIT = 20000;

export class PlaywrightBrowserSession implements BrowserSession {
  constructor(private readonly page: Page) {}

  async navigate(url: string): Promise<void> {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
  }
  async click(selector: string): Promise<void> {
    await this.page.locator(selector).first().click();
  }
  async type(selector: string, text: string): Promise<void> {
    await this.page.locator(selector).first().fill(text);
  }
  async snapshot(): Promise<string> {
    const html = await this.page.content();
    return html.length > SNAPSHOT_LIMIT ? html.slice(0, SNAPSHOT_LIMIT) : html;
  }
  async query(selector: string): Promise<DomMatch[]> {
    return this.page.locator(selector).evaluateAll((els) =>
      els.slice(0, 20).map((el) => {
        const attributes: Record<string, string> = {};
        for (const a of Array.from(el.attributes)) attributes[a.name] = a.value;
        return { tag: el.tagName.toLowerCase(), text: (el.textContent ?? '').trim(), attributes };
      }),
    );
  }
  async testids(): Promise<string[]> {
    return this.page.$$eval('[data-testid]', (els) =>
      els.map((e) => e.getAttribute('data-testid') ?? '').filter(Boolean),
    );
  }
  url(): string {
    return this.page.url();
  }
}

export interface PlaywrightSessionHandle {
  session: PlaywrightBrowserSession;
  page: Page;
  close: () => Promise<void>;
}

/** Launch chromium and return a session + teardown. */
export async function createPlaywrightSession(
  opts: { headless?: boolean } = {},
): Promise<PlaywrightSessionHandle> {
  const browser: Browser = await chromium.launch({ headless: opts.headless ?? true });
  const context = await browser.newContext();
  const page = await context.newPage();
  return {
    session: new PlaywrightBrowserSession(page),
    page,
    close: () => browser.close(),
  };
}
```

- [ ] **Step 2: Write the integration test (self-skips without chromium)**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PlaywrightSessionHandle } from './playwright-session';

let handle: PlaywrightSessionHandle | undefined;
let available = false;

beforeAll(async () => {
  try {
    const { createPlaywrightSession } = await import('./playwright-session');
    handle = await createPlaywrightSession({ headless: true });
    available = true;
  } catch {
    available = false; // chromium not installed — skip the suite
  }
});

afterAll(async () => {
  await handle?.close();
});

const HTML = `
  <main data-testid="root">
    <h1 data-testid="title">Shop</h1>
    <input data-testid="q" />
    <button data-testid="go">Go</button>
  </main>`;

describe('PlaywrightBrowserSession (chromium)', () => {
  it.skipIf(!available)('lists data-testids', async () => {
    await handle!.page.setContent(HTML);
    expect((await handle!.session.testids()).sort()).toEqual(['go', 'q', 'root', 'title']);
  });

  it.skipIf(!available)('queries elements with tag/text/attributes', async () => {
    await handle!.page.setContent(HTML);
    const matches = await handle!.session.query('[data-testid="title"]');
    expect(matches[0]).toMatchObject({ tag: 'h1', text: 'Shop' });
    expect(matches[0]?.attributes['data-testid']).toBe('title');
  });

  it.skipIf(!available)('types and clicks via selectors', async () => {
    await handle!.page.setContent(HTML);
    await handle!.session.type('[data-testid="q"]', 'hello');
    expect(await handle!.page.inputValue('[data-testid="q"]')).toBe('hello');
    await handle!.session.click('[data-testid="go"]'); // no throw
  });

  it.skipIf(!available)('snapshots the page html', async () => {
    await handle!.page.setContent(HTML);
    expect(await handle!.session.snapshot()).toContain('data-testid="title"');
  });
});
```

- [ ] **Step 3: Install chromium, then run the test**

Run: `pnpm --filter @argus/core exec playwright install chromium`
Then: `pnpm --filter @argus/core test src/runtime/playwright-session.test.ts`
Expected: 4 tests PASS (or SKIP if the browser install was blocked — note which in the result).

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/runtime/playwright-session.ts packages/core/src/runtime/playwright-session.test.ts
git commit -m "TRE-32: real PlaywrightBrowserSession + createPlaywrightSession"
```

---

### Task 8: Barrels + package exports

**Files:**
- Create: `packages/core/src/agent/index.ts`, `packages/core/src/runtime/index.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/agent/exports.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import * as core from '../index';

describe('@argus/core agent + runtime exports', () => {
  it('exposes the agent loop and runtime classes', () => {
    for (const name of [
      'runAgentLoop',
      'createAnthropicClient',
      'ConsoleObserver',
      'PlaywrightBrowserSession',
      'createPlaywrightSession',
      'PlaywrightTestRunner',
      'parsePlaywrightJson',
    ]) {
      expect(name in core, name).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @argus/core test src/agent/exports.test.ts`
Expected: FAIL — names not in `core`.

- [ ] **Step 3: Write `agent/index.ts`**

```ts
export { createAnthropicClient } from './client';
export type { AnthropicLike } from './client';
export { ConsoleObserver } from './observer';
export type { AgentObserver, AgentStopReason } from './observer';
export { runAgentLoop } from './loop';
export type { AgentRunResult, RunAgentLoopOptions } from './loop';
```

- [ ] **Step 4: Write `runtime/index.ts`**

```ts
export {
  PlaywrightBrowserSession,
  createPlaywrightSession,
} from './playwright-session';
export type { PlaywrightSessionHandle } from './playwright-session';
export { PlaywrightTestRunner, parsePlaywrightJson } from './playwright-runner';
export type { Exec, ExecResult, PlaywrightJsonReport } from './playwright-runner';
```

- [ ] **Step 5: Append to `packages/core/src/index.ts`**

```ts

export * from './agent/index';
export * from './runtime/index';
```

- [ ] **Step 6: Run test + typecheck + full core suite**

Run: `pnpm --filter @argus/core test src/agent/exports.test.ts && pnpm --filter @argus/core typecheck && pnpm --filter @argus/core test`
Expected: exports test PASS; typecheck clean; all suites pass (browser test passes or skips).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/agent/index.ts packages/core/src/runtime/index.ts packages/core/src/index.ts packages/core/src/agent/exports.test.ts
git commit -m "TRE-32: agent + runtime barrels and package exports"
```

---

### Task 9: `argus smoke <url>` command

**Files:** Modify `packages/cli/src/index.ts`

- [ ] **Step 1: Add imports at the top of `index.ts`**

```ts
import {
  createAnthropicClient,
  createDefaultRegistry,
  createPlaywrightSession,
  ConsoleObserver,
  PlaywrightTestRunner,
  runAgentLoop,
  resolveModel,
} from '@argus/core';
```

- [ ] **Step 2: Add the command before `program.parse()`**

```ts
const PRICES: Record<string, { in: number; out: number }> = {
  'claude-opus-4-8': { in: 5, out: 25 },
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-haiku-4-5': { in: 1, out: 5 },
};

const SMOKE_SYSTEM =
  'You are exploring a web app to understand it. Use the browser and dom tools to ' +
  'navigate, snapshot the page, list its data-testid values, and try the primary flow ' +
  '(e.g. log in, then add an item to the cart). Report concisely what you found. ' +
  'Do not write any files.';

program
  .command('smoke')
  .argument('<url>', 'URL of the app under test (e.g. http://localhost:3100/login)')
  .option('--model <id>', 'model id (default: fast model)')
  .option('--headed', 'run with a visible browser')
  .option('--max-steps <n>', 'max agent steps', '8')
  .description('Run the agent loop against a URL and print a step trace + cost (needs ANTHROPIC_API_KEY + chromium)')
  .action(async (url: string, opts: { model?: string; headed?: boolean; maxSteps: string }) => {
    const model = opts.model ?? resolveModel('fast');
    const isOpusTier = /opus|sonnet-4-6|fable/.test(model);
    const { session, close } = await createPlaywrightSession({ headless: !opts.headed });
    try {
      const result = await runAgentLoop({
        client: createAnthropicClient(),
        system: SMOKE_SYSTEM,
        prompt: `Explore ${url} and report its pages, data-testids, and how the add-to-cart flow works.`,
        registry: createDefaultRegistry(),
        ctx: { workspaceRoot: process.cwd(), browser: session, runner: new PlaywrightTestRunner({ cwd: process.cwd() }) },
        model,
        thinking: isOpusTier, // adaptive thinking only on Opus-tier; Haiku would 400
        maxSteps: Number(opts.maxSteps),
        observer: new ConsoleObserver(),
      });
      console.log('\n--- result ---\n' + result.finalText);
      const price = PRICES[model];
      const cost = price
        ? `$${((result.usage.inputTokens / 1e6) * price.in + (result.usage.outputTokens / 1e6) * price.out).toFixed(4)}`
        : 'n/a';
      console.log(
        `\n[vigilis] ${result.steps} steps · ${result.usage.inputTokens} in / ${result.usage.outputTokens} out tokens · ~${cost} (${model})`,
      );
    } finally {
      await close();
    }
  });
```

- [ ] **Step 3: Build and verify the command surface**

Run: `pnpm --filter @argus/core build && pnpm --filter @argus/cli build && node packages/cli/dist/index.js smoke --help`
Expected: prints the `smoke` usage with `--model`, `--headed`, `--max-steps`. (Core must build first so the CLI resolves the new exports from dist.)

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/index.ts
git commit -m "TRE-32: argus smoke <url> — watch the loop run E2E"
```

---

### Task 10: Full verification + docs

**Files:** Modify `docs/ROADMAP.md`, `docs/STATUS.md`, `README.md` (smoke usage)

- [ ] **Step 1: Full canonical suite**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: all green (browser test passes if chromium installed, else skips).

- [ ] **Step 2: Sanity-check the built exports**

Run:
```bash
node --input-type=module -e "
import * as core from './packages/core/dist/index.js';
console.log(['runAgentLoop','createPlaywrightSession','PlaywrightTestRunner','ConsoleObserver','parsePlaywrightJson'].map(k=>k+'='+(k in core)).join(' '));
"
```
Expected: all `=true`.

- [ ] **Step 3: ROADMAP — mark TRE-32 done, TRE-33 next**

```markdown
| `TRE-32` | @argus/core: Claude agent loop (Messages API + tool-use orchestration) | ✅ |
| `TRE-33` | Generate behavior: explore app → emit runnable Playwright specs | 🔜 **next** |
```

- [ ] **Step 4: STATUS — update "continue right now", package inventory, add a "Done: TRE-32" section**

- Next ticket → `TRE-33` (Generate).
- `@argus/core` row: add the agent loop + real Playwright runtime.
- New "Done: `TRE-32`" subsection: `runAgentLoop`, observer seam, `PlaywrightBrowserSession`/`TestRunner`, `argus smoke`; note SDK upgraded to 0.104.1 + playwright added; adaptive thinking on Opus only.
- Add a "Try the E2E smoke run" note: fund API credit + `npx playwright install chromium`, then `pnpm --filter @argus/sample-shop dev` and `node --env-file=.env packages/cli/dist/index.js smoke http://localhost:3100/login`.

- [ ] **Step 5: README — add a short "Watch it run" smoke section** mirroring the STATUS note.

- [ ] **Step 6: Commit**

```bash
git add docs/ROADMAP.md docs/STATUS.md README.md
git commit -m "M1: agent loop + real ToolContext complete (TRE-32); docs point to TRE-33"
```

---

## Self-Review notes (author)

- **Spec coverage:** client+fakes (T2) · observer (T3) · loop incl. tool dispatch / maxSteps / refusal / thinking-effort gating (T4) · parser (T5) · runner (T6) · real session (T7) · exports (T8) · smoke command incl. Haiku thinking-gate + cost (T9) · verify+docs (T10). All §11 spec tests represented.
- **Type consistency:** `AnthropicLike` used by `createAnthropicClient`, `FakeAnthropicClient`, and `runAgentLoop`; `ToolContext`/`ToolResult`/`TestRunner`/`BrowserSession`/`DomMatch` reused from TRE-31 (`tools/types`); `AgentStopReason` shared by observer + loop result; `resolveModel` imported from the package root (already exported).
- **Known soft spots, with concrete fallbacks:** `makeMessage` uses `as unknown as Anthropic.Message` to avoid enumerating every `usage` field; `res.content` pushed as `Anthropic.ContentBlockParam[]` (cast in place) per the SDK's documented tool-use pattern; `registry.toAnthropic()` cast to `Anthropic.Tool[]`. If chromium can't be installed in this environment, T7's suite self-skips and `pnpm test` stays green — note that outcome rather than treating it as failure.
- **Deferred (not here):** real Generate prompt/context engineering (TRE-34), behaviors (TRE-33+), git tools (TRE-39), CI browser install (TRE-36).

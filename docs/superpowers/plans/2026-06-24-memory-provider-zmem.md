# MemoryProvider + ZMem (Governed Triage Memory) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional, swappable `MemoryProvider` seam to Vigilis so triage can recall and record prior verdicts (backed optionally by `zmem` CLI), without weakening the "never mask a real bug" guardrail.

**Architecture:** New `packages/core/src/memory/` module with `types.ts` (interfaces + NoopMemoryProvider), `zmem-provider.ts` (shells out to `zmem` via injected `Exec`, swallows all errors), and `index.ts` barrel. `triage()` gains an optional `memory?: MemoryProvider` that: (1) recalls prior verdicts and injects them as a clearly-fenced hint-only block in the system prompt, and (2) records the verdict post-run. Default is Noop — zero behavior change when memory is absent. CLI gains `--memory <off|auto|zmem>` on `triage` and `heal` commands. The module is exported from the core barrel but NEVER imported by `packages/core/src/agent/`.

**Tech Stack:** TypeScript, Vitest, Commander (CLI), Node `child_process` (via injected `Exec`), no new runtime dependencies.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `packages/core/src/memory/types.ts` | `Verdict`, `MemoryRecall`, `MemoryRecordEntry`, `MemoryProvider` interfaces + `NoopMemoryProvider` class |
| Create | `packages/core/src/memory/types.test.ts` | Unit tests for `NoopMemoryProvider` |
| Create | `packages/core/src/memory/zmem-provider.ts` | `ZMemProvider` class + `resolveMemoryProvider` factory |
| Create | `packages/core/src/memory/zmem-provider.test.ts` | Unit tests for `ZMemProvider` and `resolveMemoryProvider` with fake `Exec` |
| Create | `packages/core/src/memory/index.ts` | Barrel: re-exports everything from `types.ts` and `zmem-provider.ts` |
| Modify | `packages/core/src/index.ts` | Add `export * from './memory'` |
| Modify | `packages/core/src/behaviors/triage.ts` | Add optional `memory?: MemoryProvider` to `TriageOptions`; inject recall as fenced hint; record verdict post-run |
| Modify | `packages/core/src/behaviors/triage.test.ts` | Add two new test cases: Noop=no hint block; fake provider=hint block + record called |
| Modify | `packages/core/src/behaviors/index.ts` | No change needed (triage is already exported via `./triage`) |
| Modify | `packages/cli/src/config.ts` | Add `memory?: 'off' \| 'auto' \| 'zmem'` to `VigilisConfig` |
| Modify | `packages/cli/src/index.ts` | Add `--memory` option to `triage` and `heal` commands; build provider and pass to `triage()` |

---

## Task 1: `memory/types.ts` — interfaces + NoopMemoryProvider

**Files:**
- Create: `packages/core/src/memory/types.ts`
- Create: `packages/core/src/memory/types.test.ts`

### Background

`Verdict` in `triage.ts` is already `'real-bug' | 'dom-drift' | 'flake'` — we need the same type in memory. Rather than import from `triage.ts` (that would be a circular dependency direction we want to avoid), we define `Verdict` in `memory/types.ts` and the triage file can either re-use it or they stay separate (they're identical union strings, no shared state). For simplicity, define `Verdict` in `memory/types.ts` — it's just a string union. `triage.ts`'s existing `Verdict` interface (with `confidence` etc.) is a different shape — keep them separate, named clearly. The `MemoryRecordEntry.verdict` is the `Verdict` union type defined in this module.

- [ ] **Step 1: Write the failing test**

Create `/Users/piyushpathak/Work/argus/packages/core/src/memory/types.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { NoopMemoryProvider } from './types';

describe('NoopMemoryProvider', () => {
  it('recall always returns empty array', async () => {
    const provider = new NoopMemoryProvider();
    const result = await provider.recall({
      specPath: 'tests/login.spec.ts',
      url: 'http://localhost:3100/login',
      errorText: 'element not found',
    });
    expect(result).toEqual([]);
  });

  it('recall returns empty array with no errorText', async () => {
    const provider = new NoopMemoryProvider();
    const result = await provider.recall({
      specPath: 'tests/login.spec.ts',
      url: 'http://localhost:3100/login',
    });
    expect(result).toEqual([]);
  });

  it('record resolves without throwing', async () => {
    const provider = new NoopMemoryProvider();
    await expect(
      provider.record({
        specPath: 'tests/login.spec.ts',
        url: 'http://localhost:3100/login',
        verdict: 'dom-drift',
        rationale: 'testid changed',
        suggestedSelector: '[data-testid="new-btn"]',
      }),
    ).resolves.toBeUndefined();
  });

  it('record resolves for real-bug verdict', async () => {
    const provider = new NoopMemoryProvider();
    await expect(
      provider.record({
        specPath: 'tests/cart.spec.ts',
        url: 'http://localhost:3100/cart',
        verdict: 'real-bug',
        rationale: 'button is gone',
      }),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/piyushpathak/Work/argus/packages/core && npx vitest run src/memory/types.test.ts
```

Expected: FAIL with "Cannot find module './types'"

- [ ] **Step 3: Write the implementation**

Create `/Users/piyushpathak/Work/argus/packages/core/src/memory/types.ts`:

```typescript
/** Triage verdict values — the outcome of classifying a test failure. */
export type Verdict = 'real-bug' | 'dom-drift' | 'flake';

/**
 * A single prior governed memory recalled from the memory backend.
 * This is HINT ONLY — it is injected as prompt context and must never
 * directly branch decision logic.
 */
export interface MemoryRecall {
  verdict: Verdict;
  rationale: string;
  suggestedSelector?: string;
  /** Confidence value 0..1 from ZMem's trust model. */
  trust?: number;
  /**
   * Whether the memory backend has authorized this recall to influence the
   * decision. Always false for recalled data — the live DOM re-verification
   * and conservative classifier own the verdict.
   */
  authority?: boolean;
  /** ZMem/Treeship receipt ID for the remembered decision. */
  receiptId?: string;
}

/** An entry to propose recording in the memory backend after a verdict is reached. */
export interface MemoryRecordEntry {
  specPath: string;
  url: string;
  verdict: Verdict;
  rationale: string;
  suggestedSelector?: string;
  receiptId?: string;
}

/**
 * Swappable memory backend. Implementations must NEVER throw — all errors are
 * swallowed so a missing or broken backend never breaks a triage/heal run.
 */
export interface MemoryProvider {
  /**
   * Recall prior governed verdicts relevant to the failing spec/selector.
   * Returns empty array on any error or when no priors exist.
   * Result is HINT ONLY — inject as prompt context; never branch on it.
   */
  recall(query: {
    specPath: string;
    url: string;
    errorText?: string;
  }): Promise<MemoryRecall[]>;

  /**
   * Propose recording a new verdict in the memory backend.
   * The backend (ZMem) quarantines new entries per its own policy.
   * Resolves (no-op) on any error.
   */
  record(entry: MemoryRecordEntry): Promise<void>;
}

/**
 * Default no-op provider — recall always returns [], record is a no-op.
 * Used when no memory backend is configured; guarantees zero behavior change.
 */
export class NoopMemoryProvider implements MemoryProvider {
  async recall(_query: { specPath: string; url: string; errorText?: string }): Promise<MemoryRecall[]> {
    return [];
  }

  async record(_entry: MemoryRecordEntry): Promise<void> {
    // intentional no-op
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/piyushpathak/Work/argus/packages/core && npx vitest run src/memory/types.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
cd /Users/piyushpathak/Work/argus
git add packages/core/src/memory/types.ts packages/core/src/memory/types.test.ts
git commit -m "feat(memory): add MemoryProvider interface and NoopMemoryProvider (Task 1)"
```

---

## Task 2: `memory/zmem-provider.ts` — ZMemProvider + resolveMemoryProvider

**Files:**
- Create: `packages/core/src/memory/zmem-provider.ts`
- Create: `packages/core/src/memory/zmem-provider.test.ts`

### Background

`ZMemProvider` shells out to the `zmem` CLI using the same injected `Exec` pattern as the test runners (see `packages/core/src/runtime/exec.ts`). The constructor takes an optional `Exec` (defaulting to `defaultExec`) and a `cwd` string. All errors are swallowed — both `recall` and `record` return `[]` / resolve on any error, including non-JSON stdout. The exact `zmem` argv is isolated in two private methods (`recallArgv`, `recordArgv`) with a `// CONFIRM against \`zmem --help\`` comment. `resolveMemoryProvider` is a factory: `mode 'off'` → Noop, `mode 'zmem'` → ZMemProvider, `mode 'auto'` (default) → tries to detect `zmem` on PATH by running `zmem --version`, returns ZMemProvider if it exits 0, else Noop.

- [ ] **Step 1: Write the failing tests**

Create `/Users/piyushpathak/Work/argus/packages/core/src/memory/zmem-provider.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { ZMemProvider, resolveMemoryProvider } from './zmem-provider';
import { NoopMemoryProvider } from './types';
import type { Exec, ExecResult } from '../runtime/exec';

/** Build a fake Exec that returns canned responses per command. */
function makeExec(responses: Record<string, ExecResult>): Exec {
  return async (cmd, args, _opts) => {
    const key = [cmd, ...args].join(' ');
    // find first matching key (prefix match)
    const match = Object.keys(responses).find((k) => key.startsWith(k));
    if (match) return responses[match]!;
    return { stdout: '', stderr: 'not found', code: 1 };
  };
}

describe('ZMemProvider', () => {
  describe('recall', () => {
    it('parses valid JSON stdout into MemoryRecall[]', async () => {
      const recalls = [
        {
          verdict: 'dom-drift',
          rationale: 'testid changed from login-submit to submit-btn',
          suggestedSelector: '[data-testid="submit-btn"]',
          trust: 0.9,
        },
      ];
      const fakeExec = makeExec({
        'zmem recall': { stdout: JSON.stringify(recalls), stderr: '', code: 0 },
      });
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      const result = await provider.recall({
        specPath: 'tests/login.spec.ts',
        url: 'http://localhost:3100/login',
        errorText: 'locator not found',
      });
      expect(result).toHaveLength(1);
      expect(result[0]!.verdict).toBe('dom-drift');
      expect(result[0]!.rationale).toBe('testid changed from login-submit to submit-btn');
      expect(result[0]!.suggestedSelector).toBe('[data-testid="submit-btn"]');
      expect(result[0]!.trust).toBe(0.9);
      // authority must always default to false for recalled entries
      expect(result[0]!.authority).toBe(false);
    });

    it('returns [] on non-JSON stdout (zmem not installed or wrong output)', async () => {
      const fakeExec = makeExec({
        'zmem recall': { stdout: 'command not found: zmem', stderr: '', code: 127 },
      });
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      const result = await provider.recall({
        specPath: 'tests/login.spec.ts',
        url: 'http://localhost:3100',
      });
      expect(result).toEqual([]);
    });

    it('returns [] on empty stdout', async () => {
      const fakeExec = makeExec({
        'zmem recall': { stdout: '', stderr: '', code: 0 },
      });
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      const result = await provider.recall({ specPath: 'a.spec.ts', url: 'http://x' });
      expect(result).toEqual([]);
    });

    it('returns [] when exec throws', async () => {
      const throwingExec: Exec = async () => {
        throw new Error('ENOENT: zmem not found');
      };
      const provider = new ZMemProvider('/tmp/test', throwingExec);
      const result = await provider.recall({ specPath: 'a.spec.ts', url: 'http://x' });
      expect(result).toEqual([]);
    });

    it('returns [] on JSON that is not an array', async () => {
      const fakeExec = makeExec({
        'zmem recall': { stdout: JSON.stringify({ error: 'no results' }), stderr: '', code: 0 },
      });
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      const result = await provider.recall({ specPath: 'a.spec.ts', url: 'http://x' });
      expect(result).toEqual([]);
    });
  });

  describe('record', () => {
    it('calls exec with the record argv and resolves', async () => {
      const calls: Array<{ cmd: string; args: string[] }> = [];
      const fakeExec: Exec = async (cmd, args) => {
        calls.push({ cmd, args });
        return { stdout: '{"ok":true}', stderr: '', code: 0 };
      };
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      await provider.record({
        specPath: 'tests/login.spec.ts',
        url: 'http://localhost:3100/login',
        verdict: 'dom-drift',
        rationale: 'testid changed',
        suggestedSelector: '[data-testid="submit-btn"]',
      });
      expect(calls).toHaveLength(1);
      expect(calls[0]!.cmd).toBe('zmem');
    });

    it('resolves even when exec throws', async () => {
      const throwingExec: Exec = async () => {
        throw new Error('ENOENT');
      };
      const provider = new ZMemProvider('/tmp/test', throwingExec);
      await expect(
        provider.record({
          specPath: 'a.spec.ts',
          url: 'http://x',
          verdict: 'real-bug',
          rationale: 'broken',
        }),
      ).resolves.toBeUndefined();
    });

    it('resolves even when zmem exits non-zero', async () => {
      const fakeExec = makeExec({
        'zmem remember': { stdout: '', stderr: 'zmem: error', code: 1 },
      });
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      await expect(
        provider.record({
          specPath: 'a.spec.ts',
          url: 'http://x',
          verdict: 'flake',
          rationale: 'transient',
        }),
      ).resolves.toBeUndefined();
    });
  });
});

describe('resolveMemoryProvider', () => {
  it('returns NoopMemoryProvider when mode is off', async () => {
    const fakeExec: Exec = async () => ({ stdout: '', stderr: '', code: 0 });
    const provider = await resolveMemoryProvider('/tmp', { mode: 'off', exec: fakeExec });
    expect(provider).toBeInstanceOf(NoopMemoryProvider);
  });

  it('returns ZMemProvider when mode is zmem', async () => {
    const fakeExec: Exec = async () => ({ stdout: '', stderr: '', code: 0 });
    const provider = await resolveMemoryProvider('/tmp', { mode: 'zmem', exec: fakeExec });
    expect(provider).toBeInstanceOf(ZMemProvider);
  });

  it('returns ZMemProvider when mode is auto and zmem is on PATH', async () => {
    const fakeExec = makeExec({
      'zmem --version': { stdout: 'zmem 0.1.0', stderr: '', code: 0 },
    });
    const provider = await resolveMemoryProvider('/tmp', { mode: 'auto', exec: fakeExec });
    expect(provider).toBeInstanceOf(ZMemProvider);
  });

  it('returns NoopMemoryProvider when mode is auto and zmem is not on PATH', async () => {
    const fakeExec: Exec = async () => ({ stdout: '', stderr: 'not found', code: 127 });
    const provider = await resolveMemoryProvider('/tmp', { mode: 'auto', exec: fakeExec });
    expect(provider).toBeInstanceOf(NoopMemoryProvider);
  });

  it('returns NoopMemoryProvider when mode is auto and exec throws', async () => {
    const throwingExec: Exec = async () => {
      throw new Error('ENOENT');
    };
    const provider = await resolveMemoryProvider('/tmp', { mode: 'auto', exec: throwingExec });
    expect(provider).toBeInstanceOf(NoopMemoryProvider);
  });

  it('defaults to auto mode when no opts provided (uses real exec — returns a provider)', async () => {
    // We can't control the real exec, but we can confirm it returns a MemoryProvider
    const provider = await resolveMemoryProvider('/tmp');
    expect(provider).toBeDefined();
    // The provider must have recall and record methods
    expect(typeof provider.recall).toBe('function');
    expect(typeof provider.record).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/piyushpathak/Work/argus/packages/core && npx vitest run src/memory/zmem-provider.test.ts
```

Expected: FAIL with "Cannot find module './zmem-provider'"

- [ ] **Step 3: Write the implementation**

Create `/Users/piyushpathak/Work/argus/packages/core/src/memory/zmem-provider.ts`:

```typescript
import { defaultExec } from '../runtime/exec';
import type { Exec } from '../runtime/exec';
import type { MemoryProvider, MemoryRecall, MemoryRecordEntry } from './types';
import { NoopMemoryProvider } from './types';

/**
 * MemoryProvider backed by the `zmem` CLI (Zerker's local-first verifiable
 * memory for AI agents). All errors are swallowed — a missing or broken `zmem`
 * binary must never break a triage/heal run.
 *
 * Shells out via the injected `Exec` (same pattern as the test runners /
 * Treeship observer) so tests can inject a fake without spawning real processes.
 */
export class ZMemProvider implements MemoryProvider {
  constructor(
    private readonly cwd: string,
    private readonly exec: Exec = defaultExec,
  ) {}

  async recall(query: { specPath: string; url: string; errorText?: string }): Promise<MemoryRecall[]> {
    try {
      const { stdout } = await this.exec('zmem', this.recallArgv(query), { cwd: this.cwd });
      return this.parseRecalls(stdout);
    } catch {
      return [];
    }
  }

  async record(entry: MemoryRecordEntry): Promise<void> {
    try {
      await this.exec('zmem', this.recordArgv(entry), { cwd: this.cwd });
    } catch {
      // swallow — a broken zmem must never block a run
    }
  }

  // CONFIRM against `zmem --help` before shipping to production.
  // Reasonable guess: zmem recall --json --query <text> [--spec <path>] [--url <url>]
  private recallArgv(query: { specPath: string; url: string; errorText?: string }): string[] {
    const args = [
      'recall',
      '--json',
      '--query',
      [query.specPath, query.url, query.errorText].filter(Boolean).join(' '),
      '--spec',
      query.specPath,
      '--url',
      query.url,
    ];
    if (query.errorText) {
      args.push('--error', query.errorText);
    }
    return args;
  }

  // CONFIRM against `zmem --help` before shipping to production.
  // Reasonable guess: zmem remember --json --verdict <v> --rationale <r> [--selector <s>] --spec <path> --url <url>
  private recordArgv(entry: MemoryRecordEntry): string[] {
    const args = [
      'remember',
      '--json',
      '--spec',
      entry.specPath,
      '--url',
      entry.url,
      '--verdict',
      entry.verdict,
      '--rationale',
      entry.rationale,
    ];
    if (entry.suggestedSelector) {
      args.push('--selector', entry.suggestedSelector);
    }
    if (entry.receiptId) {
      args.push('--receipt-id', entry.receiptId);
    }
    return args;
  }

  /**
   * Parse `zmem recall --json` stdout into MemoryRecall[].
   * Tolerates non-JSON, empty, or non-array output → returns [].
   * Always sets `authority: false` on parsed entries (recalled memory is hint only).
   */
  private parseRecalls(stdout: string): MemoryRecall[] {
    const trimmed = stdout.trim();
    if (!trimmed) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return [];
    }
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is Record<string, unknown> =>
          item !== null && typeof item === 'object' && !Array.isArray(item),
      )
      .map((item) => ({
        verdict: item['verdict'] as MemoryRecall['verdict'],
        rationale: String(item['rationale'] ?? ''),
        suggestedSelector:
          typeof item['suggestedSelector'] === 'string' ? item['suggestedSelector'] : undefined,
        trust: typeof item['trust'] === 'number' ? item['trust'] : undefined,
        authority: false, // recalled memory is NEVER authoritative
        receiptId: typeof item['receiptId'] === 'string' ? item['receiptId'] : undefined,
      }));
  }
}

/**
 * Build the appropriate MemoryProvider for the given mode:
 * - 'off'  → NoopMemoryProvider
 * - 'zmem' → ZMemProvider (always, regardless of PATH)
 * - 'auto' → ZMemProvider if `zmem` resolves on PATH, else NoopMemoryProvider
 *
 * Best-effort detection for 'auto': if unsure, default to Noop so behavior
 * is unchanged when zmem is absent.
 */
export async function resolveMemoryProvider(
  cwd: string,
  opts: { mode?: 'off' | 'auto' | 'zmem'; exec?: Exec } = {},
): Promise<MemoryProvider> {
  const { mode = 'auto', exec = defaultExec } = opts;

  if (mode === 'off') return new NoopMemoryProvider();
  if (mode === 'zmem') return new ZMemProvider(cwd, exec);

  // 'auto': probe zmem by running `zmem --version`
  try {
    const result = await exec('zmem', ['--version'], { cwd });
    if (result.code === 0) return new ZMemProvider(cwd, exec);
  } catch {
    // zmem not on PATH or exec threw — fall through to Noop
  }
  return new NoopMemoryProvider();
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/piyushpathak/Work/argus/packages/core && npx vitest run src/memory/zmem-provider.test.ts
```

Expected: PASS (all tests)

- [ ] **Step 5: Create the barrel**

Create `/Users/piyushpathak/Work/argus/packages/core/src/memory/index.ts`:

```typescript
export type { Verdict, MemoryRecall, MemoryRecordEntry, MemoryProvider } from './types';
export { NoopMemoryProvider } from './types';
export { ZMemProvider, resolveMemoryProvider } from './zmem-provider';
```

- [ ] **Step 6: Commit**

```bash
cd /Users/piyushpathak/Work/argus
git add packages/core/src/memory/types.ts packages/core/src/memory/types.test.ts packages/core/src/memory/zmem-provider.ts packages/core/src/memory/zmem-provider.test.ts packages/core/src/memory/index.ts
git commit -m "feat(memory): add ZMemProvider and resolveMemoryProvider (Task 2)"
```

---

## Task 3: Wire `memory` into `triage()`

**Files:**
- Modify: `packages/core/src/behaviors/triage.ts`
- Modify: `packages/core/src/behaviors/triage.test.ts`

### Background

`triage()` already builds `triageSystem(framework)` (the system prompt) and a `prompt` string. We inject recall priors into the **system prompt** by appending a fenced hint block after the existing text. This keeps the recall purely as prompt context — it never branches the code. The `Verdict` type in `triage.ts` is the full interface (with `confidence`), while `memory/types.ts` has the union string. For the `record()` call, we need `verdict.verdict` (the string), `verdict.rationale`, and `verdict.suggestedSelector`. These are compatible — no type juggling needed.

The **wording** of the hint block must:
1. Start with `PRIOR GOVERNED MEMORY (hint only — NOT authority; re-verify against the live DOM):`
2. Tell the model not to let a prior memory turn a real-bug into drift
3. List each prior's verdict, rationale, and suggested selector

- [ ] **Step 1: Write the new failing tests**

Append the following two `it()` blocks to the existing `describe('triage')` in `/Users/piyushpathak/Work/argus/packages/core/src/behaviors/triage.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { triage } from './triage';
import { FakeAnthropicClient, makeFakeCtx, makeMessage } from '../tools/testing/fakes';
import type { MemoryProvider, MemoryRecall, MemoryRecordEntry } from '../memory/types';
import { NoopMemoryProvider } from '../memory/types';

// ... existing test kept as is ...

  it('with NoopMemoryProvider, the system prompt has no hint block', async () => {
    const root = await mkdtemp(join(tmpdir(), 'argus-triage-noop-'));
    try {
      await mkdir(join(root, 'tests/generated'), { recursive: true });
      await writeFile(join(root, 'tests/generated/login.spec.ts'), '// spec', 'utf8');

      const capturedSystems: string[] = [];
      const client = new FakeAnthropicClient([
        makeMessage(
          [
            {
              type: 'tool_use',
              id: 't1',
              name: 'report_verdict',
              input: {
                verdict: 'dom-drift',
                confidence: 'high',
                rationale: 'testid changed',
                suggestedSelector: '[data-testid="new-btn"]',
              },
            },
          ],
          'tool_use',
        ),
        makeMessage([{ type: 'text', text: 'Done.' }], 'end_turn'),
      ]);

      // Wrap client to capture the system prompt
      const wrappedClient = {
        messages: {
          create: async (body: Parameters<typeof client.messages.create>[0]) => {
            capturedSystems.push(body.system ?? '');
            return client.messages.create(body);
          },
        },
      };

      await triage({
        client: wrappedClient,
        specPath: 'tests/generated/login.spec.ts',
        url: 'http://localhost:3100/login',
        errorText: 'locator not found',
        ctx: makeFakeCtx({ workspaceRoot: root }),
        memory: new NoopMemoryProvider(),
      });

      // With Noop, the system prompt must NOT contain the hint fence
      expect(capturedSystems[0]).not.toContain('PRIOR GOVERNED MEMORY');
      expect(capturedSystems[0]).not.toContain('NOT authority');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('with a fake provider returning one prior, the system prompt contains the hint fence and record is called', async () => {
    const root = await mkdtemp(join(tmpdir(), 'argus-triage-fake-'));
    try {
      await mkdir(join(root, 'tests/generated'), { recursive: true });
      await writeFile(join(root, 'tests/generated/login.spec.ts'), '// spec', 'utf8');

      const capturedSystems: string[] = [];
      const recordedEntries: MemoryRecordEntry[] = [];

      const fakePrior: MemoryRecall = {
        verdict: 'dom-drift',
        rationale: 'testid was login-submit, is now submit-btn',
        suggestedSelector: '[data-testid="submit-btn"]',
        trust: 0.85,
        authority: false,
      };

      const fakeProvider: MemoryProvider = {
        recall: async (_query) => [fakePrior],
        record: async (entry) => {
          recordedEntries.push(entry);
        },
      };

      const client = new FakeAnthropicClient([
        makeMessage(
          [
            {
              type: 'tool_use',
              id: 't1',
              name: 'report_verdict',
              input: {
                verdict: 'dom-drift',
                confidence: 'high',
                rationale: 'testid changed',
                suggestedSelector: '[data-testid="submit-btn"]',
              },
            },
          ],
          'tool_use',
        ),
        makeMessage([{ type: 'text', text: 'Done.' }], 'end_turn'),
      ]);

      const wrappedClient = {
        messages: {
          create: async (body: Parameters<typeof client.messages.create>[0]) => {
            capturedSystems.push(body.system ?? '');
            return client.messages.create(body);
          },
        },
      };

      const result = await triage({
        client: wrappedClient,
        specPath: 'tests/generated/login.spec.ts',
        url: 'http://localhost:3100/login',
        errorText: 'locator not found',
        ctx: makeFakeCtx({ workspaceRoot: root }),
        memory: fakeProvider,
      });

      // System prompt must contain the hint fence
      expect(capturedSystems[0]).toContain('PRIOR GOVERNED MEMORY');
      expect(capturedSystems[0]).toContain('NOT authority');
      expect(capturedSystems[0]).toContain('re-verify against the live DOM');
      expect(capturedSystems[0]).toContain('dom-drift');
      expect(capturedSystems[0]).toContain('testid was login-submit, is now submit-btn');

      // record must have been called once with the verdict
      expect(recordedEntries).toHaveLength(1);
      expect(recordedEntries[0]!.verdict).toBe('dom-drift');
      expect(recordedEntries[0]!.rationale).toBe('testid changed');
      expect(recordedEntries[0]!.specPath).toBe('tests/generated/login.spec.ts');
      expect(recordedEntries[0]!.url).toBe('http://localhost:3100/login');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
```

- [ ] **Step 2: Run test to verify new tests fail (existing test still passes)**

```bash
cd /Users/piyushpathak/Work/argus/packages/core && npx vitest run src/behaviors/triage.test.ts
```

Expected: 1 pass (existing), 2 fail (new — `memory` not in `TriageOptions` yet)

- [ ] **Step 3: Modify `triage.ts` to add memory integration**

Replace the content of `/Users/piyushpathak/Work/argus/packages/core/src/behaviors/triage.ts` with:

```typescript
import { resolveModel } from '../index';
import { runAgentLoop, type AgentRunResult } from '../agent/loop';
import type { AnthropicLike } from '../agent/client';
import type { AgentObserver } from '../agent/observer';
import type { ToolContext } from '../tools/types';
import { createDefaultRegistry } from '../tools/definitions';
import { reportVerdict } from '../tools/definitions/report';
import type { MemoryProvider } from '../memory/types';
import { NoopMemoryProvider } from '../memory/types';

export interface Verdict {
  verdict: 'real-bug' | 'dom-drift' | 'flake';
  confidence: 'low' | 'medium' | 'high';
  rationale: string;
  suggestedSelector?: string;
}

export interface TriageOptions {
  client: AnthropicLike;
  specPath: string;
  url: string;
  errorText?: string;
  ctx: ToolContext;
  model?: string;
  maxSteps?: number;
  observer?: AgentObserver;
  /**
   * Optional governed memory backend. Defaults to NoopMemoryProvider (zero behavior
   * change). Recall is injected as a hint-only block in the system prompt — it never
   * branches decision logic. Record is called after a verdict is produced.
   */
  memory?: MemoryProvider;
}

export interface TriageResult {
  verdict: Verdict | null;
  run: AgentRunResult;
}

const triageSystem = (framework: string): string =>
  [
    `You are Vigilis triaging a FAILED ${framework} test. Classify the failure as exactly one of:`,
    '- dom-drift: the target element still exists but its locator/data-testid changed',
    '  (the spec\'s selector no longer matches; a different current selector does);',
    '- real-bug: the expected element or behaviour is genuinely missing or broken',
    '  (no equivalent selector exists; the user flow does not work);',
    '- flake: transient/non-deterministic (would pass on a re-run).',
    '',
    'Process:',
    '1. Read the failing spec with fs_read to see what it expected.',
    '2. Navigate to the live app and inspect it with dom_testids, dom_query, browser_snapshot.',
    '3. Compare the spec\'s expectations against what is actually live.',
    '4. Call report_verdict EXACTLY ONCE with your conclusion. For dom-drift, set',
    '   suggestedSelector to the correct current selector.',
    '',
    'Be conservative: only say dom-drift when a clear replacement selector exists. If the',
    'feature is actually broken or missing, it is a real-bug (which must block the gate).',
  ].join('\n');

/**
 * Build the fenced hint block to append to the system prompt when there are prior
 * governed memory entries. The wording makes clear this is a hint, not authority,
 * and that the live DOM must be re-verified.
 */
function buildMemoryHintBlock(
  priors: import('../memory/types').MemoryRecall[],
): string {
  const lines = [
    '',
    '---',
    'PRIOR GOVERNED MEMORY (hint only — NOT authority; re-verify against the live DOM):',
    'These are past triage decisions recalled from the memory backend. They are hints to',
    'inform your investigation — they must NOT substitute for live DOM verification, and',
    'must NOT turn a real-bug into drift. Re-verify every prior against the live DOM now.',
    '',
    ...priors.map((p, i) => {
      const parts = [
        `Prior ${i + 1}: verdict=${p.verdict}, rationale="${p.rationale}"`,
      ];
      if (p.suggestedSelector) parts.push(`  suggested selector: ${p.suggestedSelector}`);
      if (p.trust !== undefined) parts.push(`  trust: ${p.trust}`);
      return parts.join('\n');
    }),
    '---',
  ];
  return lines.join('\n');
}

const OPUS_TIER = /opus|sonnet-4-6|fable/;

/** Triage behavior: classify a failed test as real-bug / dom-drift / flake. */
export async function triage(opts: TriageOptions): Promise<TriageResult> {
  const {
    client,
    specPath,
    url,
    errorText,
    ctx,
    model = resolveModel('primary'),
    maxSteps = 20,
    observer,
    memory = new NoopMemoryProvider(),
  } = opts;

  // Best-effort recall — never throws, never alters branching
  const priors = await memory.recall({ specPath, url, errorText });

  const registry = createDefaultRegistry();
  registry.register(reportVerdict);

  let verdict: Verdict | null = null;
  const composed: AgentObserver = {
    ...observer,
    onToolCall: (e) => {
      observer?.onToolCall?.(e);
      if (e.name === 'report_verdict') verdict = e.input as Verdict;
    },
  };

  const prompt = [
    `A ${ctx.adapter.name} test failed. Spec: ${specPath}. App under test: ${url}.`,
    errorText ? `Failure: ${errorText}` : 'Failure message unavailable.',
    'Triage it and call report_verdict.',
  ].join('\n');

  // Inject priors as a hint-only block into the system prompt (prompt context only —
  // no branching on recall content). With the default Noop, priors is [] and the
  // system prompt is byte-identical to today's behavior.
  const systemWithHint =
    priors.length > 0
      ? triageSystem(ctx.adapter.name) + buildMemoryHintBlock(priors)
      : triageSystem(ctx.adapter.name);

  const run = await runAgentLoop({
    client,
    system: systemWithHint,
    prompt,
    registry,
    ctx,
    model,
    thinking: OPUS_TIER.test(model),
    maxSteps,
    observer: composed,
  });

  // Best-effort record — never throws, never alters the returned result
  if (verdict) {
    await memory.record({
      specPath,
      url,
      verdict: verdict.verdict,
      rationale: verdict.rationale,
      suggestedSelector: verdict.suggestedSelector,
    });
  }

  return { verdict, run };
}
```

- [ ] **Step 4: Run all triage tests to verify all 3 pass**

```bash
cd /Users/piyushpathak/Work/argus/packages/core && npx vitest run src/behaviors/triage.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Verify boundary — agent/ must not import memory/**

```bash
grep -rn "memory/" /Users/piyushpathak/Work/argus/packages/core/src/agent
```

Expected: empty output (no matches)

- [ ] **Step 6: Commit**

```bash
cd /Users/piyushpathak/Work/argus
git add packages/core/src/behaviors/triage.ts packages/core/src/behaviors/triage.test.ts
git commit -m "feat(triage): wire optional MemoryProvider — recall hint + post-verdict record (Task 3)"
```

---

## Task 4: Export from core barrel + CLI wiring

**Files:**
- Modify: `packages/core/src/index.ts`
- Modify: `packages/cli/src/config.ts`
- Modify: `packages/cli/src/index.ts`

### Background

The core barrel (`packages/core/src/index.ts`) currently has `export * from './behaviors/index'` and others — add `export * from './memory'`. Importantly, this is exported from the core barrel, NOT from `packages/core/src/agent/index.ts`. The CLI imports from `@argus/core`, so the new exports will be available. In the CLI, `resolveMemoryProvider` needs the cwd and mode. Both `triage` and `heal` commands call `triage()` — add `--memory` to both. The `heal` command currently calls `triage()` directly inside its action.

- [ ] **Step 1: Export memory from core barrel**

Edit `/Users/piyushpathak/Work/argus/packages/core/src/index.ts` — append after the last `export *` line:

```typescript
export * from './memory';
```

The file should look like:

```typescript
/**
 * @argus/core — the agent core and shared Tool Registry.
 *
 * Exposes model config and the QA Tool Registry (TRE-31). The agent loop
 * (TRE-32) and behaviors (TRE-33+) land later in M1.
 */

/** Default Claude models, overridable via environment variables. */
export const MODELS = {
  /** Deep-reasoning model used for generate + triage. */
  primary: process.env.ARGUS_MODEL_PRIMARY ?? 'claude-opus-4-8',
  /** Cheaper model used for lightweight steps. */
  fast: process.env.ARGUS_MODEL_FAST ?? 'claude-haiku-4-5',
} as const;

export type ModelTier = keyof typeof MODELS;

/** Resolve a model id for the given tier. */
export function resolveModel(tier: ModelTier = 'primary'): string {
  return MODELS[tier];
}

export * from './tools/index';
export * from './agent/index';
export * from './runtime/index';
export * from './behaviors/index';
export * from './framework';
export * from './memory';
```

- [ ] **Step 2: Check for Verdict name collision**

The `memory/types.ts` exports `Verdict` as a type alias. The `behaviors/triage.ts` exports `Verdict` as an interface. Both are re-exported from the core barrel. This will cause a name collision at the barrel level. Fix: in `packages/core/src/memory/index.ts`, do NOT re-export `Verdict` from memory (it's already exported from behaviors). Instead, only export the other types and classes:

Edit `/Users/piyushpathak/Work/argus/packages/core/src/memory/index.ts`:

```typescript
// Note: Verdict is intentionally NOT re-exported here — it is already exported
// from behaviors/triage.ts via the behaviors barrel. The Verdict type in
// memory/types.ts is the same string union used internally; callers use the
// one from behaviors.
export type { MemoryRecall, MemoryRecordEntry, MemoryProvider } from './types';
export { NoopMemoryProvider } from './types';
export { ZMemProvider, resolveMemoryProvider } from './zmem-provider';
```

- [ ] **Step 3: Check that the core build is clean after barrel change**

```bash
cd /Users/piyushpathak/Work/argus/packages/core && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Add `memory` field to `VigilisConfig`**

Edit `/Users/piyushpathak/Work/argus/packages/cli/src/config.ts`. Add the field to the interface:

```typescript
export interface VigilisConfig {
  /** Base URL the app under test is served from. */
  baseUrl: string;
  /** Directory where Playwright specs live / are written. */
  testDir: string;
  /** Default model id for generate/triage/heal. */
  model: string;
  /** Whether `heal` opens a PR for a verified fix. */
  openPr: boolean;
  /** Whether a Treeship provenance receipt is produced. */
  receipt: boolean;
  /** Chosen framework; omit to auto-detect. */
  framework?: 'playwright' | 'cypress' | 'selenium';
  /**
   * Memory backend mode for triage and heal.
   * 'off'  — no memory backend; identical to pre-memory behavior.
   * 'auto' — use zmem if it is on PATH, else no-op (default).
   * 'zmem' — always use the zmem CLI.
   */
  memory?: 'off' | 'auto' | 'zmem';
}
```

- [ ] **Step 5: Add `--memory` option and provider construction to CLI triage command**

Edit `/Users/piyushpathak/Work/argus/packages/cli/src/index.ts`. Add `resolveMemoryProvider` to the import from `@argus/core`:

```typescript
import {
  composeObservers,
  ConsoleObserver,
  createAnthropicClient,
  createDefaultRegistry,
  createHealPr,
  createPlaywrightSession,
  createTreeshipObserver,
  extractFailures,
  type Framework,
  generate,
  heal,
  resolveAdapter,
  resolveMemoryProvider,
  resolveModel,
  runAgentLoop,
  triage,
} from '@argus/core';
```

Then update the `triage` command — add `--memory` option and update the action opts type and body:

The `.option(...)` chain for `triage` command should gain:
```typescript
.option('--memory <mode>', 'memory backend: off | auto | zmem (default: auto)')
```

The opts type becomes:
```typescript
opts: { spec?: string; error?: string; report?: string; model?: string; framework?: string; memory?: string }
```

Inside the action, before calling `triage()`, add:
```typescript
const memoryMode = (opts.memory ?? (cfg.found ? cfg.config.memory : undefined) ?? 'auto') as 'off' | 'auto' | 'zmem';
const memoryProvider = await resolveMemoryProvider(process.cwd(), { mode: memoryMode });
```

Then pass `memory: memoryProvider` to the `triage()` call:
```typescript
const result = await triage({
  client: createAnthropicClient(),
  specPath,
  url,
  errorText,
  ctx: { workspaceRoot: process.cwd(), browser: session, runner, adapter },
  model,
  observer: new ConsoleObserver(),
  memory: memoryProvider,
});
```

- [ ] **Step 6: Add `--memory` option to the `heal` command and thread it through**

The `heal` command also calls `triage()` internally. Add `--memory` option and thread the provider through:

Add the option:
```typescript
.option('--memory <mode>', 'memory backend: off | auto | zmem (default: auto)')
```

Update opts type to add `memory?: string`.

Inside the action, add memory provider construction (before the `triage()` call):
```typescript
const memoryMode = (opts.memory ?? (cfg.found ? cfg.config.memory : undefined) ?? 'auto') as 'off' | 'auto' | 'zmem';
const memoryProvider = await resolveMemoryProvider(process.cwd(), { mode: memoryMode });
```

Pass `memory: memoryProvider` to the `triage()` call inside heal.

- [ ] **Step 7: Build and run all tests**

```bash
cd /Users/piyushpathak/Work/argus && pnpm -r build && pnpm -r test
```

Expected: all green

- [ ] **Step 8: Verify the boundary is clean**

```bash
grep -rn "memory/" /Users/piyushpathak/Work/argus/packages/core/src/agent
```

Expected: empty output

- [ ] **Step 9: TypeScript check**

```bash
cd /Users/piyushpathak/Work/argus/packages/core && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 10: Commit**

```bash
cd /Users/piyushpathak/Work/argus
git add packages/core/src/index.ts packages/core/src/memory/index.ts packages/cli/src/config.ts packages/cli/src/index.ts
git commit -m "feat: export memory/ from core barrel; add --memory flag to CLI triage+heal (Task 4)"
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Covered by |
|---|---|
| `Verdict`, `MemoryRecall`, `MemoryRecordEntry`, `MemoryProvider` types | Task 1 — `types.ts` |
| `NoopMemoryProvider` — recall→[], record→noop | Task 1 |
| `ZMemProvider` over injected `Exec` | Task 2 |
| Both recall and record swallow ALL errors → []/ resolve | Task 2 tests (throwing exec, non-JSON, non-zero exit) |
| `authority: false` on parsed recalls | Task 2 — `parseRecalls` |
| `zmem` argv in ONE private method each with CONFIRM comment | Task 2 — `recallArgv`, `recordArgv` |
| Parsing tolerates non-JSON / empty stdout → [] | Task 2 tests |
| `resolveMemoryProvider`: off→Noop, zmem→ZMem, auto→detect | Task 2 |
| `MemoryProvider` added to `TriageOptions` (default Noop) | Task 3 |
| Recall injected as fenced hint block in system prompt | Task 3 — `buildMemoryHintBlock` |
| Hint block includes "not authority" and "re-verify" wording | Task 3 |
| Record called after verdict | Task 3 |
| With Noop, prompt is byte-identical to today | Task 3 test |
| With fake provider, hint block present and record called | Task 3 test |
| Export from core barrel (not agent) | Task 4 |
| `--memory <off\|auto\|zmem>` on triage and heal commands | Task 4 |
| `memory?` field on `VigilisConfig` | Task 4 |

### Potential issue: `Verdict` type collision

`memory/types.ts` exports `Verdict` and `behaviors/triage.ts` also exports `Verdict`. Both go into the core barrel. The plan handles this in Task 4, Step 2 by removing `Verdict` from the memory barrel export. This is the right fix.

### Placeholder scan

No TBDs or TODOs in the code steps. All argv is shown. All test assertions are concrete.

### Type consistency check

- `MemoryRecall` in `types.ts` uses `Verdict` (string union) for `.verdict` — consistent with `MemoryRecordEntry`
- `triage()` uses `verdict.verdict` (string) when calling `memory.record()` — matches `MemoryRecordEntry.verdict: Verdict` (string union). Correct.
- `resolveMemoryProvider` returns `Promise<MemoryProvider>` — consistent with how CLI uses `await resolveMemoryProvider(...)`
- `ZMemProvider` constructor: `(cwd: string, exec: Exec = defaultExec)` — test uses `new ZMemProvider('/tmp/test', fakeExec)`. Consistent.

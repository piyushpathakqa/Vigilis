# ZMem Adapter — Align to Confirmed CLI (inject/propose) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the `ZMemProvider` in `packages/core` to match the real `zmem` CLI (confirmed live: `inject`/`propose`, JSON object response with `memories[]` array) and update all types and tests accordingly.

**Architecture:** Three files change: (1) `types.ts` — `MemoryRecall` gets a flat free-text shape instead of structured verdict fields; (2) `zmem-provider.ts` — argv builders and parser rewritten to the confirmed CLI; (3) `triage.ts` — `buildMemoryHintBlock` and the filter expression updated to the new shape. All tests are rewritten alongside each source file (TDD order: failing test first, then implementation).

**Tech Stack:** TypeScript 5, Vitest, pnpm monorepo, `zmem` CLI (v0.x), Node.js `child_process` (via injected `Exec` abstraction already in codebase).

---

## File Map

| File | Action | What changes |
|---|---|---|
| `packages/core/src/memory/types.ts` | Modify | `MemoryRecall` interface — replace `verdict/rationale/suggestedSelector/authority` with `content/trust/authority/memoryId/receiptId` |
| `packages/core/src/memory/types.test.ts` | Modify | Remove assertions on old `MemoryRecall` fields; `NoopMemoryProvider` tests are unchanged (no shape dependency) |
| `packages/core/src/memory/zmem-provider.ts` | Modify | `recallArgv` → `inject` positional; `recordArgv` → `propose` positional; `parseRecalls` → object with `memories[]`; drop `VALID_VERDICTS` |
| `packages/core/src/memory/zmem-provider.test.ts` | Modify | Full rewrite of recall/record argv + parse tests to confirmed CLI shape |
| `packages/core/src/behaviors/triage.ts` | Modify | `buildMemoryHintBlock` per-prior line; filter on `p.content?.trim()` |
| `packages/core/src/behaviors/triage.test.ts` | Modify | `fakePrior` shape + system-prompt assertion strings |

**Do NOT touch:**
- `apps/sample-shop/src/app/login/page.tsx`
- `tests/generated/login.spec.ts`
- `packages/core/src/memory/index.ts` (no exports change)
- Any file not listed above

---

## Task 1: Update `MemoryRecall` type + its test

**Files:**
- Modify: `packages/core/src/memory/types.ts`
- Modify: `packages/core/src/memory/types.test.ts`

### Step 1.1 — Write a failing test that asserts the new `MemoryRecall` shape

The new shape: `content: string`, `trust?: number`, `authority?: string`, `memoryId?: string`, `receiptId?: string`.

Open `packages/core/src/memory/types.test.ts` and **replace** the entire file with:

```typescript
import { describe, it, expect } from 'vitest';
import { NoopMemoryProvider } from './types';
import type { MemoryRecall } from './types';

describe('MemoryRecall type shape', () => {
  it('accepts a full recall object from zmem inject response', () => {
    const recall: MemoryRecall = {
      content: 'verdict=dom-drift: testid changed | selector=[data-testid="submit-btn"] | spec=tests/login.spec.ts',
      trust: 0.9,
      authority: 'medium',
      memoryId: 'mem_2386db3713eb4338',
      receiptId: 'act_abc123',
    };
    expect(recall.content).toContain('dom-drift');
    expect(recall.trust).toBe(0.9);
    expect(recall.authority).toBe('medium');
    expect(recall.memoryId).toBe('mem_2386db3713eb4338');
    expect(recall.receiptId).toBe('act_abc123');
  });

  it('accepts a minimal recall object (only content required)', () => {
    const recall: MemoryRecall = { content: 'some remembered text' };
    expect(recall.content).toBe('some remembered text');
    expect(recall.trust).toBeUndefined();
    expect(recall.authority).toBeUndefined();
    expect(recall.memoryId).toBeUndefined();
    expect(recall.receiptId).toBeUndefined();
  });
});

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

- [ ] **Step 1.2 — Run the test to confirm it fails**

```bash
cd /Users/piyushpathak/Work/argus && pnpm --filter @argus/core exec vitest run src/memory/types.test.ts 2>&1
```

Expected: TypeScript errors or test failures on the `MemoryRecall` shape assertions (old interface has `verdict` not `content`).

- [ ] **Step 1.3 — Update `MemoryRecall` in `types.ts`**

Open `packages/core/src/memory/types.ts`. Replace the `MemoryRecall` interface (lines 9–23) with:

```typescript
/**
 * A single prior governed memory recalled from the memory backend (zmem inject).
 * `content` is the opaque free-text recalled string from zmem — it is HINT ONLY.
 * It must never directly branch decision logic; inject as prompt context only.
 */
export interface MemoryRecall {
  /** The remembered text recalled from zmem (free-form string). */
  content: string;
  /** Confidence value 0..1 from zmem's trust model. */
  trust?: number;
  /** zmem authority level: none | low | medium | high. */
  authority?: string;
  /** zmem memory id (e.g. mem_2386db3713eb4338). */
  memoryId?: string;
  /** zmem inject action_id — the receipt for this recall. */
  receiptId?: string;
}
```

Keep everything else in the file unchanged (`Verdict`, `MemoryRecordEntry`, `MemoryProvider`, `NoopMemoryProvider`).

- [ ] **Step 1.4 — Run the test again to confirm it passes**

```bash
cd /Users/piyushpathak/Work/argus && pnpm --filter @argus/core exec vitest run src/memory/types.test.ts 2>&1
```

Expected: all tests pass (5 tests).

- [ ] **Step 1.5 — Run TypeScript check for just this file**

```bash
cd /Users/piyushpathak/Work/argus/packages/core && npx tsc --noEmit 2>&1 | head -40
```

Expected: errors appear at this point (zmem-provider.ts and triage.ts still reference old fields) — that's fine; we'll fix them in Tasks 2 and 3.

---

## Task 2: Rewrite `ZMemProvider` + its test

**Files:**
- Modify: `packages/core/src/memory/zmem-provider.ts`
- Modify: `packages/core/src/memory/zmem-provider.test.ts`

### Step 2.1 — Write failing tests for the new argv/parser

Replace the entire `packages/core/src/memory/zmem-provider.test.ts` with:

```typescript
import { describe, it, expect } from 'vitest';
import { ZMemProvider, resolveMemoryProvider } from './zmem-provider';
import { NoopMemoryProvider } from './types';
import type { Exec, ExecResult } from '../runtime/exec';

/** Build a fake Exec that returns canned responses per command (prefix match). */
function makeExec(responses: Record<string, ExecResult>): Exec {
  return async (cmd, args, _opts) => {
    const key = [cmd, ...args].join(' ');
    const match = Object.keys(responses).find((k) => key.startsWith(k));
    if (match) return responses[match]!;
    return { stdout: '', stderr: 'not found', code: 1 };
  };
}

describe('ZMemProvider', () => {
  describe('recall — argv', () => {
    it('calls zmem inject with positional task text and correct flags', async () => {
      const calls: Array<{ cmd: string; args: string[] }> = [];
      const fakeExec: Exec = async (cmd, args) => {
        calls.push({ cmd, args });
        return { stdout: JSON.stringify({ action_id: 'act_1', memories: [], withheld: [] }), stderr: '', code: 0 };
      };
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      await provider.recall({ specPath: 'tests/login.spec.ts', url: 'http://localhost:3100/login', errorText: 'locator not found' });

      expect(calls).toHaveLength(1);
      expect(calls[0]!.cmd).toBe('zmem');
      expect(calls[0]!.args[0]).toBe('inject');
      // positional task text (args[1]) includes the specPath and errorText
      expect(calls[0]!.args[1]).toContain('tests/login.spec.ts');
      expect(calls[0]!.args[1]).toContain('locator not found');
      // remaining flags
      expect(calls[0]!.args).toContain('--agent');
      expect(calls[0]!.args).toContain('vigilis');
      expect(calls[0]!.args).toContain('--risk');
      expect(calls[0]!.args).toContain('high');
      expect(calls[0]!.args).toContain('--scope');
      expect(calls[0]!.args).toContain('project');
    });

    it('omits error suffix in task text when no errorText provided', async () => {
      const calls: Array<{ cmd: string; args: string[] }> = [];
      const fakeExec: Exec = async (cmd, args) => {
        calls.push({ cmd, args });
        return { stdout: JSON.stringify({ action_id: 'act_2', memories: [], withheld: [] }), stderr: '', code: 0 };
      };
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      await provider.recall({ specPath: 'tests/cart.spec.ts', url: 'http://x' });

      expect(calls[0]!.args[1]).not.toContain(' — ');
      expect(calls[0]!.args[1]).toContain('tests/cart.spec.ts');
    });
  });

  describe('recall — parse', () => {
    it('parses memories[] from zmem inject JSON object response', async () => {
      const injectResponse = {
        action_id: 'act_abc123',
        merkle_root: 'abc',
        memories: [
          {
            id: 'mem_2386db3713eb4338',
            content: 'verdict=dom-drift: testid changed | selector=[data-testid="submit-btn"] | spec=tests/login.spec.ts',
            trust: 0.9,
            authority: 'medium',
            status: 'active',
            type: 'episodic',
            scope: 'project',
            labels: [],
          },
        ],
        withheld: [],
        retrieved_memory_ids: ['mem_2386db3713eb4338'],
        injected_memory_ids: ['mem_2386db3713eb4338'],
      };
      const fakeExec = makeExec({
        'zmem inject': { stdout: JSON.stringify(injectResponse), stderr: '', code: 0 },
      });
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      const result = await provider.recall({
        specPath: 'tests/login.spec.ts',
        url: 'http://localhost:3100/login',
        errorText: 'locator not found',
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.content).toContain('dom-drift');
      expect(result[0]!.trust).toBe(0.9);
      expect(result[0]!.authority).toBe('medium');
      expect(result[0]!.memoryId).toBe('mem_2386db3713eb4338');
      expect(result[0]!.receiptId).toBe('act_abc123');
    });

    it('returns [] when memories array is empty', async () => {
      const fakeExec = makeExec({
        'zmem inject': {
          stdout: JSON.stringify({ action_id: 'act_1', memories: [], withheld: [] }),
          stderr: '', code: 0,
        },
      });
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      const result = await provider.recall({ specPath: 'a.spec.ts', url: 'http://x' });
      expect(result).toEqual([]);
    });

    it('returns [] on non-JSON stdout', async () => {
      const fakeExec = makeExec({
        'zmem inject': { stdout: 'command not found: zmem', stderr: '', code: 127 },
      });
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      const result = await provider.recall({ specPath: 'a.spec.ts', url: 'http://x' });
      expect(result).toEqual([]);
    });

    it('returns [] on empty stdout', async () => {
      const fakeExec = makeExec({
        'zmem inject': { stdout: '', stderr: '', code: 0 },
      });
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      const result = await provider.recall({ specPath: 'a.spec.ts', url: 'http://x' });
      expect(result).toEqual([]);
    });

    it('returns [] when exec throws', async () => {
      const throwingExec: Exec = async () => { throw new Error('ENOENT: zmem not found'); };
      const provider = new ZMemProvider('/tmp/test', throwingExec);
      const result = await provider.recall({ specPath: 'a.spec.ts', url: 'http://x' });
      expect(result).toEqual([]);
    });

    it('returns [] when stdout is a JSON object with no memories key', async () => {
      const fakeExec = makeExec({
        'zmem inject': { stdout: JSON.stringify({ error: 'no results' }), stderr: '', code: 0 },
      });
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      const result = await provider.recall({ specPath: 'a.spec.ts', url: 'http://x' });
      expect(result).toEqual([]);
    });

    it('returns [] when memories is not an array', async () => {
      const fakeExec = makeExec({
        'zmem inject': { stdout: JSON.stringify({ action_id: 'act_1', memories: null }), stderr: '', code: 0 },
      });
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      const result = await provider.recall({ specPath: 'a.spec.ts', url: 'http://x' });
      expect(result).toEqual([]);
    });

    it('skips items in memories[] that have no string content', async () => {
      const fakeExec = makeExec({
        'zmem inject': {
          stdout: JSON.stringify({
            action_id: 'act_1',
            memories: [
              null,
              { id: 'mem_1', content: 42, trust: 0.5 },       // non-string content → skip
              { id: 'mem_2', content: 'valid memory text', trust: 0.8, authority: 'low' },
            ],
          }),
          stderr: '', code: 0,
        },
      });
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      const result = await provider.recall({ specPath: 'a.spec.ts', url: 'http://x' });
      expect(result).toHaveLength(1);
      expect(result[0]!.content).toBe('valid memory text');
      expect(result[0]!.trust).toBe(0.8);
      expect(result[0]!.authority).toBe('low');
    });

    it('withheld memories are NOT included in the result', async () => {
      const fakeExec = makeExec({
        'zmem inject': {
          stdout: JSON.stringify({
            action_id: 'act_1',
            memories: [
              { id: 'mem_authorized', content: 'authorized memory', trust: 0.9, authority: 'high' },
            ],
            withheld: [
              { id: 'mem_withheld', content: 'quarantined memory', trust: 0.5 },
            ],
          }),
          stderr: '', code: 0,
        },
      });
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      const result = await provider.recall({ specPath: 'a.spec.ts', url: 'http://x' });
      expect(result).toHaveLength(1);
      expect(result[0]!.content).toBe('authorized memory');
    });
  });

  describe('record — argv', () => {
    it('calls zmem propose with positional content and correct flags', async () => {
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
      expect(calls[0]!.args[0]).toBe('propose');
      // positional content (args[1]) serializes the entry
      const content = calls[0]!.args[1]!;
      expect(content).toContain('verdict=dom-drift');
      expect(content).toContain('testid changed');
      expect(content).toContain('selector=[data-testid="submit-btn"]');
      expect(content).toContain('spec=tests/login.spec.ts');
      // remaining flags
      expect(calls[0]!.args).toContain('--type');
      expect(calls[0]!.args).toContain('episodic');
      expect(calls[0]!.args).toContain('--scope');
      expect(calls[0]!.args).toContain('project');
      expect(calls[0]!.args).toContain('--source');
      expect(calls[0]!.args).toContain('agent');
    });

    it('omits selector from content when none provided', async () => {
      const calls: Array<{ cmd: string; args: string[] }> = [];
      const fakeExec: Exec = async (cmd, args) => {
        calls.push({ cmd, args });
        return { stdout: '', stderr: '', code: 0 };
      };
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      await provider.record({
        specPath: 'tests/cart.spec.ts',
        url: 'http://x',
        verdict: 'real-bug',
        rationale: 'button missing',
      });

      const content = calls[0]!.args[1]!;
      expect(content).not.toContain('selector=');
    });

    it('resolves even when exec throws', async () => {
      const throwingExec: Exec = async () => { throw new Error('ENOENT'); };
      const provider = new ZMemProvider('/tmp/test', throwingExec);
      await expect(
        provider.record({ specPath: 'a.spec.ts', url: 'http://x', verdict: 'real-bug', rationale: 'broken' }),
      ).resolves.toBeUndefined();
    });

    it('resolves even when zmem exits non-zero', async () => {
      const fakeExec = makeExec({
        'zmem propose': { stdout: '', stderr: 'zmem: error', code: 1 },
      });
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      await expect(
        provider.record({ specPath: 'a.spec.ts', url: 'http://x', verdict: 'flake', rationale: 'transient' }),
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
    const throwingExec: Exec = async () => { throw new Error('ENOENT'); };
    const provider = await resolveMemoryProvider('/tmp', { mode: 'auto', exec: throwingExec });
    expect(provider).toBeInstanceOf(NoopMemoryProvider);
  });

  it('defaults to auto mode when no opts provided — uses fake exec to confirm interface shape', async () => {
    const notFoundExec: Exec = async () => ({ stdout: '', stderr: 'not found', code: 127 });
    const provider = await resolveMemoryProvider('/tmp', { exec: notFoundExec });
    expect(provider).toBeInstanceOf(NoopMemoryProvider);
    expect(typeof provider.recall).toBe('function');
    expect(typeof provider.record).toBe('function');
  });
});
```

- [ ] **Step 2.2 — Run the new test file to confirm failures**

```bash
cd /Users/piyushpathak/Work/argus && pnpm --filter @argus/core exec vitest run src/memory/zmem-provider.test.ts 2>&1
```

Expected: failures on argv assertions (`inject` not found, `propose` not found) and parse assertions (object vs array).

- [ ] **Step 2.3 — Rewrite `zmem-provider.ts`**

Replace the entire `packages/core/src/memory/zmem-provider.ts` with:

```typescript
import { defaultExec } from '../runtime/exec';
import type { Exec, ExecResult } from '../runtime/exec';
import type { MemoryProvider, MemoryRecall, MemoryRecordEntry } from './types';
import { NoopMemoryProvider } from './types';

/** A hung `zmem` must never freeze a triage/heal run — bound every call. */
const ZMEM_TIMEOUT_MS = 8000;

/**
 * MemoryProvider backed by the `zmem` CLI (confirmed interface: zmem 0.x).
 *
 * Recall:  zmem inject "<task>" --agent vigilis --risk high --scope project
 *          Prints a JSON object; authorized memories are in obj.memories[].
 * Record:  zmem propose "<content>" --type episodic --scope project --source agent
 *          Stores a quarantined memory; output is ignored.
 *
 * All errors are swallowed — a missing or broken `zmem` binary must never break
 * a triage/heal run. Shells out via the injected `Exec` (same pattern as test
 * runners / Treeship observer) so tests can inject a fake without spawning real
 * processes.
 */
export class ZMemProvider implements MemoryProvider {
  constructor(
    private readonly cwd: string,
    private readonly exec: Exec = defaultExec,
  ) {}

  async recall(query: { specPath: string; url: string; errorText?: string }): Promise<MemoryRecall[]> {
    try {
      const { stdout } = await this.run(this.recallArgv(query));
      return this.parseRecalls(stdout);
    } catch {
      return [];
    }
  }

  async record(entry: MemoryRecordEntry): Promise<void> {
    try {
      await this.run(this.recordArgv(entry));
      // Non-zero exit codes: exec (defaultExec) does NOT throw on non-zero; it
      // resolves with { code: N }. Swallowing errors here covers exec throws only.
    } catch {
      // swallow — a broken zmem must never block a run
    }
  }

  /** Run `zmem` with the given argv, bounded by a timeout so a hung process can't hang triage. */
  private run(args: string[]): Promise<ExecResult> {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('zmem timed out')), ZMEM_TIMEOUT_MS);
    });
    return Promise.race([this.exec('zmem', args, { cwd: this.cwd }), timeout]).finally(() =>
      clearTimeout(timer),
    );
  }

  /**
   * Build argv for `zmem inject` (governed recall).
   * zmem inject "<task>" --agent <id> --risk <level> --scope <scope>
   * task is a POSITIONAL argument (no --task flag).
   */
  private recallArgv(query: { specPath: string; url: string; errorText?: string }): string[] {
    const taskText = `triage failed test ${query.specPath}${query.errorText ? ' — ' + query.errorText : ''}`;
    return ['inject', taskText, '--agent', 'vigilis', '--risk', 'high', '--scope', 'project'];
  }

  /**
   * Build argv for `zmem propose` (governed record / quarantine).
   * zmem propose "<content>" --type episodic --scope <scope> --source agent
   * content is a POSITIONAL argument (no --content flag).
   */
  private recordArgv(entry: MemoryRecordEntry): string[] {
    const content =
      `verdict=${entry.verdict}: ${entry.rationale}` +
      (entry.suggestedSelector ? ` | selector=${entry.suggestedSelector}` : '') +
      ` | spec=${entry.specPath}`;
    return ['propose', content, '--type', 'episodic', '--scope', 'project', '--source', 'agent'];
  }

  /**
   * Parse `zmem inject` stdout into MemoryRecall[].
   * zmem prints a JSON object; authorized (injected) memories are in obj.memories[].
   * Withheld/quarantined memories are in obj.withheld — they are NOT returned.
   * Tolerates non-JSON, missing `memories` key, non-array → returns [].
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
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
    const obj = parsed as Record<string, unknown>;
    const memories = obj['memories'];
    if (!Array.isArray(memories)) return [];
    const receiptId = typeof obj['action_id'] === 'string' ? obj['action_id'] : undefined;
    return memories
      .filter(
        (item): item is Record<string, unknown> =>
          item !== null && typeof item === 'object' && !Array.isArray(item) &&
          typeof (item as Record<string, unknown>)['content'] === 'string',
      )
      .map((item) => ({
        content: item['content'] as string,
        trust: typeof item['trust'] === 'number' ? item['trust'] : undefined,
        authority: typeof item['authority'] === 'string' ? item['authority'] : undefined,
        memoryId: typeof item['id'] === 'string' ? item['id'] : undefined,
        receiptId,
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

- [ ] **Step 2.4 — Run the zmem-provider tests to confirm they pass**

```bash
cd /Users/piyushpathak/Work/argus && pnpm --filter @argus/core exec vitest run src/memory/zmem-provider.test.ts 2>&1
```

Expected: all tests pass.

- [ ] **Step 2.5 — Run all memory tests together**

```bash
cd /Users/piyushpathak/Work/argus && pnpm --filter @argus/core exec vitest run src/memory/ 2>&1
```

Expected: all memory tests pass.

---

## Task 3: Update `triage.ts` + its test for the new `MemoryRecall` shape

**Files:**
- Modify: `packages/core/src/behaviors/triage.ts`
- Modify: `packages/core/src/behaviors/triage.test.ts`

The triage file uses `MemoryRecall` in two places:
1. `buildMemoryHintBlock` — renders each prior into the system prompt
2. The recall filter — currently drops priors with empty `rationale`; must be updated to drop priors with empty `content`

### Step 3.1 — Write a failing test that asserts on the new content shape

The failing test is the third triage test ("with a fake provider returning one prior…"). It must:
- Use `fakePrior: MemoryRecall` with `content` (not `verdict`/`rationale`)
- Assert the system prompt contains `(trust 0.85)` and the content text (not `verdict=dom-drift`)

Replace the entire `packages/core/src/behaviors/triage.test.ts` with:

```typescript
import { describe, it, expect } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { triage } from './triage';
import { FakeAnthropicClient, makeFakeCtx, makeMessage } from '../tools/testing/fakes';
import type { MemoryProvider, MemoryRecall, MemoryRecordEntry } from '../memory/types';
import { NoopMemoryProvider } from '../memory/types';

describe('triage', () => {
  it('captures a structured verdict from the report_verdict tool call', async () => {
    const root = await mkdtemp(join(tmpdir(), 'argus-triage-'));
    try {
      await mkdir(join(root, 'tests/generated'), { recursive: true });
      await writeFile(join(root, 'tests/generated/login.spec.ts'), '// spec', 'utf8');

      const client = new FakeAnthropicClient([
        makeMessage(
          [{ type: 'tool_use', id: 't1', name: 'fs_read', input: { path: 'tests/generated/login.spec.ts' } }],
          'tool_use',
        ),
        makeMessage([{ type: 'tool_use', id: 't2', name: 'dom_testids', input: {} }], 'tool_use'),
        makeMessage(
          [
            {
              type: 'tool_use',
              id: 't3',
              name: 'report_verdict',
              input: {
                verdict: 'dom-drift',
                confidence: 'high',
                rationale: 'login-submit testid is now submit-btn',
                suggestedSelector: '[data-testid="submit-btn"]',
              },
            },
          ],
          'tool_use',
        ),
        makeMessage([{ type: 'text', text: 'Classified as dom-drift.' }], 'end_turn'),
      ]);

      const result = await triage({
        client,
        specPath: 'tests/generated/login.spec.ts',
        url: 'http://localhost:3100/login',
        errorText: 'locator [data-testid="login-submit"] not found',
        ctx: makeFakeCtx({ workspaceRoot: root }),
      });

      expect(result.verdict?.verdict).toBe('dom-drift');
      expect(result.verdict?.suggestedSelector).toBe('[data-testid="submit-btn"]');
      expect(result.run.stopReason).toBe('end_turn');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

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
            capturedSystems.push(typeof body.system === 'string' ? body.system : '');
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

      // New MemoryRecall shape: free-text content from zmem
      const fakePrior: MemoryRecall = {
        content: 'verdict=dom-drift: testid was login-submit, is now submit-btn | selector=[data-testid="submit-btn"] | spec=tests/login.spec.ts',
        trust: 0.85,
        authority: 'medium',
        memoryId: 'mem_abc123',
        receiptId: 'act_def456',
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
            capturedSystems.push(typeof body.system === 'string' ? body.system : '');
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
      // The hint must render the content and trust from the new shape
      expect(capturedSystems[0]).toContain('(trust 0.85)');
      expect(capturedSystems[0]).toContain('verdict=dom-drift: testid was login-submit');

      // record must have been called once with the verdict (MemoryRecordEntry shape unchanged)
      expect(recordedEntries).toHaveLength(1);
      expect(recordedEntries[0]!.verdict).toBe('dom-drift');
      expect(recordedEntries[0]!.rationale).toBe('testid changed');
      expect(recordedEntries[0]!.specPath).toBe('tests/generated/login.spec.ts');
      expect(recordedEntries[0]!.url).toBe('http://localhost:3100/login');

      expect(result.verdict?.verdict).toBe('dom-drift');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('filters out priors with empty content before injecting hint block', async () => {
    const root = await mkdtemp(join(tmpdir(), 'argus-triage-filter-'));
    try {
      await mkdir(join(root, 'tests/generated'), { recursive: true });
      await writeFile(join(root, 'tests/generated/login.spec.ts'), '// spec', 'utf8');

      const capturedSystems: string[] = [];

      const fakeProvider: MemoryProvider = {
        // Returns one prior with empty content — should be filtered out
        recall: async (_query) => [{ content: '   ' }],
        record: async () => {},
      };

      const client = new FakeAnthropicClient([
        makeMessage(
          [{ type: 'tool_use', id: 't1', name: 'report_verdict', input: { verdict: 'flake', confidence: 'low', rationale: 'transient' } }],
          'tool_use',
        ),
        makeMessage([{ type: 'text', text: 'Done.' }], 'end_turn'),
      ]);

      const wrappedClient = {
        messages: {
          create: async (body: Parameters<typeof client.messages.create>[0]) => {
            capturedSystems.push(typeof body.system === 'string' ? body.system : '');
            return client.messages.create(body);
          },
        },
      };

      await triage({
        client: wrappedClient,
        specPath: 'tests/generated/login.spec.ts',
        url: 'http://localhost:3100/login',
        ctx: makeFakeCtx({ workspaceRoot: root }),
        memory: fakeProvider,
      });

      // Priors with whitespace-only content must be filtered → no hint block injected
      expect(capturedSystems[0]).not.toContain('PRIOR GOVERNED MEMORY');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 3.2 — Run the triage test to confirm failures**

```bash
cd /Users/piyushpathak/Work/argus && pnpm --filter @argus/core exec vitest run src/behaviors/triage.test.ts 2>&1
```

Expected: TypeScript/test failures — `fakePrior` shape mismatch (old interface still has `verdict`/`rationale`), hint block renders old format, filter checks `p.rationale` not `p.content`.

- [ ] **Step 3.3 — Update `buildMemoryHintBlock` and the recall filter in `triage.ts`**

In `packages/core/src/behaviors/triage.ts`, make two targeted edits:

**Edit 1 — `buildMemoryHintBlock` per-prior line (around line 74–79):**

Find:
```typescript
    ...priors.map((p, i) => {
      const parts = [`Prior ${i + 1}: verdict=${p.verdict}, rationale="${p.rationale}"`];
      if (p.suggestedSelector) parts.push(`  suggested selector: ${p.suggestedSelector}`);
      if (p.trust !== undefined) parts.push(`  trust: ${p.trust}`);
      return parts.join('\n');
    }),
```

Replace with:
```typescript
    ...priors.map((p, i) => `Prior ${i + 1}: (trust ${p.trust ?? '?'}) ${p.content}`),
```

**Edit 2 — the recall filter (around line 106–109):**

Find:
```typescript
    priors = (await memory.recall({ specPath, url, errorText })).filter(
      (p) => typeof p.rationale === 'string' && p.rationale.trim() !== '',
    );
```

Replace with:
```typescript
    priors = (await memory.recall({ specPath, url, errorText })).filter(
      (p) => typeof p.content === 'string' && p.content.trim() !== '',
    );
```

- [ ] **Step 3.4 — Run the triage test to confirm all 4 tests pass**

```bash
cd /Users/piyushpathak/Work/argus && pnpm --filter @argus/core exec vitest run src/behaviors/triage.test.ts 2>&1
```

Expected: 4 tests pass.

---

## Task 4: Full build + test + tsc clean + commit

### Step 4.1 — Run the full monorepo test suite

```bash
cd /Users/piyushpathak/Work/argus && pnpm -r test 2>&1
```

Expected: all test files pass (previously 31 test files / 127 tests; new total will be slightly higher due to new tests added). Zero failures.

- [ ] **Step 4.2 — Run TypeScript noEmit check**

```bash
cd /Users/piyushpathak/Work/argus/packages/core && npx tsc --noEmit 2>&1
```

Expected: no output (clean — zero errors).

- [ ] **Step 4.3 — Verify memory boundary is still clean**

```bash
grep -rn "memory/" /Users/piyushpathak/Work/argus/packages/core/src/agent 2>&1
```

Expected: empty output (agent layer must not import from memory/).

- [ ] **Step 4.4 — Run full build**

```bash
cd /Users/piyushpathak/Work/argus && pnpm -r build 2>&1
```

Expected: all packages build cleanly.

- [ ] **Step 4.5 — Verify untouched files are unchanged**

```bash
git -C /Users/piyushpathak/Work/argus diff --name-only apps/sample-shop/src/app/login/page.tsx tests/generated/login.spec.ts 2>&1
```

Expected: no output (those files are unchanged).

- [ ] **Step 4.6 — Commit (explicit file staging, never -A)**

```bash
git -C /Users/piyushpathak/Work/argus add \
  packages/core/src/memory/types.ts \
  packages/core/src/memory/types.test.ts \
  packages/core/src/memory/zmem-provider.ts \
  packages/core/src/memory/zmem-provider.test.ts \
  packages/core/src/behaviors/triage.ts \
  packages/core/src/behaviors/triage.test.ts
```

Then:

```bash
git -C /Users/piyushpathak/Work/argus commit -m "$(cat <<'EOF'
fix(memory): align ZMem adapter to confirmed zmem CLI (inject/propose, memories[] parse)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds, shows the 6 changed files.

- [ ] **Step 4.7 — Confirm commit SHA**

```bash
git -C /Users/piyushpathak/Work/argus log --oneline -1 2>&1
```

Expected: one line showing the new commit hash and message.

---

## Self-Review

### Spec coverage check

| Requirement | Covered by task |
|---|---|
| `MemoryRecall` → `content/trust/authority/memoryId/receiptId` | Task 1 |
| `recallArgv` → `inject` positional + `--agent vigilis --risk high --scope project` | Task 2 |
| `recordArgv` → `propose` positional + `--type episodic --scope project --source agent` | Task 2 |
| `parseRecalls` → JSON object → `obj.memories[]` → map to `MemoryRecall` | Task 2 |
| `withheld` NOT in result | Task 2 (test: "withheld memories are NOT included") |
| Non-JSON / missing `memories` / non-array → `[]` | Task 2 (multiple parse tests) |
| Drop `VALID_VERDICTS` | Task 2 (no such constant in new provider) |
| `buildMemoryHintBlock` → `(trust ${p.trust ?? '?'}) ${p.content}` | Task 3 |
| Recall filter → `p.content?.trim()` | Task 3 |
| Keep `MemoryRecordEntry` / `MemoryProvider` / `NoopMemoryProvider` unchanged | Task 1 (only `MemoryRecall` changes) |
| Keep 8s timeout + error-swallowing | Task 2 (preserved verbatim) |
| Keep `resolveMemoryProvider` (off/auto/zmem) | Task 2 (preserved verbatim) |
| Do NOT touch `login/page.tsx` or `login.spec.ts` | Task 4.5 verification step |
| One commit, correct message | Task 4.6 |
| `pnpm -r build && pnpm -r test` green + `tsc --noEmit` clean | Task 4.1–4.4 |

### Placeholder scan

No TBDs, no "implement later", no "add validation" without code. Every step that changes code shows the complete new code.

### Type consistency check

- `MemoryRecall` defined in Task 1 as `{ content: string; trust?: number; authority?: string; memoryId?: string; receiptId?: string }`.
- Task 2 `parseRecalls` maps to exactly those fields.
- Task 3 `buildMemoryHintBlock` reads `p.trust` and `p.content` — both defined.
- Task 3 filter reads `p.content` — defined.
- `fakePrior` in Task 3 test uses `content`, `trust`, `authority`, `memoryId`, `receiptId` — all match.
- `MemoryRecordEntry` (used in `record(...)` call and triage test `recordedEntries`) — unchanged throughout.
- `Verdict` type in `types.ts` — unchanged.

All consistent.

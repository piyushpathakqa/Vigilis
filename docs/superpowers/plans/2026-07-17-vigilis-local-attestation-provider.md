# Vigilis Local Attestation Provider — Implementation Plan (Plan A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real local attestation provider to Vigilis so the agent loop produces a tamper-evident, hash-chained attestation bundle on disk with zero external dependencies, then publish it as `vigilis@0.5.0`.

**Architecture:** A new `LocalAttestationObserver` implements the existing `AgentObserver` seam and mirrors `TreeshipObserver`'s public shape (`flush()`, head hash). It appends one hash-chained record per loop event and writes a JSON bundle on flush. A small `createAttestationObserver` selector returns the Treeship observer when available, else the local one. The `heal` CLI command is wired to use the selector and print a local summary when Treeship is absent.

**Tech Stack:** TypeScript (ESM, strict), Node built-in `crypto`/`fs`, Vitest. Repo: `argus` monorepo, pnpm workspaces. Core package `@argus/core`; CLI package `vigilis`.

## Global Constraints

- Language: TypeScript, ESM (`"type": "module"`), strict tsconfig. Match surrounding code style.
- No custom crypto beyond Node's built-in `crypto` (sha256). No key management. Local bundles are **unsigned by design**.
- Never hard-depend on Treeship. The local path must work with zero secrets and zero external packages.
- User-facing strings use "verifiable" / "auditable" / "chain intact" / "unsigned (local)". Never claim attestation "guarantees correctness."
- Co-locate tests next to source as `*.test.ts` (matches `packages/core/src/agent/treeship-observer.test.ts`).
- Run core tests with: `pnpm --filter @argus/core exec vitest run <relative-path>` (core `test` script is `vitest run`).
- Commit messages end with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Work on a branch, not `main`.

---

### Task 1: `LocalAttestationObserver` — hash-chained records + bundle write

**Files:**
- Create: `packages/core/src/agent/local-attestation-observer.ts`
- Test: `packages/core/src/agent/local-attestation-observer.test.ts`

**Interfaces:**
- Consumes: `AgentObserver` from `./observer` (methods `onLoopStart`, `onModelResponse`, `onToolCall`, `onToolResult`, `onLoopEnd`; event shapes in `packages/core/src/agent/observer.ts:12-19`).
- Produces:
  - `interface AttestationRecord { seq: number; timestamp: string; type: 'loop_start'|'model_response'|'tool_call'|'tool_result'|'loop_end'; actor: string; action: string; meta: Record<string, unknown>; prevHash: string | null; hash: string }`
  - `interface AttestationBundle { version: 1; actor: string; label: string; createdAt: string; count: number; headHash: string | null; signed: false; chainIntact: true; records: AttestationRecord[] }`
  - `interface LocalAttestationObserverOptions { label?: string; actor?: string; outPath: string; now?: () => string }`
  - `interface LocalAttestationObserver extends AgentObserver { flush(): Promise<void>; readonly headHash: string | null; readonly bundlePath: string; readonly records: readonly AttestationRecord[] }`
  - `function createLocalAttestationObserver(opts: LocalAttestationObserverOptions): LocalAttestationObserver`
  - `function canonicalJson(value: unknown): string` (exported for reuse by the verifier task)
  - `function hashRecord(rec: Omit<AttestationRecord, 'hash'>): string` (exported for the verifier task)

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/agent/local-attestation-observer.test.ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createLocalAttestationObserver,
  hashRecord,
  type AttestationBundle,
} from './local-attestation-observer';

function fixedClock() {
  let n = 0;
  return () => `2026-07-17T00:00:0${n++}.000Z`;
}

describe('createLocalAttestationObserver', () => {
  it('chains records in invocation order and writes a bundle on flush', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vigilis-attest-'));
    const outPath = join(dir, 'heal-login.json');
    const obs = createLocalAttestationObserver({ label: 'heal', outPath, now: fixedClock() });

    obs.onLoopStart?.({ system: 'sys', model: 'claude-opus-4-8' });
    obs.onToolCall?.({ step: 1, name: 'fs_read', input: { path: 'a.spec.ts' } });
    obs.onModelResponse?.({
      step: 1,
      stopReason: 'tool_use',
      usage: { input_tokens: 10, output_tokens: 5 } as any,
    });
    obs.onLoopEnd?.({ steps: 1, stopReason: 'end_turn' });
    await obs.flush();

    // 4 records, seq 0..3, each prevHash === previous record's hash
    expect(obs.records).toHaveLength(4);
    expect(obs.records[0].prevHash).toBeNull();
    for (let i = 1; i < obs.records.length; i++) {
      expect(obs.records[i].prevHash).toBe(obs.records[i - 1].hash);
      expect(obs.records[i].seq).toBe(i);
    }
    // headHash is the last record's hash
    expect(obs.headHash).toBe(obs.records[3].hash);

    // each hash equals the recomputed hash of its own fields (real chain)
    for (const rec of obs.records) {
      const { hash, ...rest } = rec;
      expect(hash).toBe(hashRecord(rest));
    }

    // bundle written and parseable
    const bundle = JSON.parse(readFileSync(outPath, 'utf8')) as AttestationBundle;
    expect(bundle.count).toBe(4);
    expect(bundle.signed).toBe(false);
    expect(bundle.chainIntact).toBe(true);
    expect(bundle.headHash).toBe(obs.headHash);
    expect(bundle.records).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @argus/core exec vitest run src/agent/local-attestation-observer.test.ts`
Expected: FAIL — cannot resolve `./local-attestation-observer` (module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/core/src/agent/local-attestation-observer.ts
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AgentObserver } from './observer';

export interface AttestationRecord {
  seq: number;
  timestamp: string;
  type: 'loop_start' | 'model_response' | 'tool_call' | 'tool_result' | 'loop_end';
  actor: string;
  action: string;
  meta: Record<string, unknown>;
  prevHash: string | null;
  hash: string;
}

export interface AttestationBundle {
  version: 1;
  actor: string;
  label: string;
  createdAt: string;
  count: number;
  headHash: string | null;
  signed: false;
  chainIntact: true;
  records: AttestationRecord[];
}

export interface LocalAttestationObserverOptions {
  /** Namespaces recorded actions, e.g. `heal` → `heal.tool.fs_read`. */
  label?: string;
  /** Actor URI stamped on every record. Default `agent://vigilis`. */
  actor?: string;
  /** Where the bundle JSON is written on flush. */
  outPath: string;
  /** Injectable clock (tests). Default `() => new Date().toISOString()`. */
  now?: () => string;
}

export interface LocalAttestationObserver extends AgentObserver {
  flush(): Promise<void>;
  readonly headHash: string | null;
  readonly bundlePath: string;
  readonly records: readonly AttestationRecord[];
}

/** Deterministic JSON: object keys sorted recursively so hashing is stable. */
export function canonicalJson(value: unknown): string {
  const seen = new WeakSet();
  const norm = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v;
    if (seen.has(v as object)) return '[circular]';
    seen.add(v as object);
    if (Array.isArray(v)) return v.map(norm);
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(v as Record<string, unknown>).sort()) {
      out[key] = norm((v as Record<string, unknown>)[key]);
    }
    return out;
  };
  return JSON.stringify(norm(value));
}

export function hashRecord(rec: Omit<AttestationRecord, 'hash'>): string {
  return createHash('sha256').update(canonicalJson(rec)).digest('hex');
}

export function createLocalAttestationObserver(
  opts: LocalAttestationObserverOptions,
): LocalAttestationObserver {
  const actor = opts.actor ?? 'agent://vigilis';
  const prefix = opts.label ? `${opts.label}.` : '';
  const now = opts.now ?? (() => new Date().toISOString());
  const label = opts.label ?? '';
  const records: AttestationRecord[] = [];
  let headHash: string | null = null;

  const append = (
    type: AttestationRecord['type'],
    action: string,
    meta: Record<string, unknown>,
  ): void => {
    const base = {
      seq: records.length,
      timestamp: now(),
      type,
      actor,
      action: `${prefix}${action}`,
      meta,
      prevHash: headHash,
    };
    const hash = hashRecord(base);
    const rec: AttestationRecord = { ...base, hash };
    records.push(rec);
    headHash = hash;
  };

  return {
    get headHash() {
      return headHash;
    },
    get bundlePath() {
      return opts.outPath;
    },
    get records() {
      return records;
    },
    onLoopStart(e) {
      append('loop_start', 'loop.start', { model: e.model });
    },
    onToolCall(e) {
      append('tool_call', `tool.${e.name}`, { step: e.step, input: e.input });
    },
    onToolResult(e) {
      append('tool_result', `tool.${e.name}.result`, {
        step: e.step,
        isError: e.result.isError,
      });
    },
    onModelResponse(e) {
      append('model_response', 'decision', {
        step: e.step,
        stop: e.stopReason,
        tokens_in: e.usage.input_tokens,
        tokens_out: e.usage.output_tokens,
      });
    },
    onLoopEnd(e) {
      append('loop_end', 'loop.end', { steps: e.steps, stop: e.stopReason });
    },
    async flush() {
      const bundle: AttestationBundle = {
        version: 1,
        actor,
        label,
        createdAt: now(),
        count: records.length,
        headHash,
        signed: false,
        chainIntact: true,
        records,
      };
      mkdirSync(dirname(opts.outPath), { recursive: true });
      writeFileSync(opts.outPath, JSON.stringify(bundle, null, 2), 'utf8');
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @argus/core exec vitest run src/agent/local-attestation-observer.test.ts`
Expected: PASS (1 passed).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/agent/local-attestation-observer.ts packages/core/src/agent/local-attestation-observer.test.ts
git commit -m "feat(core): LocalAttestationObserver — hash-chained local attestation bundle

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `verifyLocalBundle` — re-walk the chain, detect tampering

**Files:**
- Modify: `packages/core/src/agent/local-attestation-observer.ts` (append verifier)
- Test: `packages/core/src/agent/local-attestation-observer.test.ts` (add cases)

**Interfaces:**
- Consumes: `AttestationBundle`, `AttestationRecord`, `hashRecord` from Task 1.
- Produces: `interface BundleVerification { ok: boolean; count: number; brokenAt?: number }` and `function verifyLocalBundle(bundle: AttestationBundle): BundleVerification`.

- [ ] **Step 1: Write the failing test** (append to the existing test file)

```ts
// append to packages/core/src/agent/local-attestation-observer.test.ts
import { verifyLocalBundle } from './local-attestation-observer';

describe('verifyLocalBundle', () => {
  function buildBundle(): AttestationBundle {
    const dir = mkdtempSync(join(tmpdir(), 'vigilis-verify-'));
    const obs = createLocalAttestationObserver({
      label: 'heal',
      outPath: join(dir, 'b.json'),
      now: fixedClock(),
    });
    obs.onLoopStart?.({ system: 'sys', model: 'm' });
    obs.onToolCall?.({ step: 1, name: 'fs_read', input: { path: 'a' } });
    obs.onToolCall?.({ step: 2, name: 'fs_write', input: { path: 'b' } });
    obs.onLoopEnd?.({ steps: 2, stopReason: 'end_turn' });
    return {
      version: 1,
      actor: 'agent://vigilis',
      label: 'heal',
      createdAt: '2026-07-17T00:00:09.000Z',
      count: obs.records.length,
      headHash: obs.headHash,
      signed: false,
      chainIntact: true,
      records: obs.records.map((r) => ({ ...r })),
    };
  }

  it('accepts an intact chain', () => {
    const v = verifyLocalBundle(buildBundle());
    expect(v).toEqual({ ok: true, count: 4 });
  });

  it('rejects a bundle whose middle record was tampered', () => {
    const bundle = buildBundle();
    (bundle.records[1].meta as any).input = { path: 'HACKED' };
    const v = verifyLocalBundle(bundle);
    expect(v.ok).toBe(false);
    expect(v.brokenAt).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @argus/core exec vitest run src/agent/local-attestation-observer.test.ts`
Expected: FAIL — `verifyLocalBundle` is not exported / not a function.

- [ ] **Step 3: Write minimal implementation** (append to `local-attestation-observer.ts`)

```ts
export interface BundleVerification {
  ok: boolean;
  count: number;
  /** Index of the first record whose hash or linkage does not verify. */
  brokenAt?: number;
}

/**
 * Re-walk the chain: each record's hash must equal the recomputed hash of its
 * own fields, and its prevHash must equal the previous record's hash. Any edit
 * to any record breaks it here — the property that makes the bundle auditable.
 */
export function verifyLocalBundle(bundle: AttestationBundle): BundleVerification {
  let prev: string | null = null;
  for (let i = 0; i < bundle.records.length; i++) {
    const { hash, ...rest } = bundle.records[i];
    if (rest.prevHash !== prev || hashRecord(rest) !== hash) {
      return { ok: false, count: bundle.records.length, brokenAt: i };
    }
    prev = hash;
  }
  return { ok: true, count: bundle.records.length };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @argus/core exec vitest run src/agent/local-attestation-observer.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/agent/local-attestation-observer.ts packages/core/src/agent/local-attestation-observer.test.ts
git commit -m "feat(core): verifyLocalBundle — tamper-evident chain re-walk

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `createAttestationObserver` selector — Treeship if available, else local

**Files:**
- Create: `packages/core/src/agent/attestation.ts`
- Test: `packages/core/src/agent/attestation.test.ts`
- Modify: `packages/core/src/agent/index.ts` (exports)

**Interfaces:**
- Consumes: `createTreeshipObserver` + `TreeshipObserver` from `./treeship-observer`; `createLocalAttestationObserver` + `LocalAttestationObserver` from `./local-attestation-observer`; `AgentObserver` from `./observer`.
- Produces:
  - `type AttestationKind = 'treeship' | 'local'`
  - `interface AttestationSelection { kind: AttestationKind; observer: AgentObserver & { flush(): Promise<void> }; treeship?: TreeshipObserver; local?: LocalAttestationObserver }`
  - `interface CreateAttestationOptions { label?: string; outPath: string; preferTreeship?: boolean; createTreeship?: typeof createTreeshipObserver }`
  - `async function createAttestationObserver(opts: CreateAttestationOptions): Promise<AttestationSelection>`

The `createTreeship` option is dependency-injection for tests (so a test can force the "Treeship unavailable" branch without the CLI).

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/agent/attestation.test.ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAttestationObserver } from './attestation';

describe('createAttestationObserver', () => {
  it('falls back to the local observer when Treeship is unavailable', async () => {
    const outPath = join(mkdtempSync(join(tmpdir(), 'vigilis-sel-')), 'heal.json');
    const sel = await createAttestationObserver({
      label: 'heal',
      outPath,
      createTreeship: async () => null, // Treeship absent
    });
    expect(sel.kind).toBe('local');
    expect(sel.local).toBeDefined();
    expect(sel.local!.bundlePath).toBe(outPath);
    expect(typeof sel.observer.flush).toBe('function');
  });

  it('uses Treeship when its observer is available', async () => {
    const outPath = join(mkdtempSync(join(tmpdir(), 'vigilis-sel-')), 'heal.json');
    const fakeTree = {
      headId: undefined,
      onToolCall() {},
      onModelResponse() {},
      async flush() {},
    };
    const sel = await createAttestationObserver({
      label: 'heal',
      outPath,
      createTreeship: async () => fakeTree as any,
    });
    expect(sel.kind).toBe('treeship');
    expect(sel.treeship).toBe(fakeTree);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @argus/core exec vitest run src/agent/attestation.test.ts`
Expected: FAIL — cannot resolve `./attestation`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/core/src/agent/attestation.ts
import type { AgentObserver } from './observer';
import { createTreeshipObserver, type TreeshipObserver } from './treeship-observer';
import {
  createLocalAttestationObserver,
  type LocalAttestationObserver,
} from './local-attestation-observer';

export type AttestationKind = 'treeship' | 'local';

export interface AttestationSelection {
  kind: AttestationKind;
  observer: AgentObserver & { flush(): Promise<void> };
  treeship?: TreeshipObserver;
  local?: LocalAttestationObserver;
}

export interface CreateAttestationOptions {
  label?: string;
  /** Where the local bundle is written when Treeship is unavailable. */
  outPath: string;
  /** Try Treeship first (default true). */
  preferTreeship?: boolean;
  /** Injectable for tests; defaults to the real Treeship observer factory. */
  createTreeship?: typeof createTreeshipObserver;
}

/**
 * Pick the attestation observer: the independent Treeship notary when its CLI is
 * present, otherwise a local hash-chained bundle so provenance still works with
 * zero secrets. Local bundles are unsigned; Treeship receipts are signed.
 */
export async function createAttestationObserver(
  opts: CreateAttestationOptions,
): Promise<AttestationSelection> {
  const makeTree = opts.createTreeship ?? createTreeshipObserver;
  if (opts.preferTreeship !== false) {
    const tree = await makeTree({ label: opts.label });
    if (tree) return { kind: 'treeship', observer: tree, treeship: tree };
  }
  const local = createLocalAttestationObserver({ label: opts.label, outPath: opts.outPath });
  return { kind: 'local', observer: local, local };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @argus/core exec vitest run src/agent/attestation.test.ts`
Expected: PASS (2 passed).

- [ ] **Step 5: Add exports and typecheck**

Edit `packages/core/src/agent/index.ts` — append:

```ts
export {
  createLocalAttestationObserver,
  verifyLocalBundle,
  canonicalJson,
  hashRecord,
} from './local-attestation-observer';
export type {
  LocalAttestationObserver,
  LocalAttestationObserverOptions,
  AttestationRecord,
  AttestationBundle,
  BundleVerification,
} from './local-attestation-observer';
export { createAttestationObserver } from './attestation';
export type {
  AttestationSelection,
  AttestationKind,
  CreateAttestationOptions,
} from './attestation';
```

Run: `pnpm --filter @argus/core typecheck`
Expected: no errors (exit 0).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/agent/attestation.ts packages/core/src/agent/attestation.test.ts packages/core/src/agent/index.ts
git commit -m "feat(core): createAttestationObserver selector (Treeship or local)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Wire the `heal` CLI command to the selector + local summary

**Files:**
- Modify: `packages/cli/src/index.ts` (imports near line 32-38; heal setup near line 364-368; heal `finally` near line 448-470)

**Interfaces:**
- Consumes: `createAttestationObserver`, `verifyLocalBundle`, `AttestationBundle` from `@argus/core`; existing `composeObservers`, `ConsoleObserver`, `treeshipCli`, `publishReceipt`.
- Produces: no new exported symbols (CLI glue).

- [ ] **Step 1: Update imports**

In `packages/cli/src/index.ts`, extend the existing `@argus/core` agent import block (the one that already imports `composeObservers, ConsoleObserver, createTreeshipObserver`) to also import:

```ts
import { readFileSync } from 'node:fs';
// ...in the existing core import that brings in composeObservers/ConsoleObserver/createTreeshipObserver, add:
  createAttestationObserver,
  verifyLocalBundle,
  type AttestationBundle,
```

- [ ] **Step 2: Replace the observer setup in `heal`**

Find (around `index.ts:364-368`):

```ts
      const tree = opts.receipt === false ? null : await createTreeshipObserver({ label: 'heal' });
      if (tree) await treeshipCli(['session', 'start', '--name', `vigilis heal ${slug}`]);
      const observer = composeObservers(new ConsoleObserver(), tree);
```

Replace with:

```ts
      const attestation =
        opts.receipt === false
          ? null
          : await createAttestationObserver({
              label: 'heal',
              outPath: `.vigilis/attestation/heal-${slug}.json`,
            });
      if (attestation?.kind === 'treeship') {
        await treeshipCli(['session', 'start', '--name', `vigilis heal ${slug}`]);
      }
      const observer = composeObservers(new ConsoleObserver(), attestation?.observer);
```

- [ ] **Step 3: Replace the seal logic in the `heal` `finally` block**

Find (around `index.ts:448-470`):

```ts
        // Seal the provenance session (records every tool call + decision above).
        await tree?.flush();
        let receiptUrl: string | null = null;
        if (tree) {
          await treeshipCli(['session', 'close']);
          receiptUrl = opts.publish === false ? null : await publishReceipt();
          if (receiptUrl) {
            console.log(`\n[vigilis] 🔏 provenance receipt: ${receiptUrl}`);
            console.log('[vigilis] public, no login, independently verifiable.');
          } else {
            console.log(
              '\n[vigilis] provenance receipt sealed — verify it with `treeship verify last`, ' +
                'or publish a shareable URL with `treeship session report` ' +
                '(needs `treeship hub attach` once).',
            );
```

Replace the `await tree?.flush();` line and the `if (tree) {` branch head so it reads:

```ts
        // Seal the provenance session (records every tool call + decision above).
        await attestation?.observer.flush();
        let receiptUrl: string | null = null;
        if (attestation?.kind === 'treeship') {
          await treeshipCli(['session', 'close']);
          receiptUrl = opts.publish === false ? null : await publishReceipt();
          if (receiptUrl) {
            console.log(`\n[vigilis] 🔏 provenance receipt: ${receiptUrl}`);
            console.log('[vigilis] public, no login, independently verifiable.');
          } else {
            console.log(
              '\n[vigilis] provenance receipt sealed — verify it with `treeship verify last`, ' +
                'or publish a shareable URL with `treeship session report` ' +
                '(needs `treeship hub attach` once).',
            );
```

Then, immediately **after** the existing closing `}` of that `else` block's `console.log(...)` (i.e. after the Treeship branch fully closes), add the local branch. The exact insertion point is right before the `}` that closes `if (attestation?.kind === 'treeship') { ... }`. Add:

```ts
        } else if (attestation?.kind === 'local' && attestation.local) {
          const bundle = JSON.parse(
            readFileSync(attestation.local.bundlePath, 'utf8'),
          ) as AttestationBundle;
          const v = verifyLocalBundle(bundle);
          console.log(
            `\n[vigilis] 🔗 local attestation: ${v.count} artifacts, ${
              v.ok ? 'chain intact' : `CHAIN BROKEN at #${v.brokenAt}`
            } (unsigned)`,
          );
          console.log(`[vigilis] bundle: ${attestation.local.bundlePath}`);
          console.log(
            '[vigilis] verifiable + auditable — not a correctness guarantee. ' +
              'Configure Treeship for a signed, independently-notarized receipt.',
          );
```

> Note for the implementer: this changes the shape of the `if/else` — make sure the final structure is `if (treeship) { ... } else if (local) { ... }` with balanced braces. Read the surrounding `finally` block fully before editing.

- [ ] **Step 4: Build and typecheck the CLI**

Run: `pnpm --filter @argus/core build && pnpm --filter vigilis typecheck`
Expected: exit 0, no type errors. (Core must be built first because the CLI resolves `@argus/core` to `dist/` at runtime; typecheck maps to source.)

- [ ] **Step 5: Manual smoke of the local path (no Treeship)**

Run (Treeship CLI absent → local path):

```bash
pnpm --filter @argus/core build && pnpm --filter vigilis build
# create a throwaway failing spec + config in a temp dir, or reuse the sample-shop app.
# Minimal check: the wiring compiles and the local branch prints. Full E2E is exercised in Plan B.
node packages/cli/dist/index.js heal http://localhost:3100 --spec tests/generated/login.spec.ts --no-pr --no-publish || true
ls -la .vigilis/attestation/ 2>/dev/null
```

Expected: a `.vigilis/attestation/heal-login.json` bundle exists and the run prints `local attestation: N artifacts, chain intact (unsigned)`. (If no ANTHROPIC_API_KEY/chromium locally, this step is best-effort; Plan B verifies the full loop in CI.)

- [ ] **Step 6: Run the whole core + cli test suites**

Run: `pnpm -r test`
Expected: all packages pass (no regressions).

- [ ] **Step 7: Commit**

```bash
git add packages/cli/src/index.ts
git commit -m "feat(cli): heal falls back to local attestation when Treeship is absent

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Version bump + publish `vigilis@0.5.0`

**Files:**
- Modify: `packages/cli/package.json` (`version`)
- Modify: `README.md` and/or `docs/` note that local attestation is now the zero-secret default (one line).

**Interfaces:** none (release task).

- [ ] **Step 1: Confirm the npm name is available/owned**

Run: `npm view vigilis version` and `npm whoami`
Expected: either 404 (name free → publishable) or you own it. If the name is taken by someone else, STOP and switch to a scoped name (`@zerkerlabs/vigilis`), updating `packages/cli/package.json` `name` and Plan B's `npx` invocation to match. Record the decision.

- [ ] **Step 2: Bump version**

Edit `packages/cli/package.json`: set `"version": "0.5.0"`.

- [ ] **Step 3: Full build + test gate**

Run: `pnpm -r build && pnpm -r typecheck && pnpm -r test && pnpm lint`
Expected: all green.

- [ ] **Step 4: Commit the release**

```bash
git add packages/cli/package.json README.md
git commit -m "release(cli): vigilis 0.5.0 — local attestation provider (zero-secret default)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5: Publish (requires the user's npm auth — ask before running)**

> This publishes publicly and is hard to reverse. Confirm with the user before running.

```bash
cd packages/cli && npm publish --access public
```

Expected: `+ vigilis@0.5.0`. Verify: `npm view vigilis@0.5.0 version` → `0.5.0`.

**Fallback (if not publishing to npm now):** skip Steps 1 and 5; Plan B will consume Vigilis via `npx github:<owner>/argus#<pinned-sha>` instead of `npx vigilis@0.5.0`. Record the pinned SHA for Plan B.

---

## Self-Review

- **Spec coverage:** §4.1 LocalAttestationObserver → Task 1; §4.2 verifyLocalBundle → Task 2; §4.3 selector + CLI wiring → Tasks 3–4; §4.4 honesty strings → Task 4 Step 3 copy; §4.5 tests → Tasks 1–3; §4.6 publish → Task 5. All covered.
- **Placeholder scan:** all steps contain real code/commands; no TBD/TODO.
- **Type consistency:** `LocalAttestationObserver` exposes `headHash`/`bundlePath`/`records`/`flush` (Tasks 1,3,4); `verifyLocalBundle(bundle)` returns `{ ok, count, brokenAt? }` (Tasks 2,4); `AttestationSelection` has `kind`/`observer`/`treeship?`/`local?` (Tasks 3,4). Names match across tasks.

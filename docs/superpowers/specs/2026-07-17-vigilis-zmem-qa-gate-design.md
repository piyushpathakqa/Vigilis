# Vigilis → ZMem: report-only QA gate (design)

**Date:** 2026-07-17
**Status:** Approved (brainstorm) → Plan A implemented & shipped as `vigilis@0.5.1` (2026-07-20; `0.5.0` deprecated — wrong `--version` string). Plan B pending.
**Origin:** Revaz (ZerkerLabs) asked whether Vigilis can serve as an automated QA gate for ZMem. Piyush has owner access to `zerkerlabs`. This is internal dogfooding: ZMem becomes Vigilis's first external user and reference story.

---

## 1. Goal & success criteria

Land a PR to `zerkerlabs/zmem` that adds a **report-only** GitHub Actions job which:

1. Boots ZMem's Python review dashboard.
2. Has **Vigilis** generate / run / self-heal a thin Playwright E2E suite against it.
3. **Attests** the session with a local, hash-chained attestation bundle (no secrets required).

**Done when:** on a ZMem PR, the job runs green, uploads (a) a Playwright report and (b) an attestation bundle summarized as "N artifacts, chain intact (unsigned)", and does **not** block merges. Verified on a throwaway ZMem branch before we call it complete.

**Explicit non-goals (this slice):** blocking the gate, broad dashboard coverage, testing the CLI/MCP surface, testing the React marketing site (`site/`).

---

## 2. Decisions (locked during brainstorm)

| Decision | Choice | Why |
|---|---|---|
| Target surface | ZMem **Python review dashboard** (`zerker_memory/dashboard.py`, `127.0.0.1:8765`) | Only genuinely stateful browser surface (promote/reject/revoke, receipt inspector). "Vigilis attests the console where ZMem shows its own proofs." |
| Scope | **Thin vertical slice** — 4 specs | Land the whole loop end-to-end; widen later (Vigilis H1). |
| Gate mode | **Report-only** first (`continue-on-error`) | Build trust in the signal before it can block ZMem merges. |
| Attestation | **Local provider by default**, Treeship if secret present | ZMem CI must pass with zero secrets (CLAUDE.md non-negotiable). |
| Consumption | **`npx vigilis@<ver>`** (published) | Keeps the ZMem PR self-contained; no vendored Vigilis source. |
| Vigilis change first | **Yes — add local attestation provider** (Path 2) | 0.4.0 has no real local provider; without Treeship it silently skips attestation. The "local by default" decision is unsatisfiable until this ships. |

---

## 3. Context verified in the code

**ZMem dashboard** (`zerker_memory/dashboard.py`)
- `ThreadingHTTPServer` + `BaseHTTPRequestHandler`, single `INDEX_HTML` page (server-rendered HTML + vanilla JS).
- Launch: `python -m zerker_memory.dashboard --host 127.0.0.1 --port 8765` (also a `zmem ui` CLI subcommand, `cli.py:820`).
- Stateful actions: `data-action="promote|reject|revoke"` buttons (`dashboard.py:540–542`), Export Snapshot, injection preview, receipt inspector. Panels: Proof Inspector, Memory In Use, Memory Status, Claim Conflicts.
- CI today (`.github/workflows/test.yml`): Python unittest + `zerker eval` + release smoke. **No browser/E2E coverage.**

**Vigilis** (`argus` repo)
- Attested gate loop = the **`heal`** command: `treeship session start` → run → `treeship session close` → seals a receipt (`packages/cli/src/index.ts:364–469`). `generate`/`smoke` use `ConsoleObserver` only (no attestation); `smoke` is explore-and-print.
- Observer seam = `AgentObserver` (`packages/core/src/agent/observer.ts:12`). `TreeshipObserver` chains records via `parentId`, exposes `flush()` + `headId` (`packages/core/src/agent/treeship-observer.ts`).
- **Gap:** when the `treeship` CLI is absent, `createTreeshipObserver` returns `null` — the loop degrades to *no attestation at all* (`index.ts:364` comment; `treeship-observer.ts:86–90`). There is **no** positive local attestation provider today, despite CLAUDE.md §2 mandating one.
- CLI package: name `vigilis`, v0.4.0, `publishConfig.access = public`, `bin: {vigilis, argus}` — **not yet published to npm** (`@argus/cli` and `vigilis` both 404). Base URL targeting works via `ARGUS_BASE_URL` / `--baseUrl` / config.

---

## 4. Workstream A — `LocalAttestationObserver` (Vigilis) → publish `vigilis@0.5.0`

The one real code change. Ships in the `argus` repo, then publish.

### 4.1 Component
`packages/core/src/agent/local-attestation-observer.ts` — an `AgentObserver` that produces a tamper-evident, hash-chained attestation bundle on disk with **zero external dependencies** (Node built-in `crypto` only).

- Implements the seam: `onLoopStart`, `onModelResponse`, `onToolCall`, `onToolResult`, `onLoopEnd`.
- Mirrors `TreeshipObserver`'s public shape: `flush(): Promise<void>`, `readonly headId` (here: `headHash`).
- Per event, appends an **append-only record**:
  `{ seq, timestamp, type, actor, action, meta, prevHash, hash }`.
- `hash = sha256(canonicalJSON(record without hash field))`; each record embeds the previous record's `hash` as `prevHash`. Editing/removing any step breaks every later hash → tamper-evident.
- **No custom crypto, no key management, unsigned by design** (honors CLAUDE.md §3 / §7 — local bundles are "chain intact, unsigned"; signing stays a provider concern).
- On `flush()` / loop end, writes `.vigilis/attestation/<label>-<slug>.json`:
  `{ records[], headHash, count, signed: false, chainIntact: true, createdAt }`.
- Records include, per CLAUDE.md §3: inputs, model/step, the decision + rationale (e.g. triage `dom-drift` vs `behavior-change`), the action taken, the result, timestamp.

### 4.2 Verifier
`verifyLocalBundle(path): { ok: boolean; count: number; brokenAt?: number }` — re-walks the chain, recomputes each hash, confirms linkage. Powers the summary line
`[vigilis] local attestation: <N> artifacts, chain intact (unsigned)`.

### 4.3 Selection (non-invasive)
`createAttestationObserver({ label, preferTreeship })`:
- Returns `createTreeshipObserver(...)` when the Treeship CLI/secret is available;
- **else** returns a `LocalAttestationObserver`.
- Wire into `heal` (and `generate`) at the current `createTreeshipObserver` call site (`index.ts:366`); keep composing with `ConsoleObserver`. Print the local summary + bundle path at the end when the local path is used.
- No formal `AttestationProvider` interface refactor this slice (YAGNI); the selector is the seam. Door left open for a fuller abstraction later.

### 4.4 Honesty constraints
User-facing strings use "verifiable" / "auditable" / "chain intact" / "unsigned (local)". Never "guarantees correctness." A triage that flags a genuine behavior change records the decision + rationale (it is not hidden), and the spec fails — surfaced, not silently greened.

### 4.5 Tests (Vitest)
- Records chain in invocation order; `headHash` equals last record's hash.
- Tampering a middle record → `verifyLocalBundle` returns `ok: false` with correct `brokenAt`.
- `createAttestationObserver` falls back to local when Treeship is unavailable.
- Bundle is written and re-parseable; `verifyLocalBundle` on a fresh run returns `ok: true`.

### 4.6 Publish
Bump `vigilis` to `0.5.0`, build, `npm publish` (already `publishConfig.access: public`).
**Fallback if we defer publishing:** ZMem CI uses `npx github:<owner>/argus#<pinned-sha>` — still self-contained, no vendoring.

---

## 5. Workstream B — ZMem report-only QA gate (PR to `zerkerlabs/zmem`)

Config + seed + workflow. Consumes `npx vigilis@0.5.0`. All files land in the ZMem repo.

### 5.1 Scope — 4 specs against `http://127.0.0.1:8765`
1. **Dashboard loads** — Proof Inspector, Memory Status, Memory In Use panels render.
2. **Promote** a queued memory → it leaves the review queue / enters the proven zone.
3. **Reject** a queued memory → it leaves the queue; state reflects rejection.
4. **Receipt inspector** — inspecting a receipt shows a chain/verify result.

### 5.2 Data flow
```
ZMem PR ─▶ GH Actions job "vigilis-qa" (report-only, continue-on-error)
  1. pip install -e .                         # install ZMem
  2. python scripts/seed_review_state.py      # deterministic queued + proven memories
  3. python -m zerker_memory.dashboard --port 8765 &   # boot + wait-for-port
  4. npx vigilis@0.5.0 <generate|heal>        # ARGUS_BASE_URL=http://127.0.0.1:8765
       └─ generate → run → triage → heal, attesting every step (local provider)
  5. upload artifacts: playwright-report/ + .vigilis/attestation/*.json
```

### 5.3 Files (in ZMem)
- `.github/workflows/vigilis-qa.yml` — the report-only job (`continue-on-error: true`), Node + Python setup, wait-for-port, artifact upload.
- `scripts/seed_review_state.py` — deterministic seed via ZMem's own `MemoryStore` / `propose` / quarantine API, so the review queue has **≥1 promotable and ≥1 rejectable** memory. Self-asserting. Pinned to ZMem's store API (survives schema drift better than raw SQL).
- `vigilis.config.json` — `{ baseUrl: http://127.0.0.1:8765, provider: local, testDir: qa/e2e }`.
- `qa/e2e/*.spec.ts` — the curated/generated Playwright specs, committed for reproducibility + review.
- `docs/VIGILIS_QA.md` — what it is, run-locally steps, how to flip to blocking later.

### 5.4 Selector stability
The dashboard is server-rendered vanilla JS with few stable hooks; expect early heal churn. If flaky, add a small, isolated set of `data-testid`s to `INDEX_HTML` in `dashboard.py` (approved). Keep it minimal.

### 5.5 Verification of the gate
- Local: `python -m zerker_memory.dashboard` + `npx vigilis heal` against it → green; bundle written; `verifyLocalBundle` ok.
- Seed script self-assertion (queue has promotable + rejectable items).
- Prove the workflow on a throwaway ZMem branch/PR before finalizing.

---

## 6. Risks / open items

- **npm publish** is a hard dependency for the `npx vigilis@0.5.0` path (mitigated: `npx github:` pinned-sha fallback). Confirm the `vigilis` name is available/owned on npm before publishing; if taken, publish as a scoped name (e.g. `@zerkerlabs/vigilis` or `@vigilis/cli`) and update the ZMem `npx` invocation to match.
- **Seed script is the linchpin** — promote/reject are meaningless against an empty queue. Pin to ZMem's store API, self-assert.
- **Selector stability** — vanilla-JS dashboard; may need a few `data-testid`s (approved, isolated to `dashboard.py`).
- **Local attestation is unsigned** — real independent-notary proof still requires Treeship (opt-in via secret). Strings must not overstate.

---

## 7. Sequencing

Two independent implementation plans, run in order:
1. **Plan A** — `LocalAttestationObserver` + selector + tests in `argus`; publish `vigilis@0.5.0`.
2. **Plan B** — ZMem seed + config + workflow + specs; PR to `zerkerlabs/zmem`; verify report-only run.

Plan B depends on Plan A being published (or the `npx github:` fallback).

# Refusal actions — Slack alert + Linear ticket (TRE-77)

> **Status:** Design, 2026-06-30. Grounded in a codebase map of the heal/refusal
> flow and the existing cloud-reporter hook.
> **Goal:** When the agent refuses to heal a `real-bug`, fire optional, env-gated
> actions — a Slack message and an auto-filed Linear ticket — each linking the
> signed receipt. No config ⇒ no-op. OSS core stays clean.

## Why

A refusal (agent triaged a failure as a genuine behaviour change, refused to
heal, failed the gate) is the highest-value event Vigilis produces. Today it
only surfaces in run output + the signed receipt. This pushes it where teams
work: a Slack alert for immediate eyes, and a Linear ticket so the suspected
regression is tracked.

## Architecture — mirror the cloud-reporter

The existing optional cloud-reporter is the template (`packages/core/src/cloud/`):
interface + `Noop` impl, a `resolve…()` factory gated on an env var, fetch with
an `AbortController` timeout that swallows all errors, invoked from the CLI
`heal` command's `finally` block after the Treeship receipt is sealed.

**New module:** `packages/core/src/actions/`
```
types.ts          RefusalPayload, RefusalAction, RefusalActionResult, NoopRefusalAction, fingerprint()
slack-action.ts   SlackRefusalAction   (Incoming Webhook POST, fetchFn-injected)
linear-action.ts  LinearRefusalAction  (Linear GraphQL: search-then-create, fetchFn-injected)
dispatcher.ts     RefusalDispatcher + resolveRefusalDispatcher() factory (env gating + Slack/Linear orchestration)
index.ts          re-exports
```
Add `export * from './actions'` to `packages/core/src/index.ts` (next to `export * from './cloud'`).

**OSS-clean boundary (CLAUDE.md §5):** `types.ts` has no third-party imports.
Slack/Linear impls use only `globalThis.fetch` (Node built-in — **no new
dependency**, no `@slack/*` or `@linear/sdk`). No paid-layer import.

### Types (`types.ts`)

```ts
export interface RefusalPayload {
  specPath: string;
  url: string;
  rationale: string;
  expected?: string;       // best-effort, parsed from the failure if available
  actual?: string;
  confidence?: string;     // 'low' | 'medium' | 'high'
  framework?: string;
  repo?: string;           // owner/name slug, best-effort
  receiptUrl?: string;     // signed Treeship receipt, if sealed
  timestamp: string;       // ISO
}

export interface RefusalActionResult {
  ok: boolean;             // delivered (or skipped as a no-op) without error
  created?: boolean;       // Linear: a NEW ticket was filed (false = dedup hit)
  url?: string;            // Linear: the ticket url (new or existing)
  skippedReason?: string;  // e.g. 'unconfigured', 'duplicate'
}

export interface RefusalAction {
  readonly name: string;                                  // 'slack' | 'linear'
  notify(p: RefusalPayload): Promise<RefusalActionResult>; // MUST never throw
}

export class NoopRefusalAction implements RefusalAction {
  readonly name = 'noop';
  async notify(): Promise<RefusalActionResult> { return { ok: true, skippedReason: 'unconfigured' }; }
}

/** Stable, content-addressed id for one refusal — drives idempotency. */
export function fingerprint(p: RefusalPayload): string; // sha256(repo\nspec\n'real-bug'\nexpected|actual|rationale).slice(0,12)
```

### Dispatcher (`dispatcher.ts`)

`resolveRefusalDispatcher({ fetchFn? })` reads env once and builds the action
set:
- `SLACK_WEBHOOK_URL` present → add `SlackRefusalAction`.
- `LINEAR_API_KEY` **and** `LINEAR_TEAM_ID` present → add `LinearRefusalAction`
  (`LINEAR_PROJECT_ID`, `LINEAR_LABEL` optional; label default `vigilis-refusal`).
- Neither → dispatcher holds only `NoopRefusalAction`.

`dispatch(payload)` orchestration (this is where Slack/Linear dedup couples):
1. If a Linear action is configured, run it first → `RefusalActionResult`
   (`created` true/false via search-then-create).
2. Slack action runs **unless** Linear ran and returned `created === false`
   (a dedup hit ⇒ this refusal was already filed ⇒ stay quiet). When Linear
   isn't configured, Slack runs on every refusal. When Slack runs and a ticket
   url exists, include it in the message.
3. Returns a summary `{ results: RefusalActionResult[] }`. Never throws.

### Slack action (`slack-action.ts`)

POST to the incoming webhook with a compact block message:
> :no_entry: *Vigilis refused to heal* — suspected real regression (behaviour
> change). Deploy blocked.
> `<specPath>` · `<repo>` · expected `<expected>`, got `<actual>`
> _<rationale>_
> Verify the signed receipt: `<receiptUrl>`  ·  (ticket: `<linearUrl>`)

`AbortController` 8s timeout; non-2xx and network errors swallowed → `{ ok:false }`.

### Linear action (`linear-action.ts`)

Linear GraphQL (`https://api.linear.app/graphql`, header `Authorization: <LINEAR_API_KEY>`):
1. **Search** `issueSearch(query: "vigilis-fingerprint: <fp>")` for an existing
   issue that is **not** completed/cancelled. Found ⇒ return
   `{ ok:true, created:false, url }` (no duplicate).
2. **Create** otherwise: `issueCreate` with `teamId` (+ optional `projectId`,
   label), title `Refusal: <spec> — suspected real bug`, description = details +
   receipt link + a trailing marker line `vigilis-fingerprint: <fp>` (so the
   next run's search matches). Return `{ ok:true, created:true, url }`.

All errors swallowed → `{ ok:false }`. The fingerprint marker is the stateless
dedup key — no local store needed.

### Wire-up (`packages/cli/src/index.ts`, heal command)

In the existing `finally` block, **after** `reporter.report(receipt)` and the
`if (cloudVerdict)` guard:
```ts
if (cloudVerdict?.verdict === 'real-bug') {
  const dispatcher = resolveRefusalDispatcher();
  await dispatcher.dispatch({
    specPath: opts.spec, url, rationale: cloudVerdict.rationale,
    confidence: cloudVerdict.confidence, framework: adapter.name,
    repo: await repoSlug(), receiptUrl: receiptUrl ?? undefined,
    timestamp: new Date().toISOString(),
  });
}
```
`finally` is required so `receiptUrl` is populated (it resolves only after the
Treeship session seals). The dispatcher itself is resolved lazily here (cheap;
env-gated). `expected`/`actual` are passed when the triage/run exposes them;
otherwise omitted.

## Config — env only (v1)

| Var | Required for | Purpose |
|---|---|---|
| `SLACK_WEBHOOK_URL` | Slack | Incoming-webhook URL (channel-bound) |
| `LINEAR_API_KEY` | Linear | Personal/api key (header auth) |
| `LINEAR_TEAM_ID` | Linear | Target team (create requires it) |
| `LINEAR_PROJECT_ID` | — | Optional target project |
| `LINEAR_LABEL` | — | Optional, default `vigilis-refusal` |

Env-only matches the cloud-reporter precedent; **not** added to
`vigilis.config.json` in v1.

## Honesty (CLAUDE.md §3)

Copy says *"refused to heal — **suspected** real regression (behaviour change)."*
Never "confirmed bug" or any correctness guarantee. Every artifact links the
signed receipt for independent verification. The wording is verifiable/auditable.

## Out of scope (v1)

- Per-repo Slack-channel / Linear-project routing.
- Config-file (`vigilis.config.json`) keys for these.
- Stateful Slack-only dedup when Linear is unconfigured (needs a store CI lacks).
- Re-opening a previously *closed* Linear ticket when the same refusal recurs
  (v1 only skips on an *open* match; a closed match is treated as resolved → new
  ticket). Documented, not implemented.
- GitHub-issue / PagerDuty / generic-webhook actions (interface allows them later).

## Acceptance criteria

- [ ] `RefusalAction` interface + `NoopRefusalAction` + `fingerprint()` in
      `actions/types.ts`, no third-party imports.
- [ ] `SlackRefusalAction` and `LinearRefusalAction`, fetch-injected, never throw.
- [ ] `resolveRefusalDispatcher()` returns a Noop-only dispatcher with no env;
      adds Slack/Linear only when their env vars are present.
- [ ] Dispatcher fires only for `real-bug`; heal/flake/pass never reach it
      (enforced at the CLI call site + covered by a dispatcher-level test).
- [ ] No config ⇒ no-op; `pnpm --filter @argus/core test` and the CLI build pass
      with **no** Slack/Linear/network env present.
- [ ] Slack message includes spec, repo, expected/actual (when present),
      rationale, and the receipt link; honest "suspected/verify" wording.
- [ ] Linear: search-then-create; a second dispatch with the same fingerprint
      returns `created:false` and files no duplicate (unit-tested with a fake
      fetch that records calls).
- [ ] Slack stays quiet on a Linear dedup hit; fires when Linear filed a new
      ticket or Linear is unconfigured (unit-tested).
- [ ] All network calls mocked via injected `fetchFn`; no live calls in tests.
- [ ] Docs: a short `docs/REFUSAL-ACTIONS.md` (env vars, behaviour, examples).

## Test plan (vitest, fetch-injection per the cloud-reporter tests)

- `actions/types.test.ts` — `fingerprint()` stable + differs on spec/repo change;
  `NoopRefusalAction` returns ok.
- `actions/slack-action.test.ts` — posts to webhook with expected payload;
  swallows non-2xx → `{ok:false}`; includes receipt + ticket links.
- `actions/linear-action.test.ts` — create path (issueCreate called, marker in
  body); dedup path (issueSearch returns open match → no issueCreate,
  `created:false`); errors swallowed.
- `actions/dispatcher.test.ts` — unconfigured → all noop; real-bug only;
  Slack-quiet-on-Linear-dedup; Slack-fires-when-created/Linear-absent.

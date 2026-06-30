# Refusal Actions (Slack + Linear) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On a `real-bug` refusal, fire optional, env-gated actions — a Slack alert and an auto-filed (deduped) Linear ticket — each linking the signed receipt, with no-op-without-config and never-throw guarantees.

**Architecture:** A new `packages/core/src/actions/` module mirroring the existing optional cloud-reporter (`packages/core/src/cloud/`): a `RefusalAction` interface + `Noop`, Slack and Linear implementations (global `fetch` only, dependency-injected for tests), and a `RefusalDispatcher` resolved by env vars. Wired into the CLI `heal` command's `finally` block, gated on `verdict === 'real-bug'`.

**Tech Stack:** TypeScript (ESM), Node built-ins (`node:crypto`, global `fetch`), Vitest. No new runtime dependencies.

## Global Constraints

- **No new runtime dependency.** Slack/Linear use only `globalThis.fetch`; no `@slack/*`, `@linear/sdk`.
- **OSS-clean (CLAUDE.md §5):** `actions/types.ts` has no third-party imports; no paid-layer import. The `agent/` directory must not import actions — only the CLI (and the dispatcher) may.
- **No-op without config:** missing env vars ⇒ the action/dispatcher does nothing. The full `@argus/core` test suite and CLI build must pass with no Slack/Linear/network env present.
- **Never throw:** every `notify()` / `dispatch()` swallows all errors (network, non-2xx, timeout). A broken Slack/Linear must never break a heal/triage run. Bound every POST with an `AbortController` 8s timeout.
- **Fires only on refusal:** the dispatcher is invoked only when `verdict === 'real-bug'` (enforced at the CLI call site).
- **Honesty copy (CLAUDE.md §3):** messages say *"refused to heal — **suspected** real regression (behaviour change)"*; never "confirmed bug" or any correctness guarantee. Use **verifiable/auditable**. Every artifact links the signed receipt.
- **fetch injection in tests:** pass a fake `fetchFn` (constructor/opts param), never patch `globalThis.fetch`. Clean up env in `afterEach`. Pattern: `packages/core/src/cloud/http-reporter.test.ts`.
- **Test command:** `pnpm --filter @argus/core test` (or `cd packages/core && pnpm test`). Typecheck: `pnpm --filter @argus/core typecheck`, `pnpm --filter @argus/cli typecheck`.

---

### Task 1: `RefusalAction` types + `fingerprint()`

**Files:**
- Create: `packages/core/src/actions/types.ts`
- Test: `packages/core/src/actions/types.test.ts`

**Interfaces:**
- Produces:
  - `RefusalPayload` (object below — note `ticketUrl?` is filled by the dispatcher, not the caller)
  - `RefusalActionResult { ok: boolean; created?: boolean; url?: string; skippedReason?: string }`
  - `interface RefusalAction { readonly name: string; notify(payload: RefusalPayload): Promise<RefusalActionResult> }`
  - `class NoopRefusalAction implements RefusalAction`
  - `function fingerprint(p: RefusalPayload): string` — 12-hex-char sha256 over `repo, specPath, 'real-bug', expected, actual, rationale` (NOT timestamp/receiptUrl, so CI re-runs match).

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/actions/types.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { NoopRefusalAction, fingerprint, type RefusalPayload } from './types';

const base: RefusalPayload = {
  specPath: 'tests/checkout-total.spec.ts',
  url: 'https://acme.example/checkout',
  rationale: 'expected $49.00, got $0.00; behaviour changed, not drift',
  expected: '$49.00',
  actual: '$0.00',
  repo: 'acme/web',
  timestamp: '2026-06-30T00:00:00.000Z',
};

describe('fingerprint', () => {
  it('is stable for the same refusal content', () => {
    expect(fingerprint(base)).toBe(fingerprint({ ...base }));
  });

  it('ignores timestamp and receiptUrl so CI re-runs dedupe', () => {
    const rerun = { ...base, timestamp: '2026-07-01T12:00:00.000Z', receiptUrl: 'https://t.dev/x' };
    expect(fingerprint(rerun)).toBe(fingerprint(base));
  });

  it('differs when spec or repo changes', () => {
    expect(fingerprint({ ...base, specPath: 'tests/login.spec.ts' })).not.toBe(fingerprint(base));
    expect(fingerprint({ ...base, repo: 'acme/checkout' })).not.toBe(fingerprint(base));
  });

  it('is a 12-char hex string', () => {
    expect(fingerprint(base)).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe('NoopRefusalAction', () => {
  it('returns ok with an unconfigured reason and does nothing', async () => {
    const r = await new NoopRefusalAction().notify(base);
    expect(r).toEqual({ ok: true, skippedReason: 'unconfigured' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @argus/core exec vitest run src/actions/types.test.ts`
Expected: FAIL — cannot resolve `./types` / `fingerprint` not defined.

- [ ] **Step 3: Write minimal implementation**

Create `packages/core/src/actions/types.ts`:

```ts
/**
 * Refusal-action contract (TRE-77).
 *
 * The optional "on refusal, do something" seam — Slack alert, Linear ticket —
 * mirroring the cloud-reporter open-core boundary (packages/core/src/cloud):
 *   - OPTIONAL: no-op when unconfigured.
 *   - NEVER-THROW: notify() must never throw; a broken Slack/Linear must never
 *     break a heal/triage run.
 *   - OSS-CLEAN: no third-party imports here; no paid-layer import. The agent/
 *     directory must not import this module — only the CLI / dispatcher may.
 */
import { createHash } from 'node:crypto';

/** Everything known about a single refusal, at the moment the gate is blocked. */
export interface RefusalPayload {
  specPath: string;
  url: string; // app under test
  rationale: string;
  expected?: string; // best-effort, when the failure exposes it
  actual?: string;
  confidence?: string; // 'low' | 'medium' | 'high'
  framework?: string;
  repo?: string; // git remote slug, best-effort
  receiptUrl?: string; // signed Treeship receipt, when sealed
  /** Filled by the dispatcher from the Linear result (if a ticket was filed). */
  ticketUrl?: string;
  timestamp: string; // ISO-8601
}

export interface RefusalActionResult {
  ok: boolean; // delivered (or no-op) without error
  created?: boolean; // Linear: a NEW ticket was filed (false = dedup hit)
  url?: string; // Linear: ticket url (new or existing)
  skippedReason?: string; // e.g. 'unconfigured'
}

/** Swappable refusal action. Implementations MUST never throw from notify(). */
export interface RefusalAction {
  readonly name: string;
  notify(payload: RefusalPayload): Promise<RefusalActionResult>;
}

/** Default no-op — used when nothing is configured. Zero behaviour change. */
export class NoopRefusalAction implements RefusalAction {
  readonly name = 'noop';
  async notify(): Promise<RefusalActionResult> {
    return { ok: true, skippedReason: 'unconfigured' };
  }
}

/**
 * Stable, content-addressed id for one refusal. Excludes timestamp/receiptUrl
 * so the same refusal on a CI re-run produces the same fingerprint (drives the
 * Linear search-then-create dedup).
 */
export function fingerprint(p: RefusalPayload): string {
  const basis = [p.repo ?? '', p.specPath, 'real-bug', p.expected ?? '', p.actual ?? '', p.rationale].join('\n');
  return createHash('sha256').update(basis).digest('hex').slice(0, 12);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @argus/core exec vitest run src/actions/types.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/actions/types.ts packages/core/src/actions/types.test.ts
git commit -m "feat(core): RefusalAction types + fingerprint() (TRE-77)"
```

---

### Task 2: `SlackRefusalAction`

**Files:**
- Create: `packages/core/src/actions/slack-action.ts`
- Test: `packages/core/src/actions/slack-action.test.ts`

**Interfaces:**
- Consumes: `RefusalAction`, `RefusalActionResult`, `RefusalPayload` from `./types`.
- Produces:
  - `class SlackRefusalAction implements RefusalAction` — `constructor(opts: { webhookUrl: string; fetchFn?: typeof fetch })`; `name = 'slack'`; POSTs `{ text }` to the webhook; returns `{ ok: res.ok }`; swallows errors → `{ ok: false }`.
  - `function slackText(p: RefusalPayload): string` — the message body.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/actions/slack-action.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SlackRefusalAction, slackText } from './slack-action';
import type { RefusalPayload } from './types';

const p: RefusalPayload = {
  specPath: 'tests/checkout-total.spec.ts',
  url: 'https://acme.example/checkout',
  rationale: 'behaviour changed, not selector drift',
  expected: '$49.00',
  actual: '$0.00',
  repo: 'acme/web',
  receiptUrl: 'https://treeship.dev/receipt/ssn_8f31c0',
  timestamp: '2026-06-30T00:00:00.000Z',
};

describe('slackText', () => {
  it('uses honest "suspected" wording and links the receipt', () => {
    const t = slackText(p);
    expect(t).toContain('refused to heal');
    expect(t).toContain('suspected real regression');
    expect(t).toContain('tests/checkout-total.spec.ts');
    expect(t).toContain('$49.00');
    expect(t).toContain('https://treeship.dev/receipt/ssn_8f31c0');
    expect(t).not.toContain('confirmed bug');
  });

  it('includes the ticket link when the dispatcher supplied one', () => {
    expect(slackText({ ...p, ticketUrl: 'https://linear.app/x/issue/TRE-99' })).toContain('TRE-99');
  });

  it('omits the assertion line when expected/actual are absent', () => {
    const t = slackText({ ...p, expected: undefined, actual: undefined });
    expect(t).not.toContain('expected');
  });
});

describe('SlackRefusalAction.notify', () => {
  it('POSTs JSON {text} to the webhook and returns ok', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fakeFetch = (async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;

    const r = await new SlackRefusalAction({ webhookUrl: 'https://hooks.slack.test/xyz', fetchFn: fakeFetch }).notify(p);
    expect(r.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://hooks.slack.test/xyz');
    expect(calls[0]!.init.method).toBe('POST');
    expect(JSON.parse(calls[0]!.init.body as string).text).toContain('refused to heal');
  });

  it('returns { ok:false } on a rejecting fetch (never throws)', async () => {
    const fakeFetch = (async () => { throw new Error('down'); }) as unknown as typeof fetch;
    const r = new SlackRefusalAction({ webhookUrl: 'https://x', fetchFn: fakeFetch });
    await expect(r.notify(p)).resolves.toEqual({ ok: false });
  });

  it('returns { ok:false } on a non-2xx response', async () => {
    const fakeFetch = (async () => new Response('no', { status: 500 })) as unknown as typeof fetch;
    const r = new SlackRefusalAction({ webhookUrl: 'https://x', fetchFn: fakeFetch });
    await expect(r.notify(p)).resolves.toEqual({ ok: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @argus/core exec vitest run src/actions/slack-action.test.ts`
Expected: FAIL — cannot resolve `./slack-action`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/core/src/actions/slack-action.ts`:

```ts
import type { RefusalAction, RefusalActionResult, RefusalPayload } from './types';

const SLACK_TIMEOUT_MS = 8000;

/** Builds the Slack message text. Honest "suspected" framing; links the receipt. */
export function slackText(p: RefusalPayload): string {
  const lines = [
    ':no_entry: *Vigilis refused to heal* — suspected real regression (behaviour change). Deploy blocked.',
    `*${p.specPath}*${p.repo ? ` · ${p.repo}` : ''}`,
  ];
  if (p.expected || p.actual) lines.push(`expected \`${p.expected ?? '?'}\`, got \`${p.actual ?? '?'}\``);
  lines.push(`_${p.rationale}_`);
  if (p.receiptUrl) lines.push(`Verify the signed receipt: ${p.receiptUrl}`);
  if (p.ticketUrl) lines.push(`Ticket: ${p.ticketUrl}`);
  return lines.join('\n');
}

/**
 * Posts a refusal alert to a Slack Incoming Webhook. Never throws — all errors
 * and non-2xx responses resolve to { ok: false }. `fetchFn` is injected so tests
 * never hit the network. No new runtime dependency: uses the global fetch.
 */
export class SlackRefusalAction implements RefusalAction {
  readonly name = 'slack';
  private readonly webhookUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(opts: { webhookUrl: string; fetchFn?: typeof fetch }) {
    this.webhookUrl = opts.webhookUrl;
    this.fetchFn = opts.fetchFn ?? globalThis.fetch;
  }

  async notify(p: RefusalPayload): Promise<RefusalActionResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SLACK_TIMEOUT_MS);
    try {
      const res = await this.fetchFn(this.webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: slackText(p) }),
        signal: controller.signal,
      });
      return { ok: res.ok };
    } catch {
      return { ok: false };
    } finally {
      clearTimeout(timer);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @argus/core exec vitest run src/actions/slack-action.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/actions/slack-action.ts packages/core/src/actions/slack-action.test.ts
git commit -m "feat(core): SlackRefusalAction — webhook alert on refusal (TRE-77)"
```

---

### Task 3: `LinearRefusalAction` (search-then-create, idempotent)

**Files:**
- Create: `packages/core/src/actions/linear-action.ts`
- Test: `packages/core/src/actions/linear-action.test.ts`

**Interfaces:**
- Consumes: `fingerprint`, `RefusalAction`, `RefusalActionResult`, `RefusalPayload` from `./types`.
- Produces:
  - `class LinearRefusalAction implements RefusalAction` — `constructor(opts: { apiKey: string; teamId: string; projectId?: string; labelId?: string; fetchFn?: typeof fetch })`; `name = 'linear'`.
  - `function linearTitle(p: RefusalPayload): string`
  - `function linearBody(p: RefusalPayload, fp: string): string` — includes the `vigilis-fingerprint: <fp>` marker line used for dedup.

> **External-API note for the implementer:** this calls the live Linear GraphQL API (`https://api.linear.app/graphql`, header `authorization: <apiKey>` — Linear uses the raw key, NOT `Bearer`). The query/mutation below match Linear's documented schema (`issueSearch`, `issueCreate`, `IssueCreateInput`). If a live smoke (Task 7) reveals a renamed field (e.g. `issueSearch` → `searchIssues`), adjust the query strings only; the dedup/create logic and tests stay the same. Unit tests use a fake `fetchFn` returning canned GraphQL JSON, so they pin the logic, not Linear's wire format.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/actions/linear-action.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { LinearRefusalAction, linearTitle, linearBody } from './linear-action';
import { fingerprint, type RefusalPayload } from './types';

const p: RefusalPayload = {
  specPath: 'tests/checkout-total.spec.ts',
  url: 'https://acme.example/checkout',
  rationale: 'behaviour changed, not selector drift',
  expected: '$49.00',
  actual: '$0.00',
  repo: 'acme/web',
  receiptUrl: 'https://treeship.dev/receipt/ssn_8f31c0',
  timestamp: '2026-06-30T00:00:00.000Z',
};

/** A fake fetch that routes Linear GraphQL by the operation in the query string. */
function linearFetch(handlers: { search: () => unknown; create: () => unknown }) {
  const bodies: string[] = [];
  const fn = (async (_url: string | URL, init?: RequestInit) => {
    const body = String(init?.body ?? '');
    bodies.push(body);
    const data = body.includes('issueCreate') ? handlers.create() : handlers.search();
    return new Response(JSON.stringify({ data }), { status: 200 });
  }) as unknown as typeof fetch;
  return { fn, bodies };
}

describe('linearBody', () => {
  it('embeds the dedup marker and honest framing', () => {
    const b = linearBody(p, fingerprint(p));
    expect(b).toContain(`vigilis-fingerprint: ${fingerprint(p)}`);
    expect(b).toContain('refused to heal');
    expect(b).toContain('verifiable and auditable');
    expect(b).toContain('https://treeship.dev/receipt/ssn_8f31c0');
    expect(linearTitle(p)).toContain('Refusal:');
  });
});

describe('LinearRefusalAction.notify', () => {
  it('creates a ticket when no open match exists', async () => {
    const { fn, bodies } = linearFetch({
      search: () => ({ issueSearch: { nodes: [] } }),
      create: () => ({ issueCreate: { success: true, issue: { url: 'https://linear.app/x/issue/TRE-99' } } }),
    });
    const r = await new LinearRefusalAction({ apiKey: 'lin_k', teamId: 'team_1', fetchFn: fn }).notify(p);
    expect(r).toEqual({ ok: true, created: true, url: 'https://linear.app/x/issue/TRE-99' });
    expect(bodies).toHaveLength(2); // search then create
    expect(bodies[1]).toContain(`vigilis-fingerprint: ${fingerprint(p)}`);
  });

  it('skips creation when an OPEN ticket with the fingerprint exists (idempotent)', async () => {
    const { fn, bodies } = linearFetch({
      search: () => ({ issueSearch: { nodes: [{ url: 'https://linear.app/x/issue/TRE-50', state: { type: 'started' } }] } }),
      create: () => { throw new Error('must not create'); },
    });
    const r = await new LinearRefusalAction({ apiKey: 'lin_k', teamId: 'team_1', fetchFn: fn }).notify(p);
    expect(r).toEqual({ ok: true, created: false, url: 'https://linear.app/x/issue/TRE-50' });
    expect(bodies).toHaveLength(1); // search only
  });

  it('treats a completed/cancelled match as resolved and files a new ticket', async () => {
    const { fn } = linearFetch({
      search: () => ({ issueSearch: { nodes: [{ url: 'https://linear.app/x/issue/TRE-1', state: { type: 'completed' } }] } }),
      create: () => ({ issueCreate: { success: true, issue: { url: 'https://linear.app/x/issue/TRE-100' } } }),
    });
    const r = await new LinearRefusalAction({ apiKey: 'lin_k', teamId: 'team_1', fetchFn: fn }).notify(p);
    expect(r).toEqual({ ok: true, created: true, url: 'https://linear.app/x/issue/TRE-100' });
  });

  it('returns { ok:false } on a rejecting fetch (never throws)', async () => {
    const fn = (async () => { throw new Error('down'); }) as unknown as typeof fetch;
    const r = new LinearRefusalAction({ apiKey: 'lin_k', teamId: 'team_1', fetchFn: fn });
    await expect(r.notify(p)).resolves.toEqual({ ok: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @argus/core exec vitest run src/actions/linear-action.test.ts`
Expected: FAIL — cannot resolve `./linear-action`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/core/src/actions/linear-action.ts`:

```ts
import { fingerprint, type RefusalAction, type RefusalActionResult, type RefusalPayload } from './types';

const LINEAR_ENDPOINT = 'https://api.linear.app/graphql';
const LINEAR_TIMEOUT_MS = 8000;
const marker = (fp: string) => `vigilis-fingerprint: ${fp}`;

/** Issue title — prefixed so refusals are scannable in Linear. */
export function linearTitle(p: RefusalPayload): string {
  return `Refusal: ${p.specPath} — suspected real bug`;
}

/** Issue description — details + receipt link + the dedup marker (last line). */
export function linearBody(p: RefusalPayload, fp: string): string {
  return [
    'Vigilis **refused to heal** a failing test — triaged as a suspected real regression (behaviour change), not selector drift. The deploy gate was blocked.',
    '',
    `- **Spec:** \`${p.specPath}\``,
    p.repo ? `- **Repo:** ${p.repo}` : '',
    p.url ? `- **URL:** ${p.url}` : '',
    p.expected || p.actual ? `- **Assertion:** expected \`${p.expected ?? '?'}\`, got \`${p.actual ?? '?'}\`` : '',
    `- **Rationale:** ${p.rationale}`,
    p.receiptUrl ? `- **Signed receipt:** ${p.receiptUrl}` : '',
    '',
    '_Attestation is verifiable and auditable — it records what happened, not that the judgment is correct. Verify the receipt before acting._',
    '',
    marker(fp),
  ]
    .filter((l) => l !== '')
    .join('\n');
}

/**
 * Files a Linear ticket for a refusal. Idempotent: searches for an OPEN issue
 * carrying the refusal fingerprint and skips creation if one exists (so CI
 * re-runs don't duplicate). Never throws — all errors resolve to { ok:false }.
 * `fetchFn` injected for tests. No new runtime dependency (global fetch).
 */
export class LinearRefusalAction implements RefusalAction {
  readonly name = 'linear';
  private readonly apiKey: string;
  private readonly teamId: string;
  private readonly projectId?: string;
  private readonly labelId?: string;
  private readonly fetchFn: typeof fetch;

  constructor(opts: { apiKey: string; teamId: string; projectId?: string; labelId?: string; fetchFn?: typeof fetch }) {
    this.apiKey = opts.apiKey;
    this.teamId = opts.teamId;
    this.projectId = opts.projectId;
    this.labelId = opts.labelId;
    this.fetchFn = opts.fetchFn ?? globalThis.fetch;
  }

  private async gql<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LINEAR_TIMEOUT_MS);
    try {
      const res = await this.fetchFn(LINEAR_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: this.apiKey },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { data?: T };
      return json.data ?? null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async notify(p: RefusalPayload): Promise<RefusalActionResult> {
    const fp = fingerprint(p);

    // 1. Dedup: is there already an OPEN ticket for this exact refusal?
    const found = await this.gql<{ issueSearch: { nodes: Array<{ url: string; state: { type: string } }> } }>(
      'query($q:String!){ issueSearch(query:$q){ nodes{ url state{ type } } } }',
      { q: marker(fp) },
    );
    const open = found?.issueSearch?.nodes?.find((n) => n.state.type !== 'completed' && n.state.type !== 'canceled');
    if (open) return { ok: true, created: false, url: open.url };

    // 2. Create.
    const input: Record<string, unknown> = {
      teamId: this.teamId,
      title: linearTitle(p),
      description: linearBody(p, fp),
    };
    if (this.projectId) input.projectId = this.projectId;
    if (this.labelId) input.labelIds = [this.labelId];

    const created = await this.gql<{ issueCreate: { success: boolean; issue: { url: string } | null } }>(
      'mutation($input:IssueCreateInput!){ issueCreate(input:$input){ success issue{ url } } }',
      { input },
    );
    if (created?.issueCreate?.success && created.issueCreate.issue) {
      return { ok: true, created: true, url: created.issueCreate.issue.url };
    }
    return { ok: false };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @argus/core exec vitest run src/actions/linear-action.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/actions/linear-action.ts packages/core/src/actions/linear-action.test.ts
git commit -m "feat(core): LinearRefusalAction — idempotent ticket on refusal (TRE-77)"
```

---

### Task 4: `RefusalDispatcher` + module barrel + core export

**Files:**
- Create: `packages/core/src/actions/dispatcher.ts`
- Create: `packages/core/src/actions/index.ts`
- Modify: `packages/core/src/index.ts` (add `export * from './actions';`)
- Test: `packages/core/src/actions/dispatcher.test.ts`

**Interfaces:**
- Consumes: `NoopRefusalAction`/`RefusalActionResult`/`RefusalPayload` (`./types`), `SlackRefusalAction` (`./slack-action`), `LinearRefusalAction` (`./linear-action`).
- Produces:
  - `class RefusalDispatcher { dispatch(payload: RefusalPayload): Promise<{ results: RefusalActionResult[] }> }`
  - `function resolveRefusalDispatcher(opts?: { fetchFn?: typeof fetch }): RefusalDispatcher` — reads `SLACK_WEBHOOK_URL`, `LINEAR_API_KEY`, `LINEAR_TEAM_ID`, `LINEAR_PROJECT_ID`, `LINEAR_LABEL_ID`. Runs Linear first; Slack fires unless Linear returned a dedup hit (`created === false`); Slack receives `ticketUrl` from Linear's result. Both unset ⇒ no actions, `dispatch` makes zero calls.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/actions/dispatcher.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { resolveRefusalDispatcher } from './dispatcher';
import type { RefusalPayload } from './types';

const p: RefusalPayload = {
  specPath: 'tests/checkout-total.spec.ts',
  url: 'https://acme.example/checkout',
  rationale: 'behaviour changed',
  repo: 'acme/web',
  timestamp: '2026-06-30T00:00:00.000Z',
};

afterEach(() => {
  delete process.env.SLACK_WEBHOOK_URL;
  delete process.env.LINEAR_API_KEY;
  delete process.env.LINEAR_TEAM_ID;
  delete process.env.LINEAR_PROJECT_ID;
  delete process.env.LINEAR_LABEL_ID;
});

/** Records calls and answers Slack + Linear (search/create) by URL/body. */
function recorder(opts: { linearCreated?: boolean; existingUrl?: string } = {}) {
  const urls: string[] = [];
  const fn = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    urls.push(u);
    if (u.includes('api.linear.app')) {
      const body = String(init?.body ?? '');
      if (body.includes('issueCreate')) {
        return new Response(JSON.stringify({ data: { issueCreate: { success: true, issue: { url: 'https://linear.app/new' } } } }), { status: 200 });
      }
      const nodes = opts.existingUrl ? [{ url: opts.existingUrl, state: { type: 'started' } }] : [];
      return new Response(JSON.stringify({ data: { issueSearch: { nodes } } }), { status: 200 });
    }
    return new Response(null, { status: 200 }); // slack
  }) as unknown as typeof fetch;
  return { fn, urls };
}

describe('resolveRefusalDispatcher', () => {
  it('is a no-op when nothing is configured (zero network calls)', async () => {
    const { fn, urls } = recorder();
    const { results } = await resolveRefusalDispatcher({ fetchFn: fn }).dispatch(p);
    expect(urls).toHaveLength(0);
    expect(results).toHaveLength(0);
  });

  it('fires Slack only, when only SLACK_WEBHOOK_URL is set', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.test/z';
    const { fn, urls } = recorder();
    const { results } = await resolveRefusalDispatcher({ fetchFn: fn }).dispatch(p);
    expect(urls).toEqual(['https://hooks.slack.test/z']);
    expect(results).toHaveLength(1);
  });

  it('files a Linear ticket AND posts to Slack when Linear creates a new ticket', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.test/z';
    process.env.LINEAR_API_KEY = 'lin_k';
    process.env.LINEAR_TEAM_ID = 'team_1';
    const { fn, urls } = recorder({ linearCreated: true });
    const { results } = await resolveRefusalDispatcher({ fetchFn: fn }).dispatch(p);
    // search + create + slack
    expect(urls.filter((u) => u.includes('api.linear.app'))).toHaveLength(2);
    expect(urls.some((u) => u.includes('hooks.slack.test'))).toBe(true);
    expect(results).toHaveLength(2);
  });

  it('stays quiet on Slack when Linear finds an existing (dedup) ticket', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.test/z';
    process.env.LINEAR_API_KEY = 'lin_k';
    process.env.LINEAR_TEAM_ID = 'team_1';
    const { fn, urls } = recorder({ existingUrl: 'https://linear.app/x/issue/TRE-50' });
    const { results } = await resolveRefusalDispatcher({ fetchFn: fn }).dispatch(p);
    expect(urls.some((u) => u.includes('hooks.slack.test'))).toBe(false); // no slack
    expect(urls.filter((u) => u.includes('api.linear.app'))).toHaveLength(1); // search only
    expect(results).toHaveLength(1);
    expect(results[0]!.created).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @argus/core exec vitest run src/actions/dispatcher.test.ts`
Expected: FAIL — cannot resolve `./dispatcher`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/core/src/actions/dispatcher.ts`:

```ts
import type { RefusalActionResult, RefusalPayload } from './types';
import { SlackRefusalAction } from './slack-action';
import { LinearRefusalAction } from './linear-action';

/**
 * Orchestrates the configured refusal actions. Runs Linear first (so its ticket
 * url can be attached to the Slack message); Slack is suppressed when Linear
 * returned a dedup hit (created === false) — that means this refusal was already
 * filed on a prior run, so a CI re-run stays quiet. Never throws.
 */
export class RefusalDispatcher {
  constructor(
    private readonly slack: SlackRefusalAction | null,
    private readonly linear: LinearRefusalAction | null,
  ) {}

  async dispatch(payload: RefusalPayload): Promise<{ results: RefusalActionResult[] }> {
    const results: RefusalActionResult[] = [];
    let ticketUrl: string | undefined;
    let dedupHit = false;

    if (this.linear) {
      const r = await this.linear.notify(payload);
      results.push(r);
      ticketUrl = r.url;
      dedupHit = r.ok && r.created === false;
    }
    if (this.slack && !dedupHit) {
      results.push(await this.slack.notify({ ...payload, ticketUrl }));
    }
    return { results };
  }
}

/**
 * Build the dispatcher from env. No-op (no actions) unless configured:
 *   - SLACK_WEBHOOK_URL                     → Slack alert
 *   - LINEAR_API_KEY + LINEAR_TEAM_ID       → Linear ticket
 *     (LINEAR_PROJECT_ID, LINEAR_LABEL_ID optional)
 */
export function resolveRefusalDispatcher(opts: { fetchFn?: typeof fetch } = {}): RefusalDispatcher {
  const { fetchFn } = opts;
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  const slack = webhookUrl ? new SlackRefusalAction({ webhookUrl, fetchFn }) : null;

  const apiKey = process.env.LINEAR_API_KEY;
  const teamId = process.env.LINEAR_TEAM_ID;
  const linear =
    apiKey && teamId
      ? new LinearRefusalAction({
          apiKey,
          teamId,
          projectId: process.env.LINEAR_PROJECT_ID,
          labelId: process.env.LINEAR_LABEL_ID,
          fetchFn,
        })
      : null;

  return new RefusalDispatcher(slack, linear);
}
```

Create `packages/core/src/actions/index.ts`:

```ts
export * from './types';
export * from './slack-action';
export * from './linear-action';
export * from './dispatcher';
```

In `packages/core/src/index.ts`, add after the `export * from './cloud';` line (currently line 29):

```ts
export * from './actions';
```

- [ ] **Step 4: Run test + typecheck**

Run: `pnpm --filter @argus/core exec vitest run src/actions/dispatcher.test.ts`
Expected: PASS (4 tests).
Run: `pnpm --filter @argus/core typecheck`
Expected: PASS, no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/actions/dispatcher.ts packages/core/src/actions/index.ts packages/core/src/index.ts packages/core/src/actions/dispatcher.test.ts
git commit -m "feat(core): RefusalDispatcher + env factory; export actions (TRE-77)"
```

---

### Task 5: Wire the dispatcher into the CLI heal command

**Files:**
- Modify: `packages/cli/src/index.ts` (import; extend `cloudVerdict` to capture `confidence`; invoke dispatcher in `finally`)

**Interfaces:**
- Consumes: `resolveRefusalDispatcher` from `@argus/core` (Task 4).
- Produces: nothing new (call site only).

> No unit test: the CLI heal command has no harness (mirrors how the cloud-reporter wire-up is unverified by unit tests). Enforcement that actions fire **only** on `real-bug` lives in the `if` guard here; the dispatcher logic itself is covered by Task 4. Verified by typecheck + build + the Task 7 live smoke.

- [ ] **Step 1: Add the import**

In `packages/cli/src/index.ts`, the multi-line import from `'@argus/core'` ends at line 37 and already includes `resolveCloudReporter,` (line 31) and `type CloudReceipt,` (line 36). Add `resolveRefusalDispatcher,` to that block (next to `resolveCloudReporter,`):

```ts
  resolveCloudReporter,
  resolveRefusalDispatcher,
```

- [ ] **Step 2: Capture `confidence` on cloudVerdict**

Change the `cloudVerdict` declaration (line 359) to add `confidence`:

```ts
      let cloudVerdict: { verdict: string; rationale?: string; suggestedSelector?: string; confidence?: string } | null = null;
```

And in the capture block (lines 376–381) add the `confidence` field:

```ts
        if (v) {
          cloudVerdict = {
            verdict: v.verdict,
            rationale: v.rationale,
            suggestedSelector: v.suggestedSelector,
            confidence: v.confidence,
          };
        }
```

- [ ] **Step 3: Invoke the dispatcher in `finally`**

In the `finally` block, immediately AFTER the existing `if (cloudVerdict) { … await reporter.report(receipt); }` block (the block ends at line 475 with `}`) and BEFORE `await close();`, insert:

```ts
        // Optional refusal actions (Slack alert + Linear ticket). No-op unless
        // SLACK_WEBHOOK_URL / LINEAR_API_KEY+LINEAR_TEAM_ID are set; never throws.
        // Only on a refusal — the gate's most actionable event.
        if (cloudVerdict?.verdict === 'real-bug') {
          await resolveRefusalDispatcher().dispatch({
            specPath: opts.spec,
            url,
            rationale: cloudVerdict.rationale ?? '',
            confidence: cloudVerdict.confidence,
            framework: adapter.name,
            repo: await repoSlug(),
            receiptUrl: receiptUrl ?? undefined,
            timestamp: new Date().toISOString(),
          });
        }
```

- [ ] **Step 4: Typecheck + build**

Run: `pnpm --filter @argus/cli typecheck`
Expected: PASS.
Run: `pnpm --filter @argus/cli build`
Expected: build succeeds (tsup).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/index.ts
git commit -m "feat(cli): fire refusal actions (Slack+Linear) on real-bug refusal (TRE-77)"
```

---

### Task 6: Docs — `docs/REFUSAL-ACTIONS.md`

**Files:**
- Create: `docs/REFUSAL-ACTIONS.md`

**Interfaces:** none (documentation). Content must match the env vars and behaviour built in Tasks 1–5.

- [ ] **Step 1: Write the doc**

Create `docs/REFUSAL-ACTIONS.md`:

````markdown
# Refusal actions — Slack + Linear (TRE-77)

When Vigilis **refuses to heal** a failing test — i.e. it triaged the failure as
a **real regression** (behaviour change), not selector drift — it can push that
event to where your team works: a **Slack alert** and an auto-filed **Linear
ticket**. Both are optional and **off by default**; with no config, nothing
happens. They fire **only** on a `real-bug` refusal, never on heals or flakes.

> Honesty note: a refusal is a **suspected** real regression. Attestation is
> verifiable and auditable — it records what the agent decided, not that the
> decision is correct. Every alert/ticket links the signed receipt so you can
> verify before acting.

## Enable

Set environment variables wherever the agent runs (locally or in CI):

| Variable | Enables | Notes |
|---|---|---|
| `SLACK_WEBHOOK_URL` | Slack alert | A Slack [Incoming Webhook](https://api.slack.com/messaging/webhooks) URL (channel-bound). |
| `LINEAR_API_KEY` | Linear ticket | A Linear API key. Required with `LINEAR_TEAM_ID`. |
| `LINEAR_TEAM_ID` | Linear ticket | Target team id. |
| `LINEAR_PROJECT_ID` | — | Optional target project. |
| `LINEAR_LABEL_ID` | — | Optional label id to attach (e.g. a `vigilis-refusal` label you created). |

```bash
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/…"
export LINEAR_API_KEY="lin_api_…"
export LINEAR_TEAM_ID="…"          # optional: LINEAR_PROJECT_ID, LINEAR_LABEL_ID
vigilis heal --spec tests/checkout.spec.ts https://your-app.com
```

## Behaviour

- **Slack** posts a compact alert: the spec, repo, expected/actual (when known),
  the triage rationale, and the signed-receipt link.
- **Linear** is **idempotent**: it embeds a `vigilis-fingerprint: <hash>` marker
  in the ticket body and searches for an existing **open** ticket with that
  fingerprint before creating one. A CI re-run of the same refusal finds the
  open ticket and does **not** file a duplicate. (A previously *closed* ticket is
  treated as resolved — a recurrence files a new one.)
- **Slack + Linear together:** when both are configured, Slack stays quiet on a
  Linear dedup hit (the refusal was already filed), and the Slack message links
  the freshly-filed ticket when a new one is created.
- **Never breaks the run:** all network calls are best-effort with an 8s timeout;
  any failure is swallowed. A Slack/Linear outage cannot affect the gate.

## Fingerprint

The dedup id is `sha256(repo · spec · "real-bug" · expected · actual · rationale)`
(first 12 hex chars). It deliberately excludes the timestamp and receipt URL so
the same refusal across runs collapses to one ticket.
````

- [ ] **Step 2: Commit**

```bash
git add docs/REFUSAL-ACTIONS.md
git commit -m "docs: REFUSAL-ACTIONS.md — Slack + Linear setup and behaviour (TRE-77)"
```

---

### Task 7: Full verification (+ optional live smoke)

**Files:** none (verification only).

- [ ] **Step 1: Core test suite**

Run: `pnpm --filter @argus/core test`
Expected: PASS — all new `src/actions/*.test.ts` plus every pre-existing core test; nothing broken.

- [ ] **Step 2: Typecheck both packages**

Run: `pnpm --filter @argus/core typecheck && pnpm --filter @argus/cli typecheck`
Expected: PASS, no errors.

- [ ] **Step 3: Build**

Run: `pnpm --filter @argus/core build && pnpm --filter @argus/cli build`
Expected: both succeed.

- [ ] **Step 4: Confirm the no-op guarantee (no secrets)**

With NO `SLACK_WEBHOOK_URL` / `LINEAR_*` in the environment, re-run Step 1. The
suite must pass and make zero network calls (the dispatcher test asserts this).
This is the "no config ⇒ no-op" acceptance check.

- [ ] **Step 5 (OPTIONAL — needs real creds, creates a real ticket): live Linear smoke**

Only if the user provides `LINEAR_API_KEY` + `LINEAR_TEAM_ID` and wants to dogfood:
write a throwaway script in the scratchpad that imports `LinearRefusalAction`
from the built `@argus/core` and calls `notify()` with a sample payload twice.
Expected: first call creates a ticket (verify it appears in Linear with the
receipt link + marker); second call returns `created:false` (no duplicate). If
Linear renamed `issueSearch`/`issueCreate`, adjust the query strings in
`linear-action.ts` and re-run Tasks 1/7. Delete the test ticket afterward.
**Report that this step was skipped if creds weren't provided — do not fake it.**

---

## Self-Review notes

- **Spec coverage:** types+fingerprint → T1; Slack → T2; Linear search-then-create → T3; dispatcher env-gating + Slack-quiet-on-dedup → T4; CLI wire-up (real-bug only) → T5; docs → T6; acceptance/no-op/live-smoke → T7. The spec's `LINEAR_LABEL` (by name) is implemented as the simpler **`LINEAR_LABEL_ID`** (by id) to avoid a name→id lookup — noted in T6 docs and the spec's intent (a filterable label) is preserved; flag for the human if name-based labelling is required.
- **Type consistency:** `RefusalPayload` (incl. `ticketUrl?`, `confidence?`), `RefusalActionResult { ok, created?, url?, skippedReason? }`, `fingerprint()`, `resolveRefusalDispatcher({ fetchFn? })`, and the action constructor option shapes are identical across T1–T5. Linear auth header is the raw `apiKey` (no `Bearer`).
- **No placeholders:** every code/test step is complete; the only deferred item is the optional live smoke (external creds), explicitly marked skippable.

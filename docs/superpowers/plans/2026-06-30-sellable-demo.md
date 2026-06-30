# Sellable-Part Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a live, drivable demo of the *paid* governance cloud — a seeded "Acme Inc" org telling the dom-drift-healed / real-bug-refused / flake-quarantined receipt story, with a dev-only control to flip Free→Team→Enterprise live, plus a narrated `docs/DEMO.md` runbook.

**Architecture:** Reuse everything already built in `apps/cloud` (entitlements, `applyPlan`, dashboard gating, the existing Dev-login provider). Add (1) a `renameOrg` data helper, (2) a pure `seedDemo(orgId)` that populates the receipt story, (3) dev-only server actions + a header control that calls `applyPlan`/`seedDemo`, and (4) the runbook. Every demo affordance is gated behind the existing `devBypassEnabled()` so the real product path (GitHub OAuth, Stripe-driven plans) is untouched.

**Tech Stack:** Next.js 15 (App Router, server components + server actions), `node:sqlite` via `db.ts`, Auth.js v5, Vitest. Package manager: `pnpm`. Cloud package name: `@argus/cloud`.

## Global Constraints

- Honesty copy rule: attestation is **"verifiable"/"auditable"**, never a correctness guarantee (`CLAUDE.md` §3). No user-facing string may claim attestation guarantees correctness.
- All demo affordances MUST be inert unless `devBypassEnabled()` returns true (i.e. no GitHub creds configured). They must never touch the real product path.
- No new runtime dependencies. No `tsx`/standalone runner — the seed is invoked in-process via a Next server action (vitest covers the logic).
- Anything importing `db.ts`/`auth.ts` runs on the Node runtime (`node:sqlite`); the dashboard already sets `export const runtime = 'nodejs'`.
- Recognized verdict tokens are exactly `real-bug`, `dom-drift`, `flake` (see `app/page.tsx` `VERDICTS`); seeded receipts must use these.
- Plan tokens are exactly `free` | `team` | `enterprise` (`entitlements.ts` `Plan`).
- Tests use a temp DB via `process.env.VIGILIS_CLOUD_DB`, set before importing `db.ts` (see `src/db.test.ts`).

---

### Task 1: `renameOrg` data helper

`seedDemo` needs to rename the dev org to "Acme Inc". `db.ts` has no setter for the org name; add one next to `applyPlan`/`getOrg`.

**Files:**
- Modify: `apps/cloud/src/db.ts` (add `renameOrg`, near `applyPlan` ~line 393)
- Test: `apps/cloud/src/db.test.ts` (add a test)

**Interfaces:**
- Consumes: `getDb()`, `getOrg()`, `ensureUserAndOrg()` (existing in `db.ts`).
- Produces: `export function renameOrg(orgId: string, name: string): void` — updates `org.name`; no-op if the org id doesn't exist.

- [ ] **Step 1: Write the failing test**

Add to `apps/cloud/src/db.test.ts` (inside the existing top-level `describe`, or as a new `describe` — match the file's style):

```ts
it('renameOrg updates an org name and is a no-op for unknown ids', async () => {
  const { ensureUserAndOrg, renameOrg, getOrg } = await db();
  const { orgId } = ensureUserAndOrg({ email: 'rename@vigilis.local', name: 'Rename Me' });
  renameOrg(orgId, 'Acme Inc');
  expect(getOrg(orgId)?.name).toBe('Acme Inc');
  // Unknown id: must not throw.
  expect(() => renameOrg('org_does_not_exist', 'Nope')).not.toThrow();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @argus/cloud exec vitest run src/db.test.ts -t renameOrg`
Expected: FAIL — `renameOrg is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `apps/cloud/src/db.ts`, immediately after the `applyPlan` function (ends ~line 396), add:

```ts
/** Rename an org. Demo/admin helper; no-op if the org id is unknown. */
export function renameOrg(orgId: string, name: string): void {
  const db = getDb();
  db.prepare(`UPDATE org SET name = ? WHERE id = ?`).run(name, orgId);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @argus/cloud exec vitest run src/db.test.ts -t renameOrg`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/cloud/src/db.ts apps/cloud/src/db.test.ts
git commit -m "feat(cloud): renameOrg data helper for demo seed (TRE-60)"
```

---

### Task 2: `seedDemo` — the Acme Inc receipt story

A pure-ish, idempotent function that populates one org with the demo story: 3 repos, all three verdicts, the `real-bug → refused` star receipt, dated across ~60 days, plan reset to `free`.

**Files:**
- Create: `apps/cloud/src/demo-seed.ts`
- Test: `apps/cloud/src/demo-seed.test.ts`

**Interfaces:**
- Consumes: `renameOrg` (Task 1), `applyPlan`, `insertReceipt`, `ensureUserAndOrg`, `getOrg`, `getReceiptsForOrg`, `distinctReposForOrg`, `getEntitlements`, `type CloudReceipt` (all from `@/db`).
- Produces:
  - `export interface DemoSeedResult { orgId: string; orgName: string; receiptsInserted: number; receiptsTotal: number; }`
  - `export function seedDemo(orgId: string, now?: number): DemoSeedResult` — renames org to `Acme Inc`, sets plan `free`, inserts the fixed receipt set (idempotent via stable `receiptId`s); `now` defaults to `Date.now()` and is injectable for deterministic tests.

- [ ] **Step 1: Write the failing test**

Create `apps/cloud/src/demo-seed.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vigilis-demo-test-'));
  process.env.VIGILIS_CLOUD_DB = join(tmpDir, 'cloud.db');
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// Import after VIGILIS_CLOUD_DB is set so getDb() opens the temp file.
async function mods() {
  const db = await import('./db');
  const seed = await import('./demo-seed');
  return { ...db, ...seed };
}

describe('seedDemo (TRE-60)', () => {
  const NOW = Date.parse('2026-06-30T12:00:00Z');

  it('seeds the Acme story: 3 repos, all verdicts, the refused real-bug', async () => {
    const m = await mods();
    const { orgId } = m.ensureUserAndOrg({ email: 'seed@vigilis.local', name: 'Seed' });
    const result = m.seedDemo(orgId, NOW);

    expect(result.orgName).toBe('Acme Inc');
    expect(m.getOrg(orgId)?.name).toBe('Acme Inc');
    expect(m.getOrg(orgId)?.plan).toBe('free');
    expect(result.receiptsInserted).toBe(result.receiptsTotal);

    // 3 distinct repos so Free's 1-repo limit is exceeded (drives the nudge).
    expect(m.distinctReposForOrg(orgId)).toBe(3);

    const rows = m.getReceiptsForOrg(orgId);
    const verdicts = new Set(rows.map((r) => r.verdict));
    expect(verdicts).toEqual(new Set(['dom-drift', 'real-bug', 'flake']));

    // The star: at least one real-bug that was NOT healed and carries a rationale.
    const refused = rows.filter((r) => r.verdict === 'real-bug' && r.healed === 0);
    expect(refused.length).toBeGreaterThan(0);
    expect(refused.every((r) => (r.rationale ?? '').length > 0)).toBe(true);
  });

  it('is idempotent and resets plan to free', async () => {
    const m = await mods();
    const { orgId } = m.ensureUserAndOrg({ email: 'seed@vigilis.local', name: 'Seed' });
    const first = m.seedDemo(orgId, NOW);
    const before = m.getReceiptsForOrg(orgId).length;

    // Simulate a demo where the presenter upgraded, then reset.
    m.applyPlan(orgId, 'enterprise');
    const second = m.seedDemo(orgId, NOW);

    expect(second.receiptsInserted).toBe(0); // nothing new inserted
    expect(m.getReceiptsForOrg(orgId).length).toBe(before); // no duplicates
    expect(m.getOrg(orgId)?.plan).toBe('free'); // plan reset
    expect(first.receiptsTotal).toBe(second.receiptsTotal);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @argus/cloud exec vitest run src/demo-seed.test.ts`
Expected: FAIL — cannot resolve `./demo-seed` / `seedDemo` not defined.

- [ ] **Step 3: Write minimal implementation**

Create `apps/cloud/src/demo-seed.ts`:

```ts
/**
 * Demo seed (TRE-60) — populates one org with the "Acme Inc" receipt story used
 * to demo the sellable governance cloud. Idempotent: stable receiptIds dedupe on
 * re-run, and the plan is always reset to `free` so the demo starts at the wall.
 *
 * Pure of I/O beyond db.ts (which it drives through public helpers), so it is
 * fully unit-testable and can be invoked in-process from a server action — no
 * standalone runner needed. node:sqlite ⇒ Node runtime only.
 */
import {
  renameOrg,
  applyPlan,
  insertReceipt,
  type CloudReceipt,
} from '@/db';

const ORG_NAME = 'Acme Inc';

export interface DemoSeedResult {
  orgId: string;
  orgName: string;
  receiptsInserted: number;
  receiptsTotal: number;
}

type SeedReceipt = CloudReceipt & { receiptId: string };

/** The fixed demo story. `now` anchors the relative dates so tests are stable. */
function demoReceipts(now: number): SeedReceipt[] {
  const at = (daysAgo: number) => new Date(now - daysAgo * 86_400_000).toISOString();
  const base = { framework: 'playwright' as const };
  return [
    {
      ...base,
      receiptId: 'demo-web-login-domdrift',
      repo: 'acme/web',
      specPath: 'tests/login.spec.ts',
      url: 'https://acme.example/login',
      verdict: 'dom-drift',
      healed: true,
      suggestedSelector: 'getByRole("button", { name: "Sign in" })',
      rationale: 'Login button id changed (#login → #signin); same role/label. Cosmetic drift — healed.',
      timestamp: at(1),
    },
    {
      ...base,
      receiptId: 'demo-web-nav-flake',
      repo: 'acme/web',
      specPath: 'tests/nav.spec.ts',
      url: 'https://acme.example/',
      verdict: 'flake',
      healed: false,
      rationale: 'Assertion passed on retry without any DOM change — flaky timing. Quarantined, not healed.',
      timestamp: at(3),
    },
    {
      ...base,
      receiptId: 'demo-checkout-total-realbug',
      repo: 'acme/checkout',
      specPath: 'tests/checkout-total.spec.ts',
      url: 'https://acme.example/checkout',
      verdict: 'real-bug',
      healed: false,
      rationale:
        'Order total expected $90.00, rendered $108.00 — pricing logic changed, not the locator. ' +
        'This is a genuine behavior change; refusing to heal and failing loudly.',
      timestamp: at(2),
    },
    {
      ...base,
      receiptId: 'demo-checkout-coupon-domdrift',
      repo: 'acme/checkout',
      specPath: 'tests/coupon.spec.ts',
      url: 'https://acme.example/checkout',
      verdict: 'dom-drift',
      healed: true,
      suggestedSelector: 'getByLabel("Promo code")',
      rationale: 'Coupon field relabelled "Promo code"; same input. Cosmetic drift — healed.',
      timestamp: at(20),
    },
    {
      ...base,
      receiptId: 'demo-mobile-onboarding-domdrift',
      repo: 'acme/mobile',
      specPath: 'tests/onboarding.spec.ts',
      url: 'https://acme.example/m/onboarding',
      verdict: 'dom-drift',
      healed: true,
      suggestedSelector: 'getByText("Get started")',
      rationale: 'CTA copy changed "Start" → "Get started"; same element. Cosmetic drift — healed.',
      timestamp: at(40),
    },
    {
      ...base,
      receiptId: 'demo-mobile-paywall-realbug',
      repo: 'acme/mobile',
      specPath: 'tests/paywall.spec.ts',
      url: 'https://acme.example/m/paywall',
      verdict: 'real-bug',
      healed: false,
      rationale:
        'Paywall let a free user reach premium content — access control regressed. ' +
        'Genuine behavior change; refusing to heal.',
      timestamp: at(55),
    },
  ];
}

/**
 * Populate `orgId` with the Acme Inc demo story. Renames the org, resets it to
 * the `free` plan (so the demo starts at the upgrade wall), and inserts the
 * fixed receipt set. Idempotent — re-running inserts nothing new and re-resets
 * the plan.
 */
export function seedDemo(orgId: string, now: number = Date.now()): DemoSeedResult {
  renameOrg(orgId, ORG_NAME);
  applyPlan(orgId, 'free');
  const rows = demoReceipts(now);
  let inserted = 0;
  for (const r of rows) {
    if (insertReceipt(orgId, r).inserted) inserted++;
  }
  return {
    orgId,
    orgName: ORG_NAME,
    receiptsInserted: inserted,
    receiptsTotal: rows.length,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @argus/cloud exec vitest run src/demo-seed.test.ts`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add apps/cloud/src/demo-seed.ts apps/cloud/src/demo-seed.test.ts
git commit -m "feat(cloud): seedDemo — Acme Inc receipt story for the sellable demo (TRE-60)"
```

---

### Task 3: Dev-only demo controls (server actions + dashboard header)

Wire the live demo: a header control (visible only when `devBypassEnabled()`) that flips the plan and resets the seed. Server actions enforce the same gate server-side. UI verified manually against the running dev server (server actions/components aren't unit-tested here).

**Files:**
- Create: `apps/cloud/src/app/demo-actions.ts`
- Modify: `apps/cloud/src/app/page.tsx` (add imports + dev-only control block in the header)
- Modify: `apps/cloud/src/app/globals.css` (add `.demo-controls` + `.tag.demo`)

**Interfaces:**
- Consumes: `seedDemo` (Task 2), `applyPlan`, `auth`, `devBypassEnabled`, `getEntitlements`, `type Plan`.
- Produces (from `demo-actions.ts`, both no-ops unless `devBypassEnabled()`):
  - `export async function setPlanAction(plan: Plan): Promise<void>`
  - `export async function seedDemoAction(): Promise<void>`

- [ ] **Step 1: Create the server actions**

Create `apps/cloud/src/app/demo-actions.ts`:

```ts
'use server';

/**
 * Dev-only demo controls (TRE-60). Both actions are HARD no-ops unless
 * `devBypassEnabled()` (i.e. no GitHub creds configured) — they never run on a
 * real GitHub-auth deployment, so they cannot touch the product billing path.
 */
import { revalidatePath } from 'next/cache';
import { auth, devBypassEnabled } from '@/auth';
import { applyPlan } from '@/db';
import { seedDemo } from '@/demo-seed';
import type { Plan } from '@/entitlements';

/** Switch the signed-in org's plan (demo affordance; Stripe is TRE-67). */
export async function setPlanAction(plan: Plan): Promise<void> {
  if (!devBypassEnabled()) return;
  const session = await auth();
  if (!session?.orgId) return;
  applyPlan(session.orgId, plan);
  revalidatePath('/');
}

/** Re-seed / reset the signed-in org to the Acme Inc demo story. */
export async function seedDemoAction(): Promise<void> {
  if (!devBypassEnabled()) return;
  const session = await auth();
  if (!session?.orgId) return;
  seedDemo(session.orgId);
  revalidatePath('/');
}
```

- [ ] **Step 2: Add the dev-only control to the dashboard header**

In `apps/cloud/src/app/page.tsx`, update the imports. Change the `@/auth` import (currently `import { auth, signOut } from '@/auth';`) to:

```ts
import { auth, signOut, devBypassEnabled } from '@/auth';
```

Add, alongside the other imports near the top:

```ts
import { setPlanAction, seedDemoAction } from './demo-actions';
import type { Plan } from '@/entitlements';
```

Then insert this block immediately **before** the `{overRepoLimit && (` nudge (after the closing `</header>`):

```tsx
      {devBypassEnabled() && (
        <div className="demo-controls">
          <span className="tag demo">demo</span>
          <span className="mono dim">plan: {ent.label}</span>
          {(['free', 'team', 'enterprise'] as Plan[]).map((p) => (
            <form key={p} action={setPlanAction.bind(null, p)}>
              <button type="submit" disabled={ent.plan === p}>
                {p}
              </button>
            </form>
          ))}
          <form action={seedDemoAction}>
            <button type="submit">Reset demo data</button>
          </form>
        </div>
      )}
```

- [ ] **Step 3: Add the styles**

Append to `apps/cloud/src/app/globals.css`:

```css
.demo-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin: 0 0 1rem;
  padding: 0.5rem 0.75rem;
  border: 1px dashed #7c3aef88;
  border-radius: 6px;
}
.demo-controls form {
  display: inline;
  margin: 0;
}
.demo-controls button:disabled {
  opacity: 0.5;
  cursor: default;
}
.tag.demo {
  background: #7c3aef22;
  color: #a78bfa;
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @argus/cloud typecheck`
Expected: PASS (no errors). If `ent.plan` is flagged, confirm `getEntitlements` returns `Entitlements` (it has `.plan`) — it does.

- [ ] **Step 5: Manual verification against the dev server**

Run (no GitHub creds in env, so `devBypassEnabled()` is true):

```bash
rm -f apps/cloud/.data/cloud.db   # start clean
pnpm --filter @argus/cloud dev
```

In a browser at `http://localhost:3300`:
1. You're redirected to `/signin`. Click **Dev login** → land on the dashboard (empty).
2. The dashboard header shows the dashed **demo** control (`plan: Free`, buttons free/team/enterprise, Reset demo data).
3. Click **Reset demo data** → the Acme Inc story appears: 6 receipts across `acme/web`, `acme/checkout`, `acme/mobile`; the over-repo nudge shows ("protecting 3 repos; Free covers 1"); export link reads "Export (Team) ↗" (locked); retention note says "Free retains 14 days".
4. Click **team** → nudge clears, "Export CSV / Export JSON" appear, retention note flips to "365 days". Click **enterprise** → retention note says "Unlimited".
5. Click **free** again → back to the wall. Confirm the `real-bug` rows show the `real-bug` tag with `healed = no`; open one (`/receipt/<id>`) and confirm the refusal rationale renders.

Confirm each of the above before checking this step. If anything fails, fix before committing.

- [ ] **Step 6: Commit**

```bash
git add apps/cloud/src/app/demo-actions.ts apps/cloud/src/app/page.tsx apps/cloud/src/app/globals.css
git commit -m "feat(cloud): dev-only demo controls — live plan switch + seed reset (TRE-60)"
```

---

### Task 4: `docs/DEMO.md` runbook

The narrated walkthrough — setup, click path, what to say at each gate, reset, and the optional sample-shop loop appendix.

**Files:**
- Create: `docs/DEMO.md`

**Interfaces:** none (documentation). Content must match the behavior verified in Task 3.

- [ ] **Step 1: Write the runbook**

Create `docs/DEMO.md`:

````markdown
# Vigilis — Sellable demo (governance cloud)

A 5-minute live demo of the **paid** layer: verifiable, governed proof of every
agent decision, across the org. The free OSS agent is the wedge; *this* is what
you charge for.

> Honesty note to keep in the pitch: attestation is **verifiable / auditable** —
> it records *what happened*, not whether the agent's judgment was correct. Never
> claim it "guarantees correctness."

## Setup (one time)

No GitHub creds needed — the cloud runs in local dev mode with a one-click "Dev
login". From the repo root:

```bash
rm -f apps/cloud/.data/cloud.db        # optional: start from a clean slate
pnpm --filter @argus/cloud dev         # serves http://localhost:3300
```

Open <http://localhost:3300>, click **Dev login**, then click **Reset demo data**
in the dashboard's demo control. That seeds the **Acme Inc** org with the story
below and puts it on the **Free** plan (at the upgrade wall).

To reset between runs: click **Reset demo data** again (idempotent).

## The story (what's seeded)

Acme Inc ships AI-written tests. Their agent made these decisions last sprint —
each one has a signed receipt in the cloud:

| Repo | Spec | Verdict | Outcome |
|---|---|---|---|
| acme/web | login.spec | **dom-drift** | healed (selector changed, safe) |
| acme/web | nav.spec | **flake** | quarantined (not healed) |
| acme/checkout | checkout-total.spec | **real-bug** | **refused** — total was wrong |
| acme/checkout | coupon.spec | **dom-drift** | healed |
| acme/mobile | onboarding.spec | **dom-drift** | healed |
| acme/mobile | paywall.spec | **real-bug** | **refused** — access control regressed |

Three repos, all three verdicts, two genuine bugs the agent **refused to hide**.

## Click path + what to say

**1. The audit trail (trust).**
On the dashboard, point at the verdict tags.
> "Every row is a signed receipt. The agent healed the cosmetic drifts — but
> here [open `checkout-total.spec`] it found the order total was wrong and
> **refused to heal**. It failed loudly instead of greening a real bug. That
> refusal is itself attested — you can audit *why* it made the call."

Open the `real-bug` receipt to show the rationale.

**2. The wall (why Free converts).**
> "Acme runs three repos. On Free they get one, 14 days of history, and no
> export." Point at the nudge ("protecting 3 repos; Free covers 1") and the
> locked **Export (Team)** link.

**3. The upgrade (the sellable moment).**
Click **team** in the demo control.
> "The moment Security or an auditor asks for the trail, they upgrade." The
> nudge clears (all 3 repos covered), **Export CSV / JSON** unlock, retention
> jumps to **365 days**. Click an export to show the compliance trail download.

Click **enterprise** to show **unlimited** retention + repos (SSO/RBAC tier).

**4. The anchor (close).**
> "Team is $149/mo — under 2% of one QA engineer's salary — for a gate on every
> PR that refuses to hide a real bug, and signs the proof." (See `docs/PRICING.md`.)

## Reset

Click **Reset demo data** (returns to Acme Inc / Free / the seeded receipts).
The control only appears in local dev (`devBypassEnabled()`); it never ships on a
real GitHub-auth deployment.

## Appendix — close the loop with the real agent (optional, advanced)

Instead of seeded receipts, generate a *live* one from the OSS agent against the
bundled `apps/sample-shop`:

1. In the dashboard, open **API keys** and create a key (copy the plaintext once).
2. Run the agent against sample-shop with the cloud reporter enabled:
   ```bash
   VIGILIS_CLOUD_URL=http://localhost:3300 VIGILIS_CLOUD_KEY=<your key> \
     # …run the agent/heal flow against apps/sample-shop (see AGENTS.md)…
   ```
3. Refresh the dashboard — the real run's receipt appears alongside the seeded
   story. This proves the ingest path end-to-end, not just the UI.
````

- [ ] **Step 2: Verify the runbook matches reality**

Re-read `docs/DEMO.md` against the Task 3 manual check. Every command, label, and
number (repo counts, retention "14 days / 365 days / Unlimited", the locked
"Export (Team) ↗" string, the `$149` from `docs/PRICING.md`) must match what the
app actually renders. Fix any mismatch inline.

- [ ] **Step 3: Commit**

```bash
git add docs/DEMO.md
git commit -m "docs: DEMO.md runbook for the sellable governance-cloud demo (TRE-60)"
```

---

### Task 5: Full end-to-end verification

Confirm the whole spec's acceptance criteria and that nothing regressed.

**Files:** none (verification only).

- [ ] **Step 1: Run the cloud test suite**

Run: `pnpm --filter @argus/cloud test`
Expected: PASS — including the new `db.test.ts` and `demo-seed.test.ts` cases; no prior tests broken.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @argus/cloud typecheck`
Expected: PASS, no errors.

- [ ] **Step 3: Lint/format check (repo root)**

Run: `pnpm format:check && pnpm lint`
Expected: PASS. If `format:check` flags the new files, run `pnpm format` and amend.

- [ ] **Step 4: Walk the full runbook**

Follow `docs/DEMO.md` from a clean DB (`rm -f apps/cloud/.data/cloud.db`) and tick
off each acceptance criterion from the spec:
- Dev login lands in the seeded Acme org (after Reset demo data) — not empty.
- Free: nudge shows, export locked, retention 14d.
- Plan switch flips Free→Team→Enterprise; nudge clears at Team, export unlocks,
  retention note flips 14d → 365d → Unlimited.
- The `real-bug` receipts show `healed = no` and a refusal rationale.

- [ ] **Step 5: Confirm the gate (product path untouched)**

Set fake GitHub creds so `devBypassEnabled()` is false, restart dev, and confirm
the demo control and Dev login both disappear:

```bash
AUTH_GITHUB_ID=x AUTH_GITHUB_SECRET=y pnpm --filter @argus/cloud dev
```

Expected: `/signin` shows only "Sign in with GitHub"; the dashboard renders no
`.demo-controls` block. Stop the server; unset the fake creds.

- [ ] **Step 6: Final commit (if Step 3 amended anything)**

```bash
git add -A
git commit -m "chore(cloud): format + verification for sellable demo (TRE-60)"
```

---

## Self-Review notes

- **Spec coverage:** seed module → Task 2; demo affordances (plan switch + dev login reuse) → Task 3; `docs/DEMO.md` → Task 4; isolation gate → Tasks 3 (`devBypassEnabled` guards) + 5 Step 5; retention-note-is-the-signal nuance → Task 3 Step 5 / Task 4 narration; sample-shop appendix → Task 4. All acceptance criteria → Task 5.
- **No new auth code:** decision 2 reuses the existing Dev-login provider; the plan adds no provider and does not touch `auth.ts`.
- **Type consistency:** `seedDemo(orgId, now?)` and `DemoSeedResult` used identically in Tasks 2 and 3; `setPlanAction(plan: Plan)` / `seedDemoAction()` signatures match between `demo-actions.ts` and `page.tsx`; verdict tokens (`real-bug`/`dom-drift`/`flake`) and plan tokens (`free`/`team`/`enterprise`) match `app/page.tsx` and `entitlements.ts`.

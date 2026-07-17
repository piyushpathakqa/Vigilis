# ZMem × Vigilis Report-Only QA Gate — Implementation Plan (Plan B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a report-only GitHub Actions job to `zerkerlabs/zmem` that boots the Python review dashboard, runs a thin Vigilis-driven Playwright E2E suite against it, attests the run, and uploads the report + attestation bundle — without blocking merges.

**Architecture:** A deterministic Python seed script fills the review queue. CI boots `python -m zerker_memory.dashboard` on `127.0.0.1:8765` against the same seeded DB. A self-contained Playwright project in `qa/` runs 4 specs (network-level assertions so selector drift doesn't flake). A conditional Vigilis `heal` step attests the agent's triage/heal decisions via the local (unsigned, zero-secret) provider. All steps are `continue-on-error` — report-only.

**Tech Stack:** Python 3.11 (ZMem), Node 20 + `@playwright/test`, `npx vigilis@0.5.0` (from Plan A). Target repo: `zerkerlabs/zmem` (cloned separately; this plan edits that repo, not `argus`).

## Global Constraints

- This plan modifies the **ZMem repo** (`github.com/zerkerlabs/zmem`), not `argus`. Clone/checkout ZMem, branch from `main`.
- Every CI step in the new job is **report-only**: `continue-on-error: true`; the job must not fail the PR check.
- Attestation notary is **optional** (local provider, zero secrets). The **model key** `ANTHROPIC_API_KEY` is required for the Vigilis agent to run; the attested step is skipped (not failed) when it's absent.
- Seed and dashboard must use the **same** `--db` path (else the queue is empty).
- Vigilis consumption: `npx vigilis@0.5.0`. If Plan A didn't publish to npm, substitute `npx github:<owner>/argus#<pinned-sha>` (record the SHA from Plan A) everywhere `npx vigilis@0.5.0` appears, and use a scoped name if Plan A published one.
- ZMem's own tests run with `python -m unittest discover -s tests`.
- Commit messages end with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Do not touch ZMem's existing `.github/workflows/test.yml`; add a **new** workflow file.

---

### Task 1: Deterministic review-queue seed script

**Files:**
- Create: `scripts/seed_review_state.py`
- Test: `tests/test_seed_review_state.py`

**Interfaces:**
- Consumes: the `zmem` CLI verbs `propose` (agent source → quarantined → enters review queue), `remember` (human source → active), `queue` (lists items awaiting review). All accept a global `--db <path>` (`zerker_memory/cli.py:139`).
- Produces: `seed(db_path: str) -> dict` returning `{ "queued": int, "active": int }`; a `main(argv=None) -> int` CLI entry (`python scripts/seed_review_state.py --db <path>`).

- [ ] **Step 1: Write the failing test**

```python
# tests/test_seed_review_state.py
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

# Import the seed module from scripts/ (added to sys.path for the test).
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import seed_review_state  # noqa: E402


class SeedReviewStateTest(unittest.TestCase):
    def test_seed_fills_review_queue(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = os.path.join(tmp, "zmem-ci.db")
            result = seed_review_state.seed(db)
            self.assertGreaterEqual(result["queued"], 2)
            self.assertGreaterEqual(result["active"], 1)

            # The dashboard reads the same DB; `queue` must list the quarantined items.
            out = subprocess.run(
                [sys.executable, "-m", "zerker_memory", "--db", db, "queue"],
                capture_output=True,
                text=True,
                check=True,
            )
            # At least the two proposed agent memories are awaiting review.
            self.assertIn("seed", out.stdout.lower())


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest tests.test_seed_review_state -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'seed_review_state'`.

- [ ] **Step 3: Write minimal implementation**

```python
# scripts/seed_review_state.py
"""Seed a deterministic ZMem review-queue state for the Vigilis QA gate.

Creates a few agent-proposed (quarantined → review queue) memories plus a couple
of human-authored (active) memories, all in a caller-provided SQLite DB, so the
review dashboard has real promote/reject targets in CI. Uses only the public
`zmem` CLI so it stays valid as the store internals evolve.
"""
from __future__ import annotations

import argparse
import subprocess
import sys

# Deterministic content — labelled "seed" so tests/humans can spot CI fixtures.
QUEUED = [
    "seed: agent observed the login button moved to the top-right nav",
    "seed: agent believes the checkout API base path changed to /v2",
]
ACTIVE = [
    "seed: release policy requires two reviewers for prod deploys",
]


def _zmem(db_path: str, *args: str) -> None:
    subprocess.run(
        [sys.executable, "-m", "zerker_memory", "--db", db_path, *args],
        check=True,
    )


def seed(db_path: str) -> dict[str, int]:
    for content in QUEUED:
        # agent source stays quarantined → shows up in the review queue.
        _zmem(db_path, "propose", content, "--type", "semantic", "--source", "agent")
    for content in ACTIVE:
        # human source is active by default → populates the proven/active view.
        _zmem(db_path, "remember", content, "--type", "policy", "--source", "human")
    return {"queued": len(QUEUED), "active": len(ACTIVE)}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Seed ZMem review state for the Vigilis QA gate")
    parser.add_argument("--db", required=True, help="SQLite DB path (must match the dashboard --db)")
    args = parser.parse_args(argv)
    counts = seed(args.db)
    print(f"[seed] queued={counts['queued']} active={counts['active']} db={args.db}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pip install -e . && python -m unittest tests.test_seed_review_state -v`
Expected: PASS. (Installs ZMem so `python -m zerker_memory` is importable.)

> If `queue` output doesn't contain the word "seed", inspect `python -m zerker_memory --db <db> queue` output format and adjust the assertion to match the real column (e.g. the id or content column). Do not weaken the queued-count assertion.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed_review_state.py tests/test_seed_review_state.py
git commit -m "test: deterministic review-queue seed for the Vigilis QA gate

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Self-contained Playwright E2E project (`qa/`)

**Files:**
- Create: `qa/package.json`
- Create: `qa/playwright.config.ts`
- Create: `qa/e2e/dashboard-loads.spec.ts`
- Create: `qa/e2e/promote-memory.spec.ts`
- Create: `qa/e2e/reject-memory.spec.ts`
- Create: `qa/e2e/proof-action.spec.ts`
- Create: `vigilis.config.json` (repo root)

**Interfaces:**
- Consumes: the running dashboard at `http://127.0.0.1:8765` — panels rendered from `GET /api/state`; promote/reject POST to `/api/memories/{id}/{action}` (`zerker_memory/dashboard.py:1622`); Export Snapshot POSTs `/api/snapshot` (`dashboard.py:1695`). Queue container is `#queue`; action buttons are `#queue button[data-action="promote"|"reject"]` with `data-id`.
- Produces: 4 committed specs + a Playwright HTML report at `qa/playwright-report/`.

- [ ] **Step 1: Create the Playwright project files**

```json
// qa/package.json
{
  "name": "zmem-qa",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "playwright test"
  },
  "devDependencies": {
    "@playwright/test": "^1.60.0"
  }
}
```

```ts
// qa/playwright.config.ts
import { defineConfig } from '@playwright/test';

// The dashboard is booted by CI (and locally) before these run. Override with
// ZMEM_DASHBOARD_URL if the port changes.
const baseURL = process.env.ZMEM_DASHBOARD_URL ?? 'http://127.0.0.1:8765';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }], ['list']],
  use: { baseURL, trace: 'on-first-retry' },
});
```

- [ ] **Step 2: Create the 4 specs**

```ts
// qa/e2e/dashboard-loads.spec.ts
import { test, expect } from '@playwright/test';

test('review console renders its core panels', async ({ page }) => {
  await page.goto('/');
  // Panels are rendered in the static shell; state fills them from /api/state.
  await expect(page.getByText('Proof Inspector', { exact: false })).toBeVisible();
  await expect(page.getByText('Memory In Use', { exact: false })).toBeVisible();
  await expect(page.getByText('Memory Status', { exact: false })).toBeVisible();
  // Seeded queue should surface at least one promotable memory.
  await expect(page.locator('#queue button[data-action="promote"]').first()).toBeVisible();
});
```

```ts
// qa/e2e/promote-memory.spec.ts
import { test, expect } from '@playwright/test';

test('promoting a queued memory removes it from the review queue', async ({ page }) => {
  await page.goto('/');
  const promote = page.locator('#queue button[data-action="promote"]').first();
  await expect(promote).toBeVisible();
  const id = await promote.getAttribute('data-id');
  expect(id).toBeTruthy();

  // Assert at the network level (drift-proof): the promote POST must succeed.
  const [resp] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes(`/api/memories/${id}/promote`) && r.request().method() === 'POST',
    ),
    promote.click(),
  ]);
  expect(resp.ok()).toBeTruthy();

  // After the reload, that specific memory is no longer promotable in the queue.
  await expect(page.locator(`#queue button[data-action="promote"][data-id="${id}"]`)).toHaveCount(0);
});
```

```ts
// qa/e2e/reject-memory.spec.ts
import { test, expect } from '@playwright/test';

test('rejecting a queued memory removes it from the review queue', async ({ page }) => {
  await page.goto('/');
  const reject = page.locator('#queue button[data-action="reject"]').first();
  await expect(reject).toBeVisible();
  const id = await reject.getAttribute('data-id');
  expect(id).toBeTruthy();

  const [resp] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes(`/api/memories/${id}/reject`) && r.request().method() === 'POST',
    ),
    reject.click(),
  ]);
  expect(resp.ok()).toBeTruthy();

  await expect(page.locator(`#queue button[data-action="reject"][data-id="${id}"]`)).toHaveCount(0);
});
```

```ts
// qa/e2e/proof-action.spec.ts
import { test, expect } from '@playwright/test';

// Stands in for the receipt/proof path: Export Snapshot is deterministic (needs
// no prior injected actions) and exercises the same proof pipeline receipts use.
test('exporting a snapshot produces a proof artifact', async ({ page }) => {
  await page.goto('/');
  const snapshotBtn = page.locator('#snapshotBtn');
  await expect(snapshotBtn).toBeVisible();

  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/snapshot') && r.request().method() === 'POST'),
    snapshotBtn.click(),
  ]);
  expect(resp.ok()).toBeTruthy();
});
```

```json
// vigilis.config.json  (repo root — consumed by `vigilis heal`)
{
  "baseUrl": "http://127.0.0.1:8765",
  "testDir": "qa/e2e",
  "memory": "off"
}
```

- [ ] **Step 3: Verify the specs green against a locally-booted dashboard**

```bash
python -m pip install -e .
export ZMEM_DB="$(mktemp -d)/zmem-ci.db"
python scripts/seed_review_state.py --db "$ZMEM_DB"
python -m zerker_memory.dashboard --db "$ZMEM_DB" --host 127.0.0.1 --port 8765 &
DASH_PID=$!
# wait for the port
for i in $(seq 1 30); do curl -sf http://127.0.0.1:8765/ >/dev/null && break || sleep 1; done
cd qa && npm install && npx playwright install --with-deps chromium && npx playwright test; cd ..
kill $DASH_PID
```

Expected: 4 passed. If a selector assertion fails (not the network assertion), that's real drift — note it; a `data-testid` pass on `dashboard.py` is Task 4's contingency.

- [ ] **Step 4: Commit**

```bash
git add qa/ vigilis.config.json
git commit -m "test(qa): thin Playwright E2E suite for the review dashboard

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Report-only GitHub Actions job

**Files:**
- Create: `.github/workflows/vigilis-qa.yml`

**Interfaces:**
- Consumes: `scripts/seed_review_state.py` (Task 1), `qa/` project (Task 2), `npx vigilis@0.5.0` (Plan A). Optional secrets `ANTHROPIC_API_KEY` (agent) and `TREESHIP_*` (signed receipts).
- Produces: uploaded artifacts `zmem-playwright-report` and `zmem-vigilis-attestation`.

- [ ] **Step 1: Write the workflow**

```yaml
# .github/workflows/vigilis-qa.yml
name: vigilis-qa

# Report-only: this workflow never blocks a PR. It runs the Vigilis-driven E2E
# gate against the ZMem review dashboard and uploads the Playwright report plus
# the attestation bundle for humans to inspect.
on:
  pull_request:
  workflow_dispatch:

jobs:
  vigilis-qa:
    runs-on: ubuntu-latest
    continue-on-error: true # <-- report-only; do not fail the PR
    env:
      ZMEM_DB: ${{ runner.temp }}/zmem-ci.db
      ZMEM_DASHBOARD_URL: http://127.0.0.1:8765
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: python -m pip install -e .

      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Seed deterministic review state
        run: python scripts/seed_review_state.py --db "$ZMEM_DB"

      - name: Boot the review dashboard
        run: |
          python -m zerker_memory.dashboard --db "$ZMEM_DB" --host 127.0.0.1 --port 8765 &
          for i in $(seq 1 30); do
            curl -sf "$ZMEM_DASHBOARD_URL/" >/dev/null && break || sleep 1
          done
          curl -sf "$ZMEM_DASHBOARD_URL/" >/dev/null

      - name: Install Playwright + browser
        working-directory: qa
        run: |
          npm install
          npx playwright install --with-deps chromium

      - name: Run E2E specs (report-only)
        working-directory: qa
        continue-on-error: true
        run: npx playwright test

      - name: Vigilis triage + heal + attest (needs ANTHROPIC_API_KEY)
        if: ${{ env.HAS_ANTHROPIC == 'true' }}
        continue-on-error: true
        env:
          HAS_ANTHROPIC: ${{ secrets.ANTHROPIC_API_KEY != '' }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          npx vigilis@0.5.0 heal "$ZMEM_DASHBOARD_URL" \
            --spec qa/e2e/promote-memory.spec.ts \
            --error "CI QA gate: triage the dashboard promote flow" \
            --no-pr --no-publish

      - name: Upload Playwright report
        if: ${{ always() }}
        uses: actions/upload-artifact@v4
        with:
          name: zmem-playwright-report
          path: qa/playwright-report/
          if-no-files-found: ignore

      - name: Upload attestation bundle
        if: ${{ always() }}
        uses: actions/upload-artifact@v4
        with:
          name: zmem-vigilis-attestation
          path: .vigilis/attestation/
          if-no-files-found: ignore
```

> Implementer note on the `HAS_ANTHROPIC` guard: GitHub does not allow `secrets.*` directly in a step-level `if`. The pattern above reads the secret into an env var **inside the step**, but the `if` needs the value at expression time. Implement the guard by setting `HAS_ANTHROPIC` in an earlier step's `$GITHUB_ENV` (e.g. a small step: `echo "HAS_ANTHROPIC=${{ secrets.ANTHROPIC_API_KEY != '' }}" >> "$GITHUB_ENV"`), then `if: env.HAS_ANTHROPIC == 'true'`. Add that step before the Vigilis step.

- [ ] **Step 2: Fix the secret guard (apply the note above)**

Insert, immediately after `- uses: actions/checkout@v4`:

```yaml
      - name: Detect optional secrets
        run: echo "HAS_ANTHROPIC=${{ secrets.ANTHROPIC_API_KEY != '' }}" >> "$GITHUB_ENV"
```

and change the Vigilis step's `if:` to `if: ${{ env.HAS_ANTHROPIC == 'true' }}` and remove the now-redundant `HAS_ANTHROPIC` line from that step's `env:` (keep `ANTHROPIC_API_KEY`).

- [ ] **Step 3: Validate the workflow YAML**

Run: `python -c "import yaml,sys; yaml.safe_load(open('.github/workflows/vigilis-qa.yml')); print('yaml ok')"`
Expected: `yaml ok`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/vigilis-qa.yml
git commit -m "ci: report-only Vigilis QA gate on the review dashboard

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Docs, selector-stability contingency, and verify on a real PR

**Files:**
- Create: `docs/VIGILIS_QA.md`
- Modify (only if Task 2 Step 3 showed selector flake): `zerker_memory/dashboard.py` (add minimal `data-testid`s)

**Interfaces:** none (docs + verification).

- [ ] **Step 1: Write the doc**

```markdown
<!-- docs/VIGILIS_QA.md -->
# Vigilis QA gate (report-only)

Vigilis runs a thin end-to-end suite against the local review dashboard on every
PR and **attests** the agent's triage/heal decisions. It is **report-only**: it
uploads a Playwright report and an attestation bundle but does not block merges.

## What it checks
- The review console renders (Proof Inspector, Memory In Use, Memory Status).
- Promoting a queued memory removes it from the review queue.
- Rejecting a queued memory removes it from the review queue.
- Exporting a snapshot produces a proof artifact.

## Run it locally
```bash
python -m pip install -e .
export ZMEM_DB="$(mktemp -d)/zmem-ci.db"
python scripts/seed_review_state.py --db "$ZMEM_DB"
python -m zerker_memory.dashboard --db "$ZMEM_DB" --port 8765 &
cd qa && npm install && npx playwright install chromium && npx playwright test
```

## Attestation
- **Zero secrets:** the local provider writes a hash-chained, **unsigned** bundle
  to `.vigilis/attestation/` ("N artifacts, chain intact"). It is verifiable and
  auditable — it proves *what the agent did*, not that its judgment was correct.
- **Signed receipts:** set `ANTHROPIC_API_KEY` (required for the agent) and the
  optional `TREESHIP_*` secrets to seal an independently-notarized receipt.

## Make it blocking (later)
Remove `continue-on-error: true` from `.github/workflows/vigilis-qa.yml` once the
team trusts the signal.
```

- [ ] **Step 2: Selector-stability contingency (only if Task 2 Step 3 flaked on DOM selectors)**

If — and only if — the queue/panel selectors proved flaky, add minimal stable hooks to `zerker_memory/dashboard.py` where the queue buttons are rendered (`dashboard.py:540-542`), e.g. `data-testid="queue-promote"` alongside the existing `data-action="promote"`, and update the specs to prefer the testid. Keep it to the few elements the specs touch. If Step 3 was green, skip this step.

- [ ] **Step 3: Commit docs (and any testid changes)**

```bash
git add docs/VIGILIS_QA.md zerker_memory/dashboard.py 2>/dev/null
git commit -m "docs: report-only Vigilis QA gate usage + attestation notes

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 4: Push the branch and open the PR**

```bash
git push -u origin <branch>
gh pr create --repo zerkerlabs/zmem --fill --title "Report-only Vigilis QA gate on the review dashboard"
```

- [ ] **Step 5: Verify the report-only run on the PR**

Watch the PR's `vigilis-qa` check:
- The job completes (green or neutral) and **does not block** the PR.
- Artifacts `zmem-playwright-report` and `zmem-vigilis-attestation` are present. (Attestation appears only if `ANTHROPIC_API_KEY` is configured; otherwise the E2E report alone confirms the loop.)

Run: `gh pr checks <pr-number> --repo zerkerlabs/zmem`
Expected: `vigilis-qa` present, not failing the PR.

---

## Self-Review

- **Spec coverage:** §5.1 four specs → Task 2; §5.2 data flow (install→seed→boot→run→attest→upload) → Task 3 workflow; §5.3 files (workflow, seed, config, specs, doc) → Tasks 1–4; §5.4 selector-stability testid contingency → Task 4 Step 2; §5.5 verify (local + throwaway PR) → Task 2 Step 3, Task 4 Step 5. All covered.
- **Placeholder scan:** `<owner>`, `<branch>`, `<pr-number>`, `<pinned-sha>` are intentional per-run values, called out in Global Constraints; all code/commands are complete. No TBD/TODO.
- **Type/name consistency:** `ZMEM_DB` and `ZMEM_DASHBOARD_URL` used identically across Tasks 1–3; `seed(db_path)` returns `{queued, active}` (Task 1 impl + test); action routes `/api/memories/{id}/promote|reject` and `/api/snapshot` match the specs (Task 2) and the dashboard source. `vigilis heal ... --spec qa/e2e/promote-memory.spec.ts` references a file created in Task 2.
- **Cross-plan dependency:** `npx vigilis@0.5.0` depends on Plan A publishing; fallback documented in Global Constraints.

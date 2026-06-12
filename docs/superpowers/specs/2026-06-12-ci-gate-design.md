# CI/CD Gate + Artifacts — Design Spec (M2 · TRE-35/36/37)

> Status: approved 2026-06-12 (completion sweep). Implements milestone **M2 (`TRE-24`)**.
> Makes "failing tests block deployment" literally visible as a red/green check.

## 1. Goal

A GitHub Actions **QA gate** that runs Argus's generated Playwright specs against `sample-shop`
on every push/PR, and uploads traces/screenshots on failure — the fuel M3 Triage consumes.

## 2. Scope by ticket

- **TRE-35 (CLI commands):** already satisfied — the `commander` surface
  (`generate`/`smoke`/`author`/`triage`/`heal`) exists; `generate`/`smoke` are real, `triage`/`heal`
  are placeholders by design (M3). No new work; marked done.
- **TRE-36 (the gate):** a new `.github/workflows/qa.yml` that builds/serves sample-shop and runs
  `playwright test` as a required-able check.
- **TRE-37 (artifacts):** `playwright.config.ts` captures trace/screenshot/video on failure; the
  workflow uploads `playwright-report/` + `test-results/`.

## 3. Decisions (resolved)

| Decision | Choice | Why |
|----------|--------|-----|
| What the gate runs | **Committed specs** (`tests/generated/*.spec.ts`) | Generated tests are the regression suite; CI must be deterministic + free (no API key/spend per run). The agent is a dev-time tool, not a CI step. |
| Serve sample-shop | **`playwright.config` `webServer`** (`pnpm --filter @argus/sample-shop dev`, `reuseExistingServer`) | Already wired; CI auto-starts it, local reuses a running one. |
| Workflow split | **New `qa.yml`** (separate from `ci.yml`) | DESIGN §5: `ci.yml` = lint/typecheck/test/build; `qa.yml` = the Playwright gate. |
| Required check | **Not enforced via code** | Branch protection is a repo setting that would block direct-to-main pushes (the established flow). Created as a normal check; documented how to mark it required. |
| Reporter coupling | Config reporter = `list` + `html`; `PlaywrightTestRunner` still passes `--reporter=json` on the CLI | The runner (used by `argus generate --run` / `playwright_run`) overrides config, so json is unaffected. |

## 4. Changes

### `playwright.config.ts`
Add: `forbidOnly: !!process.env.CI`, `retries: process.env.CI ? 1 : 0`,
`reporter: [['list'], ['html', { open: 'never' }]]`, and
`use: { …, trace: 'on-first-retry', screenshot: 'only-on-failure', video: 'retain-on-failure' }`.
Outputs land in `playwright-report/` and `test-results/` (both already gitignored).

### `.github/workflows/qa.yml`
`on: [push, pull_request]` to `main`. One job (ubuntu-latest), matching `ci.yml` conventions
(pnpm 9.15.0, node 22, `pnpm install --frozen-lockfile`):
1. `pnpm exec playwright install --with-deps chromium`
2. `pnpm exec playwright test` (config's `webServer` starts sample-shop; the gate fails red if any
   spec fails)
3. `actions/upload-artifact@v4` (`if: ${{ !cancelled() }}`) → `playwright-report/` + `test-results/`,
   14-day retention.

## 5. Verification

- **Local (done):** `npx playwright test` → `2 passed` against sample-shop via `webServer`.
- **CI:** push, watch `qa.yml` go green, confirm the artifact bundle uploads. Demo of red→green:
  break a sample-shop `data-testid` → the gate goes red (and uploads the failing trace).

## 6. Non-goals (later)

- Branch-protection enforcement (one-click repo setting).
- On-failure **Triage** job + conditional **Heal-PR** job — **M3 (TRE-41)**.
- Production build/start of sample-shop (dev server is sufficient for the gate now).

## 7. Done when

- `qa.yml` runs `playwright test` as a check on push/PR and is **green** on the current commit.
- Trace/screenshot/video are captured on failure and uploaded as artifacts.
- TRE-35/36/37 marked done; M2 epic (`TRE-24`) done.

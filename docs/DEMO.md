# Vigilis — self-healing demo (TRE-40)

Two seeded scenarios prove the core guardrail: **Vigilis heals DOM drift, but refuses real bugs.**
Both are off by default (env toggles in `sample-shop`), so normal runs and CI are unaffected.

Prerequisites: `pnpm build`, `npx playwright install chromium`, and `.env` with a real
`ANTHROPIC_API_KEY`. A heal run costs ~$0.10 on Haiku (`--model claude-haiku-4-5`) or ~$0.50 on
Opus, and **opens a real PR** on the repo.

## 1. DOM drift → auto-heal → PR

Seed the drift (renames the login submit button's `data-testid` from `login-submit` to
`submit-btn` — the element still exists, just under a new id):

```bash
# terminal 1 — sample-shop with the drift toggled on
NEXT_PUBLIC_ARGUS_DEMO_DRIFT=1 pnpm --filter @argus/sample-shop dev

# terminal 2 — confirm the committed spec now FAILS (login-submit is gone)
npx playwright test                      # ✗ red: locator getByTestId('login-submit') not found

# heal it: triage → dom-drift → rewrite to submit-btn → verify green → open a PR
node --env-file=.env packages/cli/dist/index.js heal \
  http://localhost:3100/login --spec tests/generated/login.spec.ts \
  --model claude-haiku-4-5
```
Expected: a `dom-drift` verdict, the spec rewritten to `submit-btn`, an independent green re-run,
and `[vigilis] opened PR: https://github.com/.../pull/N`. Use `--no-pr` to keep the fix local.

## 2. Real bug → refuse to heal (gate stays blocked)

Seed a genuine break (login rejects even valid credentials):

```bash
# terminal 1
NEXT_PUBLIC_ARGUS_DEMO_BUG=1 pnpm --filter @argus/sample-shop dev

# terminal 2
node --env-file=.env packages/cli/dist/index.js heal \
  http://localhost:3100/login --spec tests/generated/login.spec.ts \
  --model claude-haiku-4-5
```
Expected: a `real-bug` verdict, **no PR**, and a non-zero exit — Vigilis blocks the gate instead of
hiding the failure. This is the line that makes Vigilis trustworthy: it improves signal, it doesn't
paper over bugs.

## In CI

`.github/workflows/self-heal.yml` runs the same `argus heal` on a manual **workflow_dispatch**
(inputs: `url`, `spec`). It's secret-gated (`ANTHROPIC_API_KEY`) and does **not** fire on its own.
The file documents how to flip it to fully automatic (`workflow_run` on a failed **QA Gate**) once
you're comfortable with autonomous CI PRs.

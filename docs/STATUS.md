# Argus — Status & Handoff

> **Read this to resume work with zero context loss.** Last updated: 2026-06-13.

## ▶ To continue right now (start here)

1. Read `AGENTS.md`, then this file, then `docs/DESIGN.md`. The design is locked — don't
   re-litigate it; just build the next ticket.
2. **M0–M3 complete; M4 all but the GIFs.** Shipped: `TRE-42` (`argus-mcp` server),
   `TRE-43` (`docs/MCP.md`), `TRE-44` (README), `TRE-46` (Treeship — merged; `argus heal` seals a
   signed provenance receipt by default). **Only remaining ticket: `TRE-45`** — record demo GIFs
   (generate, CI red→green, self-heal PR), which **needs a human**.
3. Done: M0, M1 (~~TRE-30–34~~), M2 (~~TRE-35/36/37~~), M3 (~~TRE-38–41~~),
   M4 (~~TRE-42/43/44~~ + ~~TRE-46~~; TRE-45 = GIFs). Live demos (open real PRs / cost API) are
   user-run — see `docs/DEMO.md`, `docs/MCP.md`, `docs/TREESHIP.md`.
   **Landing page shipped + deployed live:** <https://argus-web-psi.vercel.app> (`apps/web`) —
   see the "Landing page (`apps/web`)" section below.
4. **Before claiming any task done, run and pass:**
   ```bash
   pnpm lint && pnpm typecheck && pnpm test && pnpm build
   ```
5. Commit per ticket with a message like `M2: <what> (TRE-36)`. If `pnpm` is missing:
   `corepack enable && corepack prepare pnpm@9.15.0 --activate`.

---

## TL;DR

- **M0 (Foundations) is complete and verified.** The monorepo builds, typechecks, lints, and
  tests green. The `argus` CLI runs with placeholder commands.
- **M0–M3 complete; M4 all but the demo GIFs.** Full loop: Generate → QA Gate (CI red/green) →
  Triage → Heal (PR on drift, refuse real bugs). **M4:** `argus-mcp` MCP server (`docs/MCP.md`);
  README polished; **Treeship merged** — `argus heal` seals a signed provenance receipt by default
  (optional `@treeship/sdk`, zero hard dep; `docs/TREESHIP.md`). Suites: **core 57 + mcp 2** passing.
- **Remaining:** `TRE-45` demo GIFs (human-recorded). The product is functionally whole.
- **Pushed to GitHub** (2026-06-12): `main` tracks `origin/main`, CI runs on push. No blocking chores.

## What exists right now

### Verified green (run from repo root)
```bash
pnpm install     # ✓ 292 packages
pnpm lint        # ✓ eslint clean
pnpm typecheck   # ✓ tsc --noEmit, all 4 packages
pnpm test        # ✓ vitest — core 55/55 pass (incl. 4 real-chromium); mcp/cli pass-with-no-tests
pnpm build       # ✓ tsup (core/mcp/cli) + next build (sample-shop: 5 routes + middleware)
node packages/cli/dist/index.js --help     # ✓ prints command surface (now incl. `smoke`)
pnpm --filter @argus/sample-shop dev        # ✓ serves login → products → cart on :3100
```

> The 4 chromium tests self-skip if the browser isn't installed (`pnpm test` stays green); run
> `pnpm --filter @argus/core exec playwright install chromium` once to exercise them.

### Package inventory
| Package | State | Notes |
|---------|-------|-------|
| `@argus/core` | **M1 complete (`TRE-31`–`TRE-34`)** | Tool Registry (10 Zod tools) + hand-rolled `runAgentLoop` + `AgentObserver`/`ConsoleObserver` + real `PlaywrightBrowserSession`/`PlaywrightTestRunner` + `trimHtml` cleaned snapshots + the **`generate()` behavior** (tuned prompt, deterministic path, `fs_write` capture). `@anthropic-ai/sdk@^0.104.1` + `playwright@^1.60.0`. Triage/Heal land in M3. |
| `@argus/mcp` | **built (`TRE-42`)** | Real stdio MCP server (`argus-mcp` bin): `createArgusMcpServer` exposes all 10 registry tools over MCP, routing each call to `registry.execute` against a lazily-launched Playwright context. In-memory client/server test. Config: `docs/MCP.md`. |
| `@argus/cli` | **generate/triage/heal + smoke live** | `argus generate <url> [--run]` writes+runs a spec; `argus triage <url> --spec …` classifies a failure; `argus heal <url> --spec …` self-heals DOM drift → PR; `argus smoke <url>` watches the loop. Only `author` remains a placeholder. |
| `@argus/sample-shop` | **built (`TRE-30`)** | Next.js App Router app: `/login` (server-action gate, demo/demo) → `/products` (static Server Component catalog) → `/cart` (client context, live badge). `src/middleware.ts` enforces the gate. In-memory state, no DB. Stable `data-testid`s documented in its README — the contract M3 drifts for the self-heal demo. Runs on port 3100. |

### Tooling in place
- pnpm workspaces (`pnpm-workspace.yaml`), Node ≥20, pnpm 9.15.0 (via Corepack).
- `tsconfig.base.json` (strict, ESM, bundler resolution) extended per package.
- ESLint flat config (`eslint.config.js`), Prettier (`.prettierrc.json`).
- `tsup` builds, Vitest tests.
- GitHub Actions CI: `.github/workflows/ci.yml` (install → lint → typecheck → test → build).
- `LICENSE` (MIT), `README.md`, `.env.example`, `.gitignore`.

### Git
- Local repo initialized, branch `main`, one commit:
  `M0: scaffold pnpm/TypeScript monorepo (TRE-27, TRE-28, TRE-29)`.
- Remote `origin` → `https://github.com/piyushpathakqa/argus.git` — **pushed** (2026-06-12), `main`
  tracks `origin/main`. GitHub Actions CI runs on push.

## Open chores

_None blocking._ (The earlier GitHub-push chore is resolved: the `gh` token was refreshed with the
`workflow` scope and `main` is pushed. Pushing now works over HTTPS via the `gh` credential helper.)

## Environment setup (for a fresh machine / Cursor)
```bash
corepack enable && corepack prepare pnpm@9.15.0 --activate   # if pnpm missing
cd argus
pnpm install
cp .env.example .env        # add ANTHROPIC_API_KEY
```

## Done: `TRE-30` (sample-shop Next.js app)

Built in `apps/sample-shop` (Next.js 15 App Router, React 19, port 3100):
- `/login` — `'use client'` form backed by a Server Action; demo creds `demo`/`demo`; wrong
  creds show `login-error`. Sets an httpOnly session cookie.
- `/products` — Server Component rendering the static catalog (`tee`, `mug`, `cap`, `stickers`)
  from `src/lib/products.ts`. Each card has an `add-to-cart-<id>` button.
- `/cart` — `'use client'` page over a React-context cart; line items, qty, total, remove/clear,
  empty state. Header badge `cart-count` updates live.
- `src/middleware.ts` — login gate: unauth → `/login`, authed-on-`/login` → `/products`.
- Stable `data-testid`s on every key element (table in the app README) — the contract Argus's
  generated tests rely on and M3 (`TRE-40`) drifts for the self-heal demo.

Verified: `pnpm lint && pnpm typecheck && pnpm build` green; dev server serves the full
login → browse → cart flow (gate redirects and authed routes confirmed via curl).

Why Next 15 (not 16): the app is a deterministic test *fixture*, so stability beats bleeding
edge. Pinned `next@^15.1.6`; `middleware.ts` is correct for this version (16 renames it to
`proxy.ts`).

## Done: `TRE-31` (Tool Registry)

Built in `packages/core/src/tools/` (spec: `docs/superpowers/specs/2026-06-12-tool-registry-design.md`;
plan: `docs/superpowers/plans/2026-06-12-tool-registry.md`):
- **`ToolRegistry`** — `register`/`get`/`list` + `execute(name, input, ctx)`, which validates
  input against the tool's Zod schema and **never throws** (bad input, unknown tool, and handler
  errors all come back as `{ isError: true }` so the agent can self-correct).
- **10 tools**, real handlers over an injected `ToolContext`: `fs_read/write/list` (sandboxed to
  `workspaceRoot`, path-traversal rejected), `browser_navigate/click/type/snapshot`,
  `dom_query/dom_testids`, `playwright_run`.
- **Seams for TRE-32:** `BrowserSession` and `TestRunner` are interfaces (faked in tests via
  `src/tools/testing/fakes.ts`); TRE-32 injects the real Playwright-backed implementations.
- **Adapters:** `toAnthropic()` (JSON Schema via native `z.toJSONSchema`, `$schema` stripped) and
  `toMcp()` (Zod raw shape) — `createDefaultRegistry()` is exported from `@argus/core`.

Decision: **zod 4** (not 3) — MCP SDK 1.x accepts `^3.25 || ^4.0` and v4 has native
`z.toJSONSchema`, so no `zod-to-json-schema` dependency. Deferred to TRE-32: real Playwright
session/runner. Deferred (not in TRE-31 scope): git tools (serve Heal/TRE-39).

Verified: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green (core 22/22); built
`dist` exports `createDefaultRegistry` and both adapters return all 10 tools.

## Done: `TRE-32` (agent loop + real ToolContext)

Built in `packages/core/src/{agent,runtime}/` (spec/plan: `docs/superpowers/{specs,plans}/2026-06-12-agent-loop*.md`):
- **`runAgentLoop`** — hand-rolled Messages-API tool-use loop over the registry. Echoes full
  `response.content` back each turn, runs `tool_use` blocks through `registry.execute`, feeds
  `tool_result`s back, stops on `end_turn`/`refusal`/`max_tokens` or a `maxSteps` guard. Depends
  on an injected `AnthropicLike` client → unit-tested with a scripted fake (no key, no network).
- **`AgentObserver` + `ConsoleObserver`** — the observability seam reused by TRE-37 + TRE-46.
- **Real `ToolContext`:** `PlaywrightBrowserSession` (chromium) + `PlaywrightTestRunner` (spawns
  `playwright test --reporter=json`, pure `parsePlaywrightJson`). The TRE-31 interfaces, now real.
- **`argus smoke <url>`** — wires the real client/session/runner + `ConsoleObserver` into one
  watchable run; prints a step trace + a token/cost line. Defaults to the **fast model** (Haiku).

Decisions: adaptive thinking + `effort` are **Opus-tier only** (they 400 on Haiku), so the loop
gates them off when the caller asks (`smoke` passes `thinking:false`). `@anthropic-ai/sdk`
upgraded `0.32.1 → 0.104.1`; `playwright` added. Deferred: real Generate prompt/context
engineering (TRE-34), git tools (TRE-39), CI browser install (TRE-36).

Verified: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green (core **36/36**, incl. 4
real-chromium); built `dist` exports the loop + runtime.

### ▶ Try the E2E smoke run (needs API credit + chromium)
```bash
cp .env.example .env                                    # add a real ANTHROPIC_API_KEY
pnpm --filter @argus/core exec playwright install chromium   # one-time
pnpm build                                              # build core + cli
pnpm --filter @argus/sample-shop dev                    # terminal 1 → :3100
node --env-file=.env packages/cli/dist/index.js smoke http://localhost:3100/login   # terminal 2
```
Watch the agent navigate → snapshot → list testids → click through login → cart, then print a
cost line (~$0.05–0.15 on Haiku). A Max subscription does **not** fund the API — it needs a
Console API key with its own billing.

## Done: `TRE-33` (Generate behavior)

Built in `packages/core/src/behaviors/` (spec/plan: `docs/superpowers/{specs,plans}/2026-06-12-generate-behavior*.md`):
- **`generate()`** — drives `runAgentLoop` with a v1 spec-writing system prompt: explore via
  browser/dom tools, discover login creds, write **one** runnable Playwright spec via `fs_write` to
  a **deterministic path** (`specPathForUrl` → `tests/generated/<slug>.spec.ts`). A composed
  observer captures the written file paths. Default model **Opus** (thinking on); `--model` to
  switch to Haiku for cheap runs.
- **`playwright.config.ts`** (repo root) — `testDir tests`, `baseURL :3100`, `webServer` with
  `reuseExistingServer` so generated specs run with or without sample-shop already up.
- **`argus generate <url> [--run] [--out] [--max-steps]`** — writes the spec, prints cost, and with
  `--run` executes it via `PlaywrightTestRunner` and reports pass/fail (non-zero exit on failure).

Verified: `pnpm lint && typecheck && test && build` green (core **43/43**); `specPathForUrl` +
the behavior (fake client writing to a real temp dir) are unit-tested. Real LLM generation is
exercised manually via `argus generate` (the v1 prompt is tuned in `TRE-34`).

### ▶ Generate + run a test (the M1 payoff)
```bash
node --env-file=.env packages/cli/dist/index.js generate http://localhost:3100/login --run
```
Writes `tests/generated/login.spec.ts` and runs it green against sample-shop (~$0.50 on Opus, or
add `--model claude-haiku-4-5` for ~10¢). Needs an API key + chromium.

## Done: `TRE-34` (Generate prompt & context engineering) — closes M1

Spec: `docs/superpowers/specs/2026-06-12-generate-context-design.md`.
- **`trimHtml`** (`packages/core/src/runtime/html.ts`, exported, unit-tested) — strips
  scripts/styles/links/comments and collapses whitespace; `browser_snapshot` now returns this
  cleaned HTML (token-efficient, keeps the title + `data-testid`s). Verified via the chromium
  session test (script content stripped).
- **`GENERATE_SYSTEM`** tightened: web-first auto-waiting assertions only (no `waitForTimeout`),
  prove login by asserting a post-login element (not a URL regex), one focused deterministic test.

Also shipped in the same sweep (a TRE-44 slice): **`argus generate --base-url <url>`** + an
env-driven `playwright.config.ts` baseURL, so `--run` works against **any** app (auto-starts
sample-shop only when targeting `:3100`). And the AI-generated `tests/generated/login.spec.ts` is
committed as a demo artifact (excluded from lint; not run by CI).

## Bonus: a real generated test (committed)

`tests/generated/login.spec.ts` was written by `argus generate … --model claude-haiku-4-5` (4
steps, ~$0.03) and passes against sample-shop (`2 passed, 0 failed`). It logs in with discovered
`demo`/`demo` creds and asserts via `getByTestId` — a tangible "AI wrote my test" artifact.

## Done: M2 — CI/CD gate (`TRE-35/36/37`)

Spec: `docs/superpowers/specs/2026-06-12-ci-gate-design.md`.
- **`.github/workflows/qa.yml`** — the **QA Gate** check: installs chromium, serves sample-shop
  (via the playwright `webServer`), and runs the committed agent-generated specs on every push/PR.
  **Green** on GitHub. A failing spec turns the check red — that's the visible "tests block
  deployment" gate.
- **`playwright.config.ts`** captures `trace`/`screenshot`/`video` on failure and the workflow
  uploads `playwright-report/` + `test-results/` (14-day retention) — the artifacts M3 Triage reads.
- TRE-35 satisfied: the `commander` CLI surface is live (`generate`/`smoke` real; `triage`/`heal`
  are M3 placeholders).

Notes: the gate runs **committed** specs (deterministic, no API key/spend in CI — the agent is a
dev-time tool). To make it a **required** check, enable branch protection for `main` in the repo
settings (intentionally not enforced via code, since that would block direct-to-`main` pushes).
A GitHub annotation flags Node-20 actions as deprecating — it self-resolves when GitHub forces
Node 24 on 2026-06-16.

## Done: `TRE-38` (Triage behavior) — M3 part 1

Spec: `docs/superpowers/specs/2026-06-12-triage-behavior-design.md`.
- **`triage()`** (`behaviors/triage.ts`) — given a failing spec + the app URL (+ error), reads the
  spec, inspects the **live DOM**, and classifies `real-bug` / `dom-drift` / `flake`. Returns a
  structured `Verdict` (verdict, confidence, rationale, `suggestedSelector` for drift).
- **`report_verdict` tool** (`tools/definitions/report.ts`) — the structured-output channel; the
  behavior captures its call input (registered only for Triage, not in the default registry).
- **`extractFailures(report)`** (`runtime/playwright-runner.ts`, pure) — pulls failing specs (file
  + title + error) from a Playwright JSON report, so the CLI can triage straight from a CI run.
- **`argus triage <url> --spec … [--error …] [--report …]`** — prints the verdict + rationale +
  suggested selector; exits non-zero on `real-bug` (gate stays blocked), zero on drift/flake.

## Done: `TRE-39` (Heal behavior) — M3 part 2

Spec: `docs/superpowers/specs/2026-06-12-heal-behavior-design.md`.
- **`heal()`** (`behaviors/heal.ts`) — agent rewrites the stale locator to the verdict's
  `suggestedSelector` (`fs_write`), then the behavior **independently re-runs the spec**
  (`ctx.runner.run`) — `verified = changed && failed === 0`. The agent's claim is never trusted.
- **`createHealPr()`** (`runtime/git.ts`) — deterministic `git checkout -b → add → commit → push →
  gh pr create` (injectable exec, unit-tested). The outward action lives in the harness, not an
  agent tool.
- **`argus heal <url> --spec … [--no-pr]`** — triages first; **`real-bug` → refused (exit 1)**,
  `flake` → no-op, only `dom-drift` heals → verify → open a real PR (or `--no-pr` for a local
  branch). Full-auto PR opening was user-approved.

## Done: `TRE-40` + `TRE-41` (self-heal demo + CI) — closes M3

Spec: `docs/superpowers/specs/2026-06-12-heal-demo-design.md`. Runbook: `docs/DEMO.md`.
- **Seeded scenarios** (`apps/sample-shop/src/lib/demo.ts`, both default OFF):
  `NEXT_PUBLIC_ARGUS_DEMO_DRIFT=1` renames the login submit testid `login-submit` → `submit-btn`
  (the committed spec then fails → drift → heal); `NEXT_PUBLIC_ARGUS_DEMO_BUG=1` makes login
  reject valid creds (→ real-bug → heal refuses). Verified: default suite green + committed spec
  still passes; with the flag, `/login` renders `data-testid="submit-btn"`.
- **`.github/workflows/self-heal.yml`** — `workflow_dispatch` (manual) job that runs `argus heal`
  on given `url`/`spec`, **secret-gated** (`ANTHROPIC_API_KEY`) and non-auto-firing. Comment
  documents flipping it to `workflow_run`-on-QA-Gate-failure for full auto.
- **`docs/DEMO.md`** — the drift + real-bug runbooks (user-run; opens a real PR / costs API).

## Done: M4 (mostly) — `TRE-42/43/44`

Spec: `docs/superpowers/specs/2026-06-12-mcp-server-design.md`.
- **`TRE-42`** — real `@argus/mcp` stdio server. `createArgusMcpServer({ getContext })` registers
  all 10 registry tools over MCP (via `toMcp()`); each routes to `registry.execute` against a
  lazily-launched Playwright context. `argus-mcp` bin builds; in-memory client/server test (lists
  10 tools + routes a call). No API key needed (the client LLM reasons); needs chromium.
- **`TRE-43`** — `docs/MCP.md`: build steps + Claude Code (`claude mcp add` / `.mcp.json`) and
  Claude Desktop config snippets + the tool table.
- **`TRE-44`** — README: CI + QA Gate badges, self-heal demo, "use it on your own app"
  (`--base-url`), MCP pointer, roadmap marked through M3.
- **`TRE-46`** — Treeship provenance, **merged** (PR #1): `argus heal` wraps the triage→heal flow in
  a signed `treeship` session by default (`--no-receipt` to opt out), attesting each tool call +
  model decision via the optional `@treeship/sdk` (dynamic import, zero hard dep). `docs/TREESHIP.md`.
- **Remaining:** `TRE-45` (demo GIFs — record `argus generate`, the red→green gate, and a self-heal
  PR; **needs a person**).

## Done: landing page (`apps/web`)

Spec: `docs/superpowers/specs/2026-06-13-landing-page-design.md`. Plan:
`docs/superpowers/plans/2026-06-13-landing-page.md`.
- **`apps/web`** — a standalone Next 15 / React 19 App Router app in the workspace, Tailwind v4
  with the **Sentinel** palette, `motion` (Framer Motion) for scroll/entrance animation, and a
  **pre-rendered Remotion hero video** (`public/argus-loop.mp4`, 18s, cycling
  Generate→Gate→Triage→Heal). Sections: Hero · Loop · Architecture · Advantages · Provenance ·
  Footer. Dev: `pnpm --filter @argus/web dev` (→ :3200). Re-render the video:
  `pnpm --filter @argus/web render` (Remotion fetches its own headless Chrome).
- **Deployed (live):** <https://argus-web-psi.vercel.app> — Vercel project `argus-web`
  (`piyushpathakqas-projects`), a separate project from this same repo with **Root Directory
  `apps/web`** (set on the project; `apps/web/vercel.json` pins framework/build/install). The
  `.vercel` link lives at the **repo root** (gitignored) so the whole monorepo uploads and Vercel
  installs from the root `pnpm-lock.yaml`. **Re-deploy:** `vercel deploy --prod` from the repo
  root. (Deploying from inside `apps/web` fails — it uploads only that folder with no lockfile;
  that's why Root Directory + root-level link is required.) Git auto-deploy on push is **not** yet
  wired — deploys are currently manual via the CLI.

## Process notes
- Design is locked in `docs/DESIGN.md`. Tickets in Linear mirror `docs/ROADMAP.md`.
- This project was scoped via the brainstorming process; each milestone gets built, verified,
  and committed before moving on. Keep that discipline: **don't claim done without running the
  verification commands.**

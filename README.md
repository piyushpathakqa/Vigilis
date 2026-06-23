# 👁️ Vigilis — Agentic QA Framework

> An agentic QA framework that **authors, generates, triages, and self-heals** Playwright,
> Cypress, and Selenium tests for any web app — usable from Claude Code/Desktop as an **MCP server**
> or from CI as a **CLI** — with the whole loop running as a deployment gate in **GitHub Actions**.
> Framework is **auto-detected**; pass `--framework playwright|cypress|selenium` to force one.

[![CI](https://github.com/piyushpathakqa/Vigilis/actions/workflows/ci.yml/badge.svg)](https://github.com/piyushpathakqa/Vigilis/actions/workflows/ci.yml)
[![QA Gate](https://github.com/piyushpathakqa/Vigilis/actions/workflows/qa.yml/badge.svg)](https://github.com/piyushpathakqa/Vigilis/actions/workflows/qa.yml)

**🌐 Live site → [vigilis.dev](https://vigilis.dev)** · the landing page (`apps/web`), built with Next.js, Framer Motion & a pre-rendered Remotion hero.

> [!NOTE]
> **M0–M3 complete, M4 in progress.** The full loop runs as code: generate a test from a URL → gate
> it in CI → triage a failure → self-heal DOM drift with a PR (while refusing real bugs). See
> [Roadmap](#roadmap).

---

## Why

Test suites are expensive to write and brittle to maintain. Vigilis puts a Claude agent in the
loop to do the slow parts: explore an app and write real tests (Playwright, Cypress, or Selenium),
then — when the UI drifts — diagnose the failure and open a fix PR, while still refusing to paper
over genuine bugs. The framework is **auto-detected** from your project; use `--framework` to force
one explicitly.

## The idea: one core, two consumers

Vigilis defines its QA tools **once** and exposes them **twice**.

```
                     ┌──────────────────────────────┐
                     │   @argus/core                │
                     │   Agent loop (Claude)        │   Anthropic Messages API + tool use
                     │   + single Tool Registry     │   browser · dom · fs · playwright · git
                     └───────┬───────────────┬──────┘
                             │               │
              ┌──────────────▼──┐         ┌──▼───────────────┐
              │ @argus/mcp      │         │ @argus/cli       │
              │ MCP server      │         │ npx argus ...    │
              │ (Claude Desktop)│         │ (used in CI)     │
              └─────────────────┘         └──────────────────┘
```

## The loop: four behaviors

| Stage | Input | The agent… | Output |
|-------|-------|------------|--------|
| **Author** | Plain-English intent | compiles intent into a structured test plan | `*.plan.json` |
| **Generate** | A URL | explores the app, writes specs with assertions | `tests/*.spec.ts` |
| **Triage** | A failed run | classifies real bug vs DOM drift vs flake | root-cause report |
| **Heal** | A drift verdict | rewrites the locator, verifies green, opens a PR | a pull request |

## Quickstart

```bash
pnpm install
cp .env.example .env   # add your ANTHROPIC_API_KEY
pnpm build
```

### Watch the agent run (E2E)

The agent loop is live. Point it at the bundled demo app and watch it explore — navigate, snapshot
the DOM, read `data-testid`s, and click through the login → cart flow:

```bash
pnpm --filter @argus/core exec playwright install chromium   # one-time
pnpm --filter @argus/sample-shop dev                          # terminal 1 → http://localhost:3100
node --env-file=.env packages/cli/dist/index.js smoke http://localhost:3100/login   # terminal 2
```

It prints a step-by-step trace and a token/cost line (~$0.05–0.15 per run on the fast model).
Requires a real Anthropic **API** key (a Max subscription doesn't fund the API).

Or have it **write a test and run it green**:

```bash
node --env-file=.env packages/cli/dist/index.js generate http://localhost:3100/login --run
```

It explores the app, writes `tests/generated/login.spec.ts`, and runs it against sample-shop
(`3 passed, 0 failed`). Defaults to Opus for quality; add `--model claude-haiku-4-5` for ~10¢ runs.

### See it self-heal

Seed a DOM drift, then watch Vigilis triage and fix it (full runbook: [`docs/DEMO.md`](./docs/DEMO.md)):

```bash
NEXT_PUBLIC_ARGUS_DEMO_DRIFT=1 pnpm --filter @argus/sample-shop dev   # renames a data-testid
node --env-file=.env packages/cli/dist/index.js heal \
  http://localhost:3100/login --spec tests/generated/login.spec.ts    # → dom-drift → fix → PR
```
On `dom-drift` it rewrites the locator, **re-runs to verify green**, and opens a PR. On a real bug
(`NEXT_PUBLIC_ARGUS_DEMO_BUG=1`) it refuses and blocks the gate — Vigilis improves signal, it doesn't
hide failures.

### Use it in your own Playwright, Cypress, or Selenium project

Install the [`vigilis`](https://www.npmjs.com/package/vigilis) package, then `vigilis init`
scaffolds a `vigilis.config.json` so `generate`/`triage`/`heal` pick up your project's defaults
(`baseUrl`, `testDir`, `model`, `framework`) — explicit flags always override it:

```bash
npm i -D vigilis
export ANTHROPIC_API_KEY=sk-...
vigilis init                                       # auto-detects framework (playwright.config.*, etc.), writes vigilis.config.json
vigilis generate https://your-app.com/login --run  # explore → write + run a real spec
vigilis generate https://your-app.com/login --framework cypress --run  # force Cypress output
```

Playwright is the most battle-tested surface; Cypress and Selenium support is built and unit-tested.
All three frameworks use the same `generate`/`triage`/`heal` commands — the `--framework` flag
(or the `framework` field in `vigilis.config.json`) selects the adapter.

Or point any command at any URL directly; `--base-url` runs generated specs against any host:

```bash
node --env-file=.env packages/cli/dist/index.js generate https://your-app.com/login \
  --run --base-url https://your-app.com
```

> Generated files are plain Playwright specs — copy them into your repo's test folder and own
> them like any other test. (An `npm install`-able `argus` package is on the roadmap.)

### Drive it from Claude Desktop / Code (MCP)

`@argus/mcp` exposes the QA tools over MCP. Setup + config snippets: [`docs/MCP.md`](./docs/MCP.md).

### Provenance receipts

When the [Treeship](https://www.treeship.dev) CLI is installed, **every `argus heal` run is sealed
into a signed, offline-verifiable receipt automatically** — *self-healing QA you can audit*. No hard
dependency; `--no-receipt` to opt out. See [`docs/TREESHIP.md`](./docs/TREESHIP.md).

## Repo layout

```
argus/
├─ packages/
│  ├─ core/   # agent loop, tool registry, Claude client, prompts
│  ├─ mcp/    # MCP server wrapping the registry
│  └─ cli/    # `argus author|generate|triage|heal`
├─ apps/
│  ├─ sample-shop/   # Next.js demo target (login + products + cart)
│  └─ web/           # landing page (Next 15 · motion · Remotion hero) → Vercel
└─ tests/     # generated Playwright specs land here
```

## Roadmap

- ✅ **M0 — Foundations** · monorepo, tooling, CI
- ✅ **M1 — Core + sample-shop + Generate** · `argus generate <url> --run` writes + runs real tests
- ✅ **M2 — CLI + GitHub Actions gate** · the `QA Gate` check runs generated specs (red/green)
- ✅ **M3 — Triage + Heal** · `argus heal` fixes DOM drift with a PR, refuses real bugs
- 🚧 **M4 — MCP server + polish** · `argus-mcp` is live ([`docs/MCP.md`](./docs/MCP.md)); demo GIFs next
- ✅ **Landing page** · [`apps/web`](./apps/web) deployed to Vercel → [vigilis.dev](https://vigilis.dev)

## License

[MIT](./LICENSE) © Piyush Pathak

# 👁️ Argus — Agentic QA Framework

> An agentic QA framework that **authors, generates, triages, and self-heals** Playwright
> tests for any web app — usable from Claude Code/Desktop as an **MCP server** or from CI as a
> **CLI** — with the whole loop running as a deployment gate in **GitHub Actions**.

[![CI](https://github.com/piyushpathakqa/argus/actions/workflows/ci.yml/badge.svg)](https://github.com/piyushpathakqa/argus/actions/workflows/ci.yml)

> [!NOTE]
> 🚧 Early development. Build progress is tracked as milestones M0 → M4 (see [Roadmap](#roadmap)).

---

## Why

Test suites are expensive to write and brittle to maintain. Argus puts a Claude agent in the
loop to do the slow parts: explore an app and write real Playwright tests, then — when the UI
drifts — diagnose the failure and open a fix PR, while still refusing to paper over genuine bugs.

## The idea: one core, two consumers

Argus defines its QA tools **once** and exposes them **twice**.

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

_Full CLI / MCP usage docs land with milestones M2 and M4._

## Repo layout

```
argus/
├─ packages/
│  ├─ core/   # agent loop, tool registry, Claude client, prompts
│  ├─ mcp/    # MCP server wrapping the registry
│  └─ cli/    # `argus author|generate|triage|heal`
├─ apps/
│  └─ sample-shop/   # Next.js demo target (login + products + cart)
└─ tests/     # generated Playwright specs land here
```

## Roadmap

- **M0 — Foundations** · monorepo, tooling, CI stub
- **M1 — Core + sample-shop + Generate** · the first "AI writes real tests" moment
- **M2 — CLI + GitHub Actions gate** · failing tests block deployment
- **M3 — Triage + Heal** · self-healing PRs
- **M4 — MCP server + polish** · drive Argus from Claude Desktop; demo GIFs

## License

[MIT](./LICENSE) © Piyush Pathak

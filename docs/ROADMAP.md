# Argus — Roadmap & Linear ticket map

Tracked in **Linear**: team "Trek baba" (key `TRE`), project
[Argus — Agentic QA Framework](https://linear.app/trek-baba/project/argus-agentic-qa-framework-029125b28072).

Epics are milestones (M0–M4). Each has sub-issues with concrete "Done when" criteria.
Status legend: ✅ done · 🔜 next · ⬜ not started.

## M0 — Foundations · `TRE-22` ✅
Stand up the monorepo so every later package has a home.

| Ticket | Title | Status |
|--------|-------|--------|
| `TRE-27` | Scaffold pnpm workspace + shared TS/lint config | ✅ |
| `TRE-28` | Build pipeline (tsup) + Vitest + lint/typecheck CI stub | ✅ |
| `TRE-29` | Repo meta: README skeleton, MIT LICENSE, .env.example, .gitignore, initial commit | ✅ |

## M1 — Core + sample-shop + Generate · `TRE-23` (first wow)
The agent core + a controllable target app + autonomous test generation.

| Ticket | Title | Status |
|--------|-------|--------|
| `TRE-30` | sample-shop: Next.js target app (login + products + cart) | ✅ |
| `TRE-31` | Tool Registry: browser / dom / fs / playwright tool definitions | 🔜 **next** |
| `TRE-32` | @argus/core: Claude agent loop (Messages API + tool-use orchestration) | ⬜ |
| `TRE-33` | Generate behavior: explore app → emit runnable Playwright specs | ⬜ |
| `TRE-34` | Prompt & context engineering for Generate (system prompt + DOM snapshot) | ⬜ |

## M2 — CLI + GitHub Actions gate · `TRE-24` (CI/CD story)

| Ticket | Title | Status |
|--------|-------|--------|
| `TRE-35` | @argus/cli: commander-based author/generate/triage/heal commands | ⬜ (surface scaffolded in M0) |
| `TRE-36` | GitHub Actions: build sample-shop + run Playwright as a required gate | ⬜ |
| `TRE-37` | Artifact pipeline: capture & upload trace/screenshots/logs for triage | ⬜ |

## M3 — Triage + Heal · `TRE-25` (self-healing showcase)

| Ticket | Title | Status |
|--------|-------|--------|
| `TRE-38` | Triage behavior: classify bug vs drift vs flake | ⬜ |
| `TRE-39` | Heal behavior: rewrite locator, verify green, open a PR | ⬜ |
| `TRE-40` | Demo scenario: seeded data-testid drift + a real-bug negative case | ⬜ |
| `TRE-41` | CI wiring: on-failure triage job → conditional heal-PR job | ⬜ |

## M4 — MCP server + README/demo polish · `TRE-26` (others can use it)

| Ticket | Title | Status |
|--------|-------|--------|
| `TRE-42` | @argus/mcp: MCP server exposing the Tool Registry + behaviors | ⬜ (stub in M0) |
| `TRE-43` | MCP usage docs + Claude Desktop/Code config snippet | ⬜ |
| `TRE-44` | README polish: architecture diagram, quickstart, "use it on your own app" | ⬜ |
| `TRE-45` | Record demo GIFs: generate, CI gate red→green, self-heal PR | ⬜ |
| `TRE-46` | Treeship showcase: optional, decoupled provenance receipts over the loop (zero-dep CLI `wrap`; optional SDK observer behind a flag) | ⬜ |

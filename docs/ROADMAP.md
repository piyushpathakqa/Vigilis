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

## M1 — Core + sample-shop + Generate · `TRE-23` ✅ (first wow)
The agent core + a controllable target app + autonomous test generation.

| Ticket | Title | Status |
|--------|-------|--------|
| `TRE-30` | sample-shop: Next.js target app (login + products + cart) | ✅ |
| `TRE-31` | Tool Registry: browser / dom / fs / playwright tool definitions | ✅ |
| `TRE-32` | @argus/core: Claude agent loop (Messages API + tool-use orchestration) | ✅ |
| `TRE-33` | Generate behavior: explore app → emit runnable Playwright specs | ✅ |
| `TRE-34` | Prompt & context engineering for Generate (system prompt + DOM snapshot) | ✅ |

**M1 complete** ✅ — Argus writes runnable Playwright specs from a URL (`argus generate <url> --run`),
on any app (`--base-url`).

## M2 — CLI + GitHub Actions gate · `TRE-24` ✅ (CI/CD story)

| Ticket | Title | Status |
|--------|-------|--------|
| `TRE-35` | @argus/cli: commander-based author/generate/triage/heal commands | ✅ (surface live; `generate`/`smoke` real, `triage`/`heal` placeholders for M3) |
| `TRE-36` | GitHub Actions: run agent-generated Playwright specs as a gate | ✅ (`.github/workflows/qa.yml`, green) |
| `TRE-37` | Artifact pipeline: capture & upload trace/screenshots/logs for triage | ✅ (playwright.config + upload-artifact) |

**M2 complete** ✅ — the `QA Gate` check runs the AI-generated Playwright specs against sample-shop
on every push/PR (red on failure, with the trace uploaded). Next milestone: **M3 (`TRE-25`)** —
Triage + self-healing PRs.

## M3 — Triage + Heal · `TRE-25` ✅ (self-healing showcase)

| Ticket | Title | Status |
|--------|-------|--------|
| `TRE-38` | Triage behavior: classify bug vs drift vs flake | ✅ |
| `TRE-39` | Heal behavior: rewrite locator, verify green, open a PR | ✅ |
| `TRE-40` | Demo scenario: seeded data-testid drift + a real-bug negative case | ✅ |
| `TRE-41` | CI wiring: on-failure triage job → conditional heal-PR job | ✅ (manual-dispatch `self-heal.yml`; auto-trigger documented) |

**M3 complete** ✅ — Triage + self-healing. `argus heal` fixes DOM drift (→ PR) and refuses real
bugs; sample-shop has seeded drift/bug toggles + `docs/DEMO.md`. Next: **M4 (`TRE-26`)** — MCP
server + README/demo polish.

## M4 — MCP server + README/demo polish · `TRE-26` (others can use it)

| Ticket | Title | Status |
|--------|-------|--------|
| `TRE-42` | @argus/mcp: real stdio MCP server exposing the Tool Registry | ✅ |
| `TRE-43` | MCP usage docs + Claude Desktop/Code config snippet (`docs/MCP.md`) | ✅ |
| `TRE-44` | README polish: badges, quickstart, "use it on your own app" (`--base-url`) | ✅ |
| `TRE-45` | Record demo GIFs: generate, CI gate red→green, self-heal PR | ⬜ (needs a human to record) |
| `TRE-46` | Treeship showcase: optional, decoupled provenance receipts over the loop | 🌿 Tier-1 on `feat/treeship-showcase` (`docs/TREESHIP.md` + `scripts/heal-with-receipt.sh`); Tier-2 SDK observer deferred |

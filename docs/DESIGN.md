# Vigilis — Design Document

> The validated design from the brainstorming session. This is the "why", not just the "what".
> If you're about to make an architectural change, read this first and keep it updated.

## 1. Goal

A single artifact that showcases three of Piyush Pathak's strengths as a Staff SDET, with
**running code** rather than claims:

1. **AI-augmented QA** — making test creation/maintenance fast and efficient.
2. **CI/CD integration** — tests as a deployment gate.
3. **A reusable agentic framework** — something others can actually pick up and use.

It is **both** a real open-source repo (others can `npx` / attach via MCP) **and** a polished
portfolio piece (README, demo GIFs, sample app).

## 2. The core insight: one core, two consumers

Vigilis defines its QA tools **once** and exposes them **twice**. This is the part that reads as
senior architecture rather than four disconnected demos.

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

The same Tool Registry powers the autonomous agent loop **and** is surfaced over MCP, so a human
in Claude Desktop drives the exact tools the agent uses.

## 3. The loop: four behaviors, one core

These are **not** four separate features — they are four stages of one agentic loop.

```
   ① AUTHOR ──▶ ② GENERATE ──▶ run in CI ──▶ ③ TRIAGE ──▶ ④ HEAL ──┐
   (NL intent)   (explore+write)   (gate)     (root-cause)  (fix PR) │
        ▲                                                            │
        └────────────────── re-run / converge ───────────────────────┘
```

| Stage | Input | The agent… | Output |
|-------|-------|------------|--------|
| **Author** | Plain-English intent | compiles intent into a structured test plan | `*.plan.json` |
| **Generate** | A URL (+ optional plan) | explores the app, writes specs with assertions | `tests/*.spec.ts` |
| **Triage** | A failed run (trace/screenshots/logs) | classifies real bug vs DOM drift vs flake | root-cause report |
| **Heal** | A `dom-drift` verdict | rewrites the locator, verifies green, opens a PR | a pull request |

**Guardrail:** Heal must never auto-fix a `real-bug` verdict — it blocks the gate instead. This
proves the agent improves signal rather than hiding failures.

## 4. CI/CD data flow (GitHub Actions — the demo centerpiece)

```
push ─▶ build sample-shop ─▶ run Playwright suite
                                   │
                       ┌───pass────┴────fail───┐
                       ▼                        ▼
                  ✅ gate open            argus triage (Claude)
                  (deploy allowed)             │
                                   ┌──drift?────┴───real bug?──┐
                                   ▼                            ▼
                            argus heal → PR              ❌ gate blocks
                            (auto-fix locator)           + PR comment w/ root cause
```

This makes "failing tests block deployment" literally visible as a red/green check.

## 5. Repo layout

```
argus/
├─ packages/
│  ├─ core/        # agent loop, tool registry, Claude client, prompts
│  ├─ mcp/         # MCP server wrapping the registry
│  └─ cli/         # `argus author|generate|triage|heal`
├─ apps/
│  └─ sample-shop/ # Next.js login + product list + cart (the target)
├─ tests/          # generated Playwright specs land here
├─ docs/           # this design, status, roadmap
└─ .github/workflows/  # ci.yml (M0), qa.yml (M2+)
```

## 6. Tech decisions & rationale

| Decision | Choice | Why |
|----------|--------|-----|
| Language | TypeScript, ESM | Piyush's core strength; matches Playwright ecosystem |
| Monorepo | pnpm workspaces | Clean package boundaries for core/mcp/cli + sample app |
| Agent | `@anthropic-ai/sdk`, **hand-rolled** tool-use loop | Shows understanding of agents, not just glue code |
| MCP | `@modelcontextprotocol/sdk` (stdio) | Directly demonstrates the "MCP servers" resume bullet |
| Browser | Playwright Test + traces/screenshots | Traces are the fuel for the Triage behavior |
| Primary model | `claude-opus-4-8` | Deep reasoning for generate + triage |
| Fast model | `claude-haiku-4-5` | Cheap lightweight steps |
| Demo target | **Bundled** Next.js `sample-shop` | We control it → can script the "break → heal" on camera; runs offline in CI |
| CI provider | GitHub Actions (primary) | Repo lives on GitHub; recruiters see it run live |
| Healing PRs | Octokit / `gh` | Open auto-fix PRs from the Action |

## 7. Build order (so there's always something working)

1. **M0 — Foundations:** monorepo, tooling, CI stub. ✅ *(done)*
2. **M1 — Core + sample-shop + Generate:** first wow — AI writes real tests.
3. **M2 — CLI + GitHub Actions gate:** CI/CD story visible (red/green).
4. **M3 — Triage + Heal:** the self-healing showcase.
5. **M4 — MCP server + README/demo polish:** "others can use it".

## 8. YAGNI — explicitly out of scope (for now)

- No multi-browser matrix, no dashboard UI, no auth providers, no DB.
- `sample-shop` keeps state in memory.
- These can be added later; they are not needed to tell the story.

## 9. Public framework documentation lookup

The shared registry adds lazy `web_search` and `web_fetch` tools backed by anonymous
[Parallel Search MCP](https://docs.parallel.ai/integrations/mcp/search-mcp), using
the MCP SDK's Streamable HTTP transport. Search uses Fast mode. This gives CLI
behaviors and MCP clients the same documentation lookup without another account
or credential. There was no previous web-search provider. Browser/DOM tools still
inspect the application; retrieved web content is untrusted reference material,
never authority for a triage verdict.

`VIGILIS_SEARCH=off` removes the tools for private/offline workflows. Embedders can
pass `createDefaultRegistry({ search: false })` or inject a `SearchProvider`; an
explicit choice wins over the environment. There is no fallback after provider
failure. Connections, discovery and tool execution share a 30-second deadline;
`ToolContext.signal` propagates caller cancellation. MCP server requests pass
their cancellation signal into that context. No requests occur on registry creation.
See [SEARCH.md](./SEARCH.md) for data sharing and configuration.

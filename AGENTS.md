# AGENTS.md — context for AI assistants (Cursor, Claude Code, etc.)

> Read this first. It orients you fast so you don't re-derive decisions already made.
> Cursor, Claude Code, and most agent tools auto-load this file.

## What this project is

**Vigilis** is an **agentic QA framework**: a Claude agent that **authors, generates, triages,
and self-heals Playwright tests** for any web app. It ships two ways from one core:

- **MCP server** (`@argus/mcp`) — drive it from Claude Desktop/Code
- **CLI** (`@argus/cli`) — drive it from CI

The whole loop runs as a deployment gate in **GitHub Actions**. It is a portfolio + OSS
showcase for Piyush Pathak (Staff SDET) demonstrating AI-augmented QA, MCP, prompt
engineering, and CI/CD gating with running code.

## Where to find things

| Doc | What's in it |
|-----|--------------|
| `docs/DESIGN.md` | Architecture, the four-behavior loop, **every decision + rationale**, stack |
| `docs/STATUS.md` | **Current state, what's done, what's next, how to resume** — read before working |
| `docs/ROADMAP.md` | Milestones M0–M4 mapped to Linear ticket IDs (TRE-22..45) |
| `README.md` | Public-facing pitch, quickstart, architecture diagram |

## The one-sentence architecture

Define the QA tools **once** in `@argus/core` (a single Tool Registry), expose them **twice**
(MCP server + CLI). One Claude agent loop, four behaviors: Author → Generate → Triage → Heal.

## Conventions

- **Language:** TypeScript, ESM (`"type": "module"`), strict tsconfig.
- **Monorepo:** pnpm workspaces. Packages live in `packages/*`, apps in `apps/*`.
- **Build:** `tsup` per package. **Typecheck:** `tsc --noEmit`. **Test:** Vitest. **Lint:** ESLint flat config.
- **Cross-package imports** resolve to `dist/` at runtime, but typecheck maps `@argus/core`
  to its **source** via `paths` in consumer tsconfigs (see `packages/cli/tsconfig.json`).
- **Models:** defaults in `packages/core/src/index.ts` — `claude-opus-4-8` (primary),
  `claude-haiku-4-5` (fast); overridable via `ARGUS_MODEL_*` env vars.
- **Secrets:** `ANTHROPIC_API_KEY` in `.env` (see `.env.example`). Never commit `.env`.

## Commands

```bash
pnpm install            # install workspace
pnpm build              # tsup build all packages
pnpm typecheck          # tsc --noEmit, all packages
pnpm test               # vitest, all packages
pnpm lint               # eslint
node packages/cli/dist/index.js --help   # run the CLI after build
```

## Work tracking

Tracked in **Linear** (team "Trek baba", key `TRE`), project "Vigilis — Agentic QA Framework".
Milestones are epics TRE-22 (M0) → TRE-26 (M4); tasks are TRE-27..46. See `docs/ROADMAP.md`.

## Current status (short version)

**M0 done. M1 in progress:** `TRE-30` (sample-shop app) and `TRE-31` (shared Tool Registry in
`@argus/core`) are done and verified. **Next up: `TRE-32`** — the Claude agent loop. See
`docs/STATUS.md` for the full picture, including the one open chore (pushing to GitHub needs a
`workflow` OAuth scope).

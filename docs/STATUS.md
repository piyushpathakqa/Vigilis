# Argus — Status & Handoff

> **Read this to resume work with zero context loss.** Last updated: 2026-06-12.

## ▶ To continue right now (start here)

1. Read `AGENTS.md`, then this file, then `docs/DESIGN.md`. The design is locked — don't
   re-litigate it; just build the next ticket.
2. **Next ticket: `TRE-30`** — build the `sample-shop` Next.js app. Full spec in the
   [Next: M1](#next-m1--tre-30-sample-shop-nextjs-app) section below.
3. Work the M1 order: `TRE-30` (app) → `TRE-31` (Tool Registry) → `TRE-32` (agent loop) →
   `TRE-33` (Generate) → `TRE-34` (prompts).
4. **Before claiming any task done, run and pass:**
   ```bash
   pnpm lint && pnpm typecheck && pnpm test && pnpm build
   ```
5. Commit per ticket with a message like `M1: <what> (TRE-30)`. If `pnpm` is missing:
   `corepack enable && corepack prepare pnpm@9.15.0 --activate`.

---

## TL;DR

- **M0 (Foundations) is complete and verified.** The monorepo builds, typechecks, lints, and
  tests green. The `argus` CLI runs with placeholder commands.
- **Next task: `TRE-30`** — build the `sample-shop` Next.js app (first task of M1).
- **One open chore:** pushing to GitHub is blocked on adding the `workflow` OAuth scope to the
  `gh` CLI (see [Open chores](#open-chores)). The repo exists; the commit is local.

## What exists right now

### Verified green (run from repo root)
```bash
pnpm install     # ✓ 292 packages
pnpm lint        # ✓ eslint clean
pnpm typecheck   # ✓ tsc --noEmit, all 4 packages
pnpm test        # ✓ vitest — core 2/2 pass; mcp/cli pass-with-no-tests
pnpm build       # ✓ tsup — core/mcp/cli emit dist/
node packages/cli/dist/index.js --help     # ✓ prints command surface
```

### Package inventory
| Package | State | Notes |
|---------|-------|-------|
| `@argus/core` | scaffold | Exports model config (`MODELS`, `resolveModel`) + a passing Vitest. Agent loop & Tool Registry land in M1. |
| `@argus/mcp` | stub | `describeServer()` placeholder. Real stdio MCP server = `TRE-42` (M4). |
| `@argus/cli` | working surface | `commander` CLI with `generate/author/triage/heal` commands wired to placeholder actions. Real logic in M1–M3. |
| `@argus/sample-shop` | placeholder | Empty package.json + README. Real Next.js app = `TRE-30` (M1). |

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
- Remote `origin` → `https://github.com/piyushpathakqa/argus.git` (repo created, **not yet pushed**).

## Open chores

### 1. Push to GitHub (blocked on OAuth scope)
The `gh` token lacks the `workflow` scope, so GitHub refuses to push `.github/workflows/ci.yml`.
**Fix (interactive — run in a terminal):**
```bash
gh auth refresh -h github.com -s workflow   # complete the browser/device authorization fully
git push -u origin main
```
Until then, all work is safe locally; nothing is lost.

## Environment setup (for a fresh machine / Cursor)
```bash
corepack enable && corepack prepare pnpm@9.15.0 --activate   # if pnpm missing
cd argus
pnpm install
cp .env.example .env        # add ANTHROPIC_API_KEY
```

## Next: M1 — `TRE-30` (sample-shop Next.js app)

Build a small **Next.js (App Router)** app in `apps/sample-shop`:
- **Pages/flows:** login → product list → cart with a badge count.
- **State:** in-memory, no DB.
- **Stable `data-testid`s** on key elements — these are what we deliberately "drift" later to
  demo self-healing (M3, `TRE-40`).
- **Done when:** `pnpm --filter @argus/sample-shop dev` serves a usable login→browse→add-to-cart flow.

Notes for the implementer:
- Keep it deterministic and tiny; it's a test target, not a product.
- Next.js App Router + Server Components by default; add `'use client'` only where needed.
- After it runs, the natural follow-on is `TRE-31` (Tool Registry) then `TRE-32` (agent loop),
  because `TRE-33` (Generate) needs a real app + real tools to exercise.

## Process notes
- Design is locked in `docs/DESIGN.md`. Tickets in Linear mirror `docs/ROADMAP.md`.
- This project was scoped via the brainstorming process; each milestone gets built, verified,
  and committed before moving on. Keep that discipline: **don't claim done without running the
  verification commands.**

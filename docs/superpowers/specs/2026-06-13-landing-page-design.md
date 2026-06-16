# Argus Landing Page — Design Spec

> Status: approved 2026-06-13. A new `apps/web` Next.js landing page for Argus, deployed to Vercel
> from this monorepo. Marketing/portfolio surface — not part of the M0–M4 ticket line.

## 1. Goal

A stylish, animated single-page landing site that explains Argus's architecture and advantages and
drives to the GitHub repo. Cinematic-dark "Sentinel" aesthetic, Framer Motion interactions, and a
pre-rendered Remotion hero video of the four-behavior loop.

## 2. Stack & decisions (resolved)

| Decision | Choice |
|----------|--------|
| App | New `apps/web` — Next.js 15 (App Router), React 19, TypeScript (joins the pnpm workspace) |
| Styling | **Tailwind CSS v4** (`@tailwindcss/postcss`, `@import "tailwindcss"`) |
| Interactive animation | **`motion`** (Framer Motion's current package; `import { motion } from 'motion/react'`) |
| Hero video | **Remotion** composition → **pre-rendered to `public/argus-loop.mp4`, committed**; hero plays it as an autoloop `<video>`. (No video render in CI; re-render locally.) |
| Visual direction | **Sentinel** — near-black canvas, glowing cyan→violet eye orb, gradient display type, animated grid, glass cards |
| Deploy | New Vercel project, **root directory `apps/web`**, builds on push; one-time `vercel link` is user-run |
| Testing | lint + typecheck + `next build` (no unit tests — marketing page; matches sample-shop) |
| Dev port | 3200 (sample-shop is 3100) |

## 3. Design tokens

- Canvas `#05060a`; panel/glass `rgba(255,255,255,0.04)` + `1px` hairline border `rgba(255,255,255,0.08)`.
- Accent gradient `#22d3ee → #6366f1 → #a78bfa` (cyan→indigo→violet); text `#e6edf3`, muted `#9fb3d1`.
- Display font via `next/font/google` (e.g. **Space Grotesk** / **Sora**); body system sans; mono for traces.
- Eye orb: radial `circle at 50% 50%, #22d3ee, #6366f1, #0b1020` with cyan glow `box-shadow`.

## 4. Page structure (`app/page.tsx` + section components)

```
app/
  layout.tsx        # fonts, metadata, <body> dark canvas
  page.tsx          # composes the sections
  globals.css       # tailwind + tokens + keyframes
components/
  Hero.tsx          # eye orb + ARGUS + tagline + <video> loop + CTAs
  EyeOrb.tsx        # animated glowing orb (motion)
  LoopSection.tsx   # Generate → Gate → Triage → Heal (scroll-staggered cards)
  ArchSection.tsx   # one-core/two-consumers diagram (draw-on)
  Advantages.tsx    # value grid (hover micro-interactions)
  Provenance.tsx    # "self-healing QA you can audit" + receipt snippet
  Footer.tsx        # quickstart + GitHub/docs links
  GridBackground.tsx# subtle animated grid/particles
remotion/
  Root.tsx          # registerRoot — <Composition id="ArgusLoop" .../>
  ArgusLoop.tsx     # the ~18s loop animation (Sentinel palette)
  index.ts          # registerRoot(Root)
public/
  argus-loop.mp4    # pre-rendered, committed
```

Components that use `motion` or browser APIs are client components (`'use client'`).

### Content (from real repo facts)
- Hero tagline: "The agent that writes, gates & self-heals your tests."
- Loop: **Generate** (URL → runnable Playwright spec) · **Gate** (CI red/green) · **Triage**
  (real-bug / DOM-drift / flake) · **Heal** (rewrite locator, verify green, open a PR; refuses real bugs).
- Architecture: one `@argus/core` (agent loop + tool registry) → two consumers (`@argus/cli`, `@argus/mcp`).
- Advantages: AI writes real tests · failing tests block deploy · self-healing PRs that don't hide
  bugs · **signed Treeship provenance receipts** · drive the tools from Claude via MCP.
- Links: GitHub `https://github.com/piyushpathakqa/Vigilis`; docs in-repo.

## 5. Animation

Framer Motion: section entrances via `whileInView` + stagger; the eye orb pulses/breathes on a loop;
the loop cards reveal and a connecting line draws as you scroll; the architecture diagram animates
its nodes/edges in; hover lifts on cards; gradient text. Respect `prefers-reduced-motion`.

The Remotion `ArgusLoop` composition animates the four stages in sequence (a spec being typed, a
gate flipping red→green, a triage verdict stamp, a heal PR opening) in the Sentinel palette,
1920×1080, ~18s, 30fps. `pnpm --filter @argus/web render` → `public/argus-loop.mp4`.

## 6. Monorepo + CI + deploy

- `apps/web/package.json`: `dev` (`next dev -p 3200`), `build` (`next build`), `typecheck`
  (`tsc --noEmit`), `render` (`remotion render ...`). Deps: `next`, `react`, `react-dom`, `motion`;
  dev: `tailwindcss`, `@tailwindcss/postcss`, `remotion`, `@remotion/cli`, `@types/*`.
- Root `pnpm build`/`typecheck`/`lint` already recurse into `apps/*`, so `apps/web` joins CI
  (`ci.yml`) automatically. `next build` references the committed MP4 (no Remotion at build time).
- ESLint: exclude `apps/web/remotion/**`? No — keep it linted; it's hand-authored. `.next` already ignored.
- Deploy: Vercel project with **Root Directory = `apps/web`**; Vercel auto-detects the pnpm
  workspace and installs from the repo root. One-time `vercel login` + link is user-run; a
  `vercel.json` is added only if needed.

## 7. Non-goals

- No CMS/blog/backend; static marketing page.
- No unit tests; no rendering the Remotion video in CI (MP4 is committed).
- Not wired into the existing QA Gate (that gate is sample-shop).

## 8. Done when

- `apps/web` builds (`next build`) and runs (`next dev -p 3200`) showing the Sentinel landing with
  all sections + Framer Motion animations + the hero video.
- `pnpm lint && pnpm typecheck && pnpm build` green across the workspace (incl. apps/web).
- The Remotion composition renders `public/argus-loop.mp4` locally and the hero plays it.
- Deploy guidance documented (`docs/` or README); user can `vercel` it from `apps/web`.

# Argus Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A stylish, animated Next.js landing page for Argus (`apps/web`) — Sentinel aesthetic, Framer Motion interactions, a pre-rendered Remotion hero video — deployed to Vercel from this monorepo.

**Architecture:** A standalone Next.js 15 App Router app at `apps/web` joining the pnpm workspace. Tailwind v4 for styling, `motion` (Framer Motion) for animation, Remotion for a pre-rendered hero MP4 (committed to `public/`). The page is a single scroll of section components.

**Tech Stack:** Next 15 · React 19 · TypeScript · Tailwind v4 (`@tailwindcss/postcss`) · `motion@12` · `remotion@4`.

**Spec:** `docs/superpowers/specs/2026-06-13-landing-page-design.md`.

**Verification model (no unit tests — marketing page):** each task's gate is `pnpm --filter @argus/web typecheck` + `pnpm --filter @argus/web build` (and visual confirmation via `pnpm --filter @argus/web dev` on :3200). Exact Tailwind classes are refined live against the dev server; the code below is the solid first pass.

**Conventions:** pinned versions — `next@^15.1.6`, `react@^19`, `react-dom@^19`, `motion@^12.40.0`, `tailwindcss@^4.3.1`, `@tailwindcss/postcss@^4.3.1`, `remotion@^4.0.476`, `@remotion/cli@^4.0.476`. Run from repo root.

---

### Task 1: Scaffold `apps/web` (Next 15 + Tailwind v4) — builds green

**Files (create):** `apps/web/package.json`, `tsconfig.json`, `next.config.mjs`, `postcss.config.mjs`, `next-env.d.ts`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`.

- [ ] **Step 1: `apps/web/package.json`**

```json
{
  "name": "@argus/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "description": "Argus landing page (Next.js, Vercel).",
  "license": "MIT",
  "scripts": {
    "dev": "next dev -p 3200",
    "build": "next build",
    "start": "next start -p 3200",
    "typecheck": "tsc --noEmit",
    "render": "remotion render remotion/index.ts ArgusLoop public/argus-loop.mp4 --codec=h264"
  },
  "dependencies": {
    "next": "^15.1.6",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "motion": "^12.40.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.7",
    "@types/react-dom": "^19.0.3",
    "tailwindcss": "^4.3.1",
    "@tailwindcss/postcss": "^4.3.1",
    "remotion": "^4.0.476",
    "@remotion/cli": "^4.0.476"
  }
}
```

- [ ] **Step 2: `tsconfig.json`** (mirror sample-shop's Next tsconfig)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "noEmit": true,
    "incremental": true,
    "allowJs": true,
    "verbatimModuleSyntax": false,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "src/**/*.ts", "src/**/*.tsx", "remotion/**/*.ts", "remotion/**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: `next.config.mjs`, `postcss.config.mjs`, `next-env.d.ts`**

```js
// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = { reactStrictMode: true };
export default nextConfig;
```
```js
// postcss.config.mjs
export default { plugins: { '@tailwindcss/postcss': {} } };
```
```ts
// next-env.d.ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
```

- [ ] **Step 4: `src/app/globals.css`** (Tailwind v4 + Sentinel tokens)

```css
@import "tailwindcss";

@theme {
  --color-canvas: #05060a;
  --color-ink: #e6edf3;
  --color-muted: #9fb3d1;
  --color-cyan: #22d3ee;
  --color-indigo: #6366f1;
  --color-violet: #a78bfa;
}

html, body { background: var(--color-canvas); color: var(--color-ink); }
body { font-family: var(--font-display), ui-sans-serif, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }

.gradient-text {
  background: linear-gradient(90deg, #7dd3fc, #a78bfa);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.glass { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
```

- [ ] **Step 5: `src/app/layout.tsx`** (fonts + metadata)

```tsx
import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Space_Grotesk } from 'next/font/google';

const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display', display: 'swap' });

export const metadata: Metadata = {
  title: 'Argus — Agentic QA Framework',
  description: 'The agent that writes, gates, and self-heals your Playwright tests.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={display.variable}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 6: `src/app/page.tsx`** (minimal placeholder for now)

```tsx
export default function Home() {
  return (
    <main className="min-h-screen grid place-items-center">
      <h1 className="text-5xl font-bold gradient-text">ARGUS</h1>
    </main>
  );
}
```

- [ ] **Step 7: Install + build**

Run: `pnpm install && pnpm --filter @argus/web typecheck && pnpm --filter @argus/web build`
Expected: install links `@argus/web`; typecheck clean; `next build` succeeds (Tailwind v4 compiles, font fetched).

- [ ] **Step 8: Commit**

```bash
git add apps/web/package.json apps/web/tsconfig.json apps/web/next.config.mjs apps/web/postcss.config.mjs apps/web/next-env.d.ts apps/web/src pnpm-lock.yaml
git commit -m "web: scaffold apps/web (Next 15 + Tailwind v4 + Sentinel tokens)"
```

---

### Task 2: `GridBackground` + `EyeOrb` (motion primitives)

**Files (create):** `apps/web/src/components/GridBackground.tsx`, `apps/web/src/components/EyeOrb.tsx`.

- [ ] **Step 1: `GridBackground.tsx`** — fixed, subtle animated grid + radial glow (client component).

```tsx
'use client';
export function GridBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(99,102,241,.25) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,.25) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(120% 80% at 50% 0%, #000 30%, transparent 75%)',
        }} />
      <div className="absolute left-1/2 top-[-20%] h-[60vh] w-[60vh] -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(34,211,238,.18), transparent 60%)' }} />
    </div>
  );
}
```

- [ ] **Step 2: `EyeOrb.tsx`** — the glowing, breathing eye (motion).

```tsx
'use client';
import { motion } from 'motion/react';

export function EyeOrb({ size = 120 }: { size?: number }) {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: [1, 1.06, 1], opacity: 1 }}
      transition={{ scale: { duration: 4, repeat: Infinity, ease: 'easeInOut' }, opacity: { duration: 0.8 } }}
      style={{
        width: size, height: size, borderRadius: '50%',
        background: 'radial-gradient(circle at 50% 50%, #22d3ee 0%, #6366f1 45%, #0b1020 78%)',
        boxShadow: '0 0 60px 8px rgba(56,189,248,.45)',
      }}
    />
  );
}
```

- [ ] **Step 3: Typecheck** — `pnpm --filter @argus/web typecheck` → PASS.
- [ ] **Step 4: Commit** — `git add apps/web/src/components && git commit -m "web: GridBackground + EyeOrb motion primitives"`.

---

### Task 3: `Hero`

**Files:** Create `apps/web/src/components/Hero.tsx`; modify `src/app/page.tsx` to render `<GridBackground/><Hero/>`.

- [ ] **Step 1: `Hero.tsx`** — orb + wordmark + tagline + hero video (`/argus-loop.mp4`, falls back gracefully until rendered) + CTAs. Client component; entrance via `motion` `initial/animate`.

```tsx
'use client';
import { motion } from 'motion/react';
import { EyeOrb } from './EyeOrb';

const fade = (d: number) => ({
  initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay: d, ease: 'easeOut' as const },
});

export function Hero() {
  return (
    <section className="relative mx-auto flex max-w-5xl flex-col items-center px-6 pt-28 pb-20 text-center">
      <motion.div {...fade(0)}><EyeOrb /></motion.div>
      <motion.h1 {...fade(0.1)} className="mt-8 text-6xl font-bold tracking-tight gradient-text">ARGUS</motion.h1>
      <motion.p {...fade(0.2)} className="mt-4 max-w-xl text-lg text-[var(--color-muted)]">
        The agent that writes, gates &amp; self-heals your Playwright tests.
      </motion.p>
      <motion.div {...fade(0.3)} className="mt-8 flex gap-4">
        <a href="https://github.com/piyushpathakqa/argus" className="rounded-lg bg-white px-5 py-2.5 font-semibold text-black">View on GitHub ▸</a>
        <a href="#loop" className="glass rounded-lg px-5 py-2.5 font-semibold">See the loop</a>
      </motion.div>
      <motion.div {...fade(0.45)} className="glass mt-14 w-full overflow-hidden rounded-xl">
        <video className="w-full" autoPlay muted loop playsInline poster="/argus-loop-poster.png">
          <source src="/argus-loop.mp4" type="video/mp4" />
        </video>
      </motion.div>
    </section>
  );
}
```

- [ ] **Step 2: `page.tsx`** renders `<GridBackground/><Hero/>` (drop the placeholder `<h1>`).
- [ ] **Step 3: Build + dev-visual** — `pnpm --filter @argus/web build`; `pnpm --filter @argus/web dev` → confirm hero on :3200 (video area shows the glass box until the MP4 lands in Task 8).
- [ ] **Step 4: Commit** — `git add apps/web/src && git commit -m "web: Hero (orb + wordmark + video slot + CTAs)"`.

---

### Task 4: `LoopSection`

**Files:** Create `apps/web/src/components/LoopSection.tsx`; add to `page.tsx`.

- [ ] **Step 1: `LoopSection.tsx`** — four stage cards (Generate→Gate→Triage→Heal) that reveal on scroll with stagger (`whileInView`).

```tsx
'use client';
import { motion } from 'motion/react';

const STAGES = [
  { k: 'Generate', d: 'Point it at a URL → it explores the app and writes a runnable Playwright spec.' },
  { k: 'Gate', d: 'The spec runs in CI as a required check — failing tests block the deploy.' },
  { k: 'Triage', d: 'On failure it classifies the cause: real bug vs DOM drift vs flake.' },
  { k: 'Heal', d: 'For drift it rewrites the locator, verifies green, and opens a PR — never masking real bugs.' },
];

export function LoopSection() {
  return (
    <section id="loop" className="mx-auto max-w-5xl px-6 py-24">
      <h2 className="text-center text-3xl font-bold">One loop, four behaviours</h2>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAGES.map((s, i) => (
          <motion.div key={s.k} className="glass rounded-xl p-5"
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.5, delay: i * 0.12 }}>
            <div className="text-sm font-mono text-[var(--color-cyan)]">0{i + 1}</div>
            <h3 className="mt-2 text-xl font-semibold">{s.k}</h3>
            <p className="mt-2 text-sm text-[var(--color-muted)]">{s.d}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: page.tsx** adds `<LoopSection/>`. **Step 3:** build green. **Step 4:** commit `web: LoopSection`.

---

### Task 5: `ArchSection`

**Files:** Create `apps/web/src/components/ArchSection.tsx`; add to `page.tsx`.

- [ ] **Step 1:** "one core, two consumers" — a `core` node with two edges drawing to `CLI` and `MCP` nodes. SVG paths animated via `motion` `pathLength` on `whileInView`; nodes as glass boxes.

```tsx
'use client';
import { motion } from 'motion/react';

export function ArchSection() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-24 text-center">
      <h2 className="text-3xl font-bold">One core, two consumers</h2>
      <p className="mt-3 text-[var(--color-muted)]">Define the QA tools once in <code>@argus/core</code>; expose them as a CLI and an MCP server.</p>
      <div className="mt-12 flex flex-col items-center gap-6">
        <div className="glass rounded-xl px-6 py-4 font-mono">@argus/core <span className="text-[var(--color-muted)]">· agent loop + tool registry</span></div>
        <svg width="240" height="60" viewBox="0 0 240 60" aria-hidden>
          <motion.path d="M120 0 L40 60" stroke="#6366f1" strokeWidth="1.5" fill="none"
            initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 0.8 }} />
          <motion.path d="M120 0 L200 60" stroke="#a78bfa" strokeWidth="1.5" fill="none"
            initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.15 }} />
        </svg>
        <div className="flex gap-6">
          <div className="glass rounded-xl px-6 py-4 font-mono">@argus/cli <span className="text-[var(--color-muted)]">· CI</span></div>
          <div className="glass rounded-xl px-6 py-4 font-mono">@argus/mcp <span className="text-[var(--color-muted)]">· Claude</span></div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2:** page.tsx adds `<ArchSection/>`. **Step 3:** build green. **Step 4:** commit `web: ArchSection (animated diagram)`.

---

### Task 6: `Advantages`, `Provenance`, `Footer`

**Files:** Create `Advantages.tsx`, `Provenance.tsx`, `Footer.tsx`; add to `page.tsx`.

- [ ] **Step 1: `Advantages.tsx`** — value grid (`whileInView` + hover lift). Items:
  `AI writes real tests` · `Failing tests block deploy` · `Self-healing PRs (never hides bugs)` ·
  `Signed Treeship provenance receipts` · `Drive the tools from Claude (MCP)` · `One core, two consumers`.
  Each a glass card with a short blurb; `whileHover={{ y: -4 }}`.

- [ ] **Step 2: `Provenance.tsx`** — full-width band: headline *"Self-healing QA you can audit."*, copy on signed Treeship receipts, and a stylized mono receipt snippet (`✓ verified · 21 artifacts · chain intact`).

- [ ] **Step 3: `Footer.tsx`** — quickstart (`git clone … && pnpm build`) in a mono block, links: GitHub, `docs/DEMO.md`, `docs/MCP.md`, MIT/Piyush Pathak.

- [ ] **Step 4:** page.tsx composes all sections in order. **Step 5:** `pnpm --filter @argus/web build` + dev-visual on :3200. **Step 6:** commit `web: Advantages + Provenance + Footer; compose page`.

---

### Task 7: Full workspace verification (no MP4 yet)

- [ ] **Step 1:** `pnpm lint && pnpm typecheck && pnpm build` from root.
  Expected: all green; `apps/web` joins the recursive build. If ESLint flags `apps/web` (it lints `.tsx`), fix inline; `.next` is already ignored.
- [ ] **Step 2: Commit** any fixes — `git commit -m "web: workspace lint/typecheck/build green"`.

---

### Task 8: Remotion hero video → `public/argus-loop.mp4`

**Files (create):** `apps/web/remotion/Root.tsx`, `apps/web/remotion/ArgusLoop.tsx`, `apps/web/remotion/index.ts`; produce `apps/web/public/argus-loop.mp4` (+ a poster PNG).

- [ ] **Step 1: `ArgusLoop.tsx`** — an ~18s (540-frame @30fps) 1920×1080 composition cycling the four stages in the Sentinel palette using Remotion's `useCurrentFrame`/`interpolate`/`spring`, `Sequence` per stage (a spec typing in, a gate flipping red→green, a triage verdict stamp, a heal PR card). Sentinel colors; the eye orb as a recurring motif.

- [ ] **Step 2: `Root.tsx`** registers it:

```tsx
import { Composition } from 'remotion';
import { ArgusLoop } from './ArgusLoop';
export const RemotionRoot = () => (
  <Composition id="ArgusLoop" component={ArgusLoop} durationInFrames={540} fps={30} width={1920} height={1080} />
);
```
```ts
// index.ts
import { registerRoot } from 'remotion';
import { RemotionRoot } from './Root';
registerRoot(RemotionRoot);
```

- [ ] **Step 3: Render the MP4**

Run: `pnpm --filter @argus/web exec remotion render remotion/index.ts ArgusLoop public/argus-loop.mp4 --codec=h264`
Expected: a `public/argus-loop.mp4` (~1–3 MB). Also export a poster: `… still remotion/index.ts ArgusLoop public/argus-loop-poster.png --frame=120`.
(Remotion downloads its own headless Chrome on first run; if rendering is unavailable in this env, note it and ship a CSS/motion-only hero fallback in `Hero.tsx`, leaving the composition committed to render later.)

- [ ] **Step 4:** confirm the hero `<video>` plays the MP4 on :3200. **Step 5:** build green (`next build` just serves the static MP4).
- [ ] **Step 6: Commit** — `git add apps/web/remotion apps/web/public/argus-loop.mp4 apps/web/public/argus-loop-poster.png && git commit -m "web: Remotion hero loop video (pre-rendered, committed)"`.

---

### Task 9: Deploy config + docs + final verification

**Files:** Create `apps/web/vercel.json`; modify `README.md` (link the live site placeholder) + `docs/STATUS.md` (note apps/web).

- [ ] **Step 1: `apps/web/vercel.json`** (explicit, so a Vercel project rooted at `apps/web` builds in the monorepo):

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "next build",
  "installCommand": "pnpm install --frozen-lockfile",
  "outputDirectory": ".next"
}
```

- [ ] **Step 2: docs** — add a short "Landing page" note to `docs/STATUS.md` (location `apps/web`, `pnpm --filter @argus/web dev`, deploy = Vercel project with Root Directory `apps/web`); add a README line. Document the one-time user step: `cd apps/web && vercel link` (or set Root Directory in the Vercel dashboard) then `vercel --prod`.
- [ ] **Step 3: Full suite** — `pnpm lint && pnpm typecheck && pnpm test && pnpm build` → green.
- [ ] **Step 4: Commit** — `git add apps/web/vercel.json README.md docs/STATUS.md && git commit -m "web: Vercel deploy config + docs"`.
- [ ] **Step 5:** push `main`; confirm CI green. Deploy itself is user-run (`vercel login` is interactive).

---

## Self-Review notes (author)

- **Spec coverage:** scaffold+Tailwind (T1) · Sentinel tokens/orb/grid (T1–T2) · Hero+video slot (T3) · loop (T4) · architecture (T5) · advantages+provenance+footer (T6) · workspace gate (T7) · Remotion MP4 (T8) · deploy+docs (T9). All spec sections mapped.
- **Versions pinned** to verified-current values; Next 15 chosen to match sample-shop's proven CI build.
- **Soft spots flagged, with fallbacks:** Tailwind v4 PostCSS setup is verified in Step-1 build; the Remotion render needs a headless browser — T8 Step 3 has a CSS/motion-only fallback if rendering isn't possible in this environment (composition still committed). `next/font/google` fetches at build (CI/Vercel have network).
- **Frontend reality:** exact Tailwind classes/spacing are refined live on :3200; the code blocks are the working first pass, not pixel-final.

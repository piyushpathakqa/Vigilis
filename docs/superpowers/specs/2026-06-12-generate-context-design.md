# Generate Prompt & DOM Context — Design Spec (TRE-34)

> Status: approved 2026-06-12 (completion sweep). Implements milestone **M1 / `TRE-34`** — closes M1.
> Refines the Generate behavior (`TRE-33`) and the browser snapshot (`TRE-32`).

## 1. Goal

Make the agent write better specs for less cost by improving the two things TRE-33 left as v1:
its **DOM context** (the `browser_snapshot` tool returns raw, truncated HTML — scripts/styles
dominate the tokens) and its **system prompt** (steers toward flaky patterns like URL-regex waits).

## 2. Two changes

### A. Cleaned DOM snapshot — `trimHtml` (pure)
`browser_snapshot` currently returns `page.content()` truncated to 20 000 chars. For a Next.js
page that is mostly inline hydration `<script>` and `<style>` — noise that costs tokens and buries
the structure the agent needs. Add a pure helper:

```ts
export function trimHtml(html: string, limit = 12000): string;
```
Strips HTML comments, `<script>…</script>`, `<style>…</style>`, and `<link …>` tags, collapses
runs of whitespace to single spaces, and caps at `limit`. Keeps the `<title>`, body markup,
`data-testid`s, text, and form structure — the locator-relevant signal. `PlaywrightBrowserSession.
snapshot()` returns `trimHtml(await page.content())`.

### B. Tighter `GENERATE_SYSTEM`
Replace the v1 prompt guidance with explicit anti-flake rules:
- Prefer **web-first assertions** (`expect(locator).toBeVisible()`, `toHaveText`) that auto-wait;
  **never** use `page.waitForTimeout` or arbitrary sleeps.
- To assert a successful login, **wait for an element that only exists after login** (e.g. a
  post-login `data-testid` such as the cart/nav), **not** a URL regex.
- Write **one focused, deterministic test** for the primary flow; use `getByTestId(...)`.
- Keep exploration bounded (cost).

## 3. Testing (Vitest)

- **`trimHtml`** (pure): strips a `<script>` body, a `<style>` body, and `<!-- comments -->`;
  collapses whitespace; preserves a `data-testid` element and the `<title>` text; caps at `limit`.
- **session snapshot** (chromium integration, existing file): `setContent` with a `<script>` →
  `snapshot()` excludes the script content but includes a `data-testid`.

The prompt change is verified by re-running `argus generate … --run` manually (specs are
LLM output; not unit-asserted). No new behavior tests.

## 4. Non-goals

- Accessibility-tree snapshots / per-attribute filtering (a parser-based snapshot) — future.
- Author/Triage/Heal (M3); MCP (M4).

## 5. Tasks (TDD)

1. `trimHtml` pure helper in `packages/core/src/runtime/html.ts` + tests; export from runtime barrel.
2. `PlaywrightBrowserSession.snapshot()` uses `trimHtml`; extend the session test (script stripped).
3. Tighten `GENERATE_SYSTEM` in `behaviors/generate.ts`.
4. Full verify (`pnpm lint && typecheck && test && build`) + docs (mark TRE-34 done, M1 complete).

## 6. Done when

- `trimHtml` is exported and unit-tested; `snapshot()` returns cleaned HTML.
- `GENERATE_SYSTEM` carries the anti-flake guidance.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` is green. M1 closed.

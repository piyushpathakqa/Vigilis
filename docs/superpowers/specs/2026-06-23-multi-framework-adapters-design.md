# Multi-Framework Adapters — Design

**Date:** 2026-06-23
**Status:** Approved (brainstorm) — pending spec review, then implementation plans per sub-project.

## Goal

Make Vigilis framework-aware instead of Playwright-hardcoded. The agent recognises which
end-to-end test framework a repo uses and runs its full loop — **generate, gate, triage, heal** —
against that framework. v1 targets three: **Playwright, Cypress, Selenium**.

This is a *product* honesty move as much as a feature: we only claim multi-framework support on the
site **after** the adapters are built (same discipline as the Treeship "don't claim what isn't built"
constraint). Until then the site stays Playwright-first.

## Positioning constraint (do not violate)

- No "works with Cypress / Selenium" copy on vigilis.dev until the corresponding adapter ships and is
  tested end-to-end against `apps/sample-shop`.
- Site/copy changes are the **last** step, gated on sub-projects 2 and 3 landing.

## Decisions (locked)

| Decision | Choice | Why |
|---|---|---|
| Selenium binding | **JS/TS `selenium-webdriver`** | One language (Node/TS) across all three adapters; simplest to build/test/heal. Python/Java are future follow-ons. |
| Selenium harness | **Mocha** | De-facto pairing with `selenium-webdriver`; JSON reporter parses into `TestRunResult` the same way Playwright JSON does. Swappable for `node:test` later. |
| v1 scope | **Full parity**: generate + gate + triage + heal for all three | User decision. Each framework is a first-class citizen, not a stub. |
| Abstraction | **`FrameworkAdapter` carried on `ToolContext`** (Approach A) | Mirrors the existing `ctx.runner` seam; smallest blast radius; same adapter seam the roadmap wants for mobile/CTV. |

Rejected: prompt-templates-only (framework `if`s leak across behaviors, boundary rots); dynamic
plugin registry (over-built for three in-tree frameworks — YAGNI).

## Architecture

### The seam that already exists

`TestRunner` (`packages/core/src/tools/types.ts`) — `.run(specPath) → TestRunResult { passed, failed,
summary, artifactsDir }` — is already an interface. `PlaywrightTestRunner` implements it, and `heal`
calls `ctx.runner.run(specPath)` for independent verification. Cypress/Selenium runners drop in here.

### What actually couples to Playwright today

1. **Prompts.** `generate` and `heal` system prompts hardcode Playwright idioms (`@playwright/test`,
   `getByTestId`, web-first assertions, `playwright_run`).
2. **The `playwright_run` tool.**
3. Nothing in the **attestation core** — it only records tool calls + decisions. It must stay that way.

### Key insight: exploration is orthogonal to the target framework

The agent explores the live app over **one Playwright/CDP browser session** (testids are
framework-independent). Only **authoring, running, and healing** vary per adapter. This bounds scope:
we are not building three browser-exploration stacks.

### `FrameworkAdapter` interface

```ts
export type Framework = 'playwright' | 'cypress' | 'selenium';

export interface RunnerOpts {
  cwd: string;
  exec?: Exec;
  artifactsDir?: string;
}

export interface FrameworkAdapter {
  readonly name: Framework;

  // Note: detection is centralised in `detect.ts` (detectFramework/pickFramework),
  // not a method on the adapter — adapters do not self-detect.

  /** Map a URL to the spec file path this framework expects (extension + dir conventions). */
  specPathForUrl(url: string, outDir?: string): string;

  /** Framework-specific fragment injected into the generate system prompt
   *  (imports, locator idioms, assertion style, how to run). */
  generateGuidance(): string;

  /** Framework-specific fragment for the heal system prompt (how to rewrite a stale locator). */
  healGuidance(specPath: string, selector: string): string;

  /** Build the TestRunner that runs this framework's CLI and parses → TestRunResult. */
  createRunner(opts: RunnerOpts): TestRunner;
}
```

### Generic `test_run` tool

The `playwright_run` tool generalises to a single **`test_run`** tool that delegates to
`ctx.adapter.createRunner(...).run(specPath)`. The tool registry stays stable; the attestation core
never learns a framework name. (`playwright_run` kept as a deprecated alias for one release to avoid
breaking existing MCP configs.)

### Detection

`detectFramework(cwd): Promise<{ framework: Framework; confidence: number }[]>`:
- **Deps** in `package.json`: `@playwright/test` → playwright; `cypress` → cypress;
  `selenium-webdriver` → selenium.
- **Config files**: `playwright.config.{ts,js,mjs}`; `cypress.config.{ts,js}` / `cypress.json`;
  (selenium has no canonical config — rely on dep + a `*.test.ts` import scan for `selenium-webdriver`).
- Highest confidence wins. `vigilis.config.json` gains `framework: "auto" | Framework` (default
  `"auto"`); `--framework` flag overrides everything. None detected → default `playwright` + warn.

## Sub-projects (each ships working software on its own)

### SP1 — Adapter abstraction + detection + Playwright-as-adapter *(keystone)*
- Add `FrameworkAdapter`, `Framework`, detection, the `test_run` tool, and `ctx.adapter`.
- Refactor the existing Playwright path into a `PlaywrightAdapter` implementing the interface.
- `generate`/`heal`/`triage` read framework specifics from `ctx.adapter` instead of hardcoded strings.
- **Acceptance:** zero behavior change — every existing test stays green; `vigilis generate/heal`
  against `sample-shop` behaves exactly as before; attestation core untouched.

### SP2 — Cypress adapter
- `CypressAdapter`: `.cy.ts` conventions, generate/heal guidance (Cypress commands, `cy.get`,
  `data-testid` locators, retry-ability), `CypressTestRunner` parsing Cypress's JSON/mochawesome output.
- A Cypress fixture project (or config) exercising `apps/sample-shop`.
- **Acceptance:** `vigilis generate --framework cypress` writes a runnable `.cy.ts`; `heal` rewrites a
  drifted Cypress locator and verifies green; triage classifies bug vs drift vs flake.

### SP3 — Selenium adapter
- `SeleniumAdapter`: `selenium-webdriver` + Mocha, `*.test.ts` conventions, generate/heal guidance
  (`driver.findElement(By.css('[data-testid=...]'))`, explicit waits), `SeleniumTestRunner` running
  Mocha with the JSON reporter and parsing → `TestRunResult`.
- **Acceptance:** same parity bar as SP2, for Selenium.

### SP4 — Surface + honesty upgrade (gated on SP2 + SP3)
- `vigilis.config.json` `framework` field + `--framework` flag wired through CLI and MCP.
- Site copy: Playwright → "works with Playwright, Cypress & Selenium" (now true); docs; README.
- LinkedIn/launch copy optionally refreshed.

## Guardrails preserved (non-negotiable)

- **Heal still never masks a real bug** — triage's dom-drift vs behavior-change decision and its
  independent post-heal re-run (`ctx.runner.run`) apply identically per framework. The decision +
  rationale still land in the attestation record.
- **Attestation core stays framework-agnostic** — it records tool calls/decisions; it must not import
  or branch on `Framework`. The `test_run` tool is the only thing that knows the active adapter.
- **Treeship stays optional** — unchanged; adapters don't touch the attestation backend.

## Risks / open notes

- **Selenium needs a running browser + driver** (chromedriver). The runner must surface a clear error
  when the driver/browser is missing (mirror the existing "chromium not installed" guidance).
- **Cypress JSON reporting** historically needs a reporter package (`mochawesome` or `cypress`'s
  built-in `--reporter json`) — confirm the cleanest parse path during SP2.
- **Triage DOM read** currently assumes the Playwright/CDP exploration browser; since exploration stays
  Playwright across all adapters, triage logic is largely unaffected — verify per framework in SP2/SP3.
- `playwright_run` → `test_run` rename: keep the alias one release; note in changelog.

## Sequencing

SP1 → (SP2 ∥ SP3 can overlap once SP1 lands) → SP4. Each sub-project gets its own implementation plan
via the writing-plans skill. SP1's plan comes first.

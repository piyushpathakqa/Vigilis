# vigilis

**The trust layer for autonomous testing.** An AI agent that writes, gates, triages, and
self-heals your Playwright, Cypress, and Selenium tests — and seals every run in a signed,
independently verifiable receipt. Self-healing is the wedge; **verifiable proof is the point.**

🌐 [vigilis.dev](https://vigilis.dev) · 💻 [GitHub](https://github.com/piyushpathakqa/Vigilis)

## Install

```bash
npm i -D vigilis        # in your Playwright, Cypress, or Selenium project
npx playwright install chromium   # one-time, if you haven't (needed for browser automation)
export ANTHROPIC_API_KEY=sk-...
```

> Needs a real Anthropic **API** key. Brings its own Playwright; uses your project's specs.

## Use

```bash
vigilis init                              # scaffold vigilis.config.json (baseUrl, testDir, model, framework)
vigilis generate https://your-app.com --run                        # explore → write + run a real spec (auto-detects framework)
vigilis generate https://your-app.com --framework cypress --run    # force Cypress output
vigilis triage  https://your-app.com --spec tests/login.spec.ts   # real-bug vs DOM drift vs flake
vigilis heal    https://your-app.com --spec tests/login.spec.ts   # heal drift → verify green → PR
vigilis attest-run report.json --commit $GITHUB_SHA --exit-code $?  # seal any test run into a receipt (no key needed)
vigilis verify  .vigilis/attestation/qa-run-<sha>.json              # re-walk the chain: intact or tampered
```

- **Generate** real specs from a URL — Playwright (most battle-tested), Cypress, or Selenium.
  Framework is **auto-detected** from your project; pass `--framework playwright|cypress|selenium` to force one.
- **Gate** them in CI — failing tests block the deploy.
- **Triage** failures: real bug vs DOM drift vs flake.
- **Heal** cosmetic drift (rewrite locator → re-verify green → open a PR) — and **refuse to heal a
  real bug**, so it never papers a regression into a false green.
- **Attest** any test run — `vigilis attest-run` hash-chains a Playwright JSON report's digest,
  the commit SHA, and the runner's exit code into a tamper-evident receipt. **Zero secrets, zero
  API calls** — it works in any CI job with no key configured.
- **Verify** a receipt offline — `vigilis verify <bundle>` re-walks the hash chain and tells you
  *intact* or *broken at record #N*. Anyone with the file can run it; no account, no network.

## Receipts

Every attested run produces a hash-chained bundle: each record embeds the hash of the previous
one, so editing or removing any step breaks every hash after it. Receipts prove the recorded
steps are **unaltered** — they are *verifiable* and *auditable*, not a correctness guarantee.

- **Default (zero-secret):** local bundles under `.vigilis/attestation/`, checked with
  `vigilis verify`. Works everywhere, including air-gapped CI.
- **Signed (optional):** when the [Treeship](https://www.treeship.dev) CLI is installed, every
  `heal` is additionally sealed into a signed receipt by an independent notary — verify with
  `treeship verify last`, or share the hosted URL. No hard dependency; `--no-receipt` to opt out.

`vigilis.config.json` supplies per-project defaults (`baseUrl`, `testDir`, `model`, `framework`); explicit
flags always override it.

## Drive it from Claude (MCP)

The same tools ship as an MCP server — generate/triage/heal straight from Claude Desktop/Code.
See the [docs](https://github.com/piyushpathakqa/Vigilis/blob/main/docs/MCP.md).

MIT © Piyush Pathak · provenance powered by [Treeship](https://www.treeship.dev), governed memory by ZMem — trust primitives from **Zerker Labs**

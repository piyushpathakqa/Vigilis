# Argus × Treeship — provenance for autonomous QA (TRE-46)

> **Optional, decoupled.** Argus has **no hard dependency** on Treeship: `@treeship/sdk` is an
> optional dependency, loaded dynamically, and everything degrades to a no-op if the `treeship`
> CLI isn't installed.

[Treeship](https://www.treeship.dev) is a local-first "trust layer": it produces **Ed25519-signed,
offline-verifiable receipts** of agent actions, with SHA-256-hashed inputs/outputs chained
tamper-evidently. Argus is an agent that **autonomously rewrites tests and opens PRs** — so the
natural question is *"can I trust what it did?"* Treeship answers it: a signed, independently
verifiable record of exactly what the heal agent ran and produced.

**The pitch in one line:** *self-healing QA you can audit.*

## `argus heal` produces a receipt by default

When the `treeship` CLI is installed, **every `argus heal` run is wrapped in a signed Treeship
session automatically** — no flag needed. The whole triage → heal flow is recorded: each tool call
(`heal.tool.fs_read`, `heal.tool.fs_write`, …) and each model decision (with token usage) is
attested as a chained leaf, and the session is sealed into a verifiable receipt.

```bash
# one-time
curl -fsSL treeship.dev/setup | sh
treeship init

# heal — a receipt is produced automatically
node --env-file=.env packages/cli/dist/index.js heal \
  http://localhost:3100/login --spec tests/generated/login.spec.ts
# … [argus] provenance receipt sealed — verify it with `treeship verify last`,
#    or publish a public, shareable receipt URL with `treeship session report`
```

View / verify / share the receipt:
```bash
treeship verify last            # ✓ signature valid  ✓ chain valid
treeship session report         # → public https://treeship.dev/receipt/<id> (after `treeship hub attach`)
```
> Prefer the hosted receipt (`treeship session report`) for sharing and demos — it renders
> server-side and needs no login. (The local `~/.treeship/sessions/*.treeship/preview.html`
> is a convenience file and can fail to render on some CLI versions.)

Opt out with `--no-receipt`. If the `treeship` CLI isn't installed, heal runs normally and simply
skips the receipt (a warning, no failure).

### How it works

`createTreeshipObserver({ label })` (`packages/core/src/agent/treeship-observer.ts`) dynamically
imports `@treeship/sdk` (an **optional** dependency), verifies the CLI with `Ship.checkCli()`, and
returns an `AgentObserver` that attests each tool call (`attest.action`) and model decision
(`attest.decision`) as a **chained** receipt — or `null` if the SDK/CLI is absent. Because loop
callbacks are synchronous and attestation is async (the SDK shells out to the CLI), it serializes
attestations and exposes `flush()`. The `argus heal` command opens a `treeship session` around the
run (`composeObservers(console, treeship)`), then seals it. `@treeship/sdk` is externalized in the
build (dynamically imported; it pulls a `.wasm` core).

## Wrapping other commands (zero-code)

Any Argus command can also be wrapped with the CLI directly, no code involved — useful for the CI
gate or generation:
```bash
treeship session start --name "argus gate"
treeship wrap -- pnpm exec playwright test
treeship wrap -- node packages/cli/dist/index.js generate <url> --run
treeship session close
```

## Why it's worth it (and the caveats)

- **Trust for autonomous changes** — a reviewer can verify the heal agent's claimed steps, not just
  read the PR text. Strengthens the self-heal (M3) and CI-gate (M2) stories.
- **Founder collaboration + a differentiated portfolio bullet** ("cryptographic agent-action
  provenance over a QA agent").
- **Caveats:** additive, not core; Treeship is niche; the live receipt needs the `treeship` CLI
  installed. Argus runs fully without it.

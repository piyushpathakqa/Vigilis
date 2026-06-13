# Argus × Treeship — provenance for autonomous QA (TRE-46)

> **Optional, experimental showcase.** Lives on the `feat/treeship-showcase` branch; Argus has **no
> dependency** on Treeship and runs fully without it.

[Treeship](https://www.treeship.dev) is a local-first "trust layer": it produces **Ed25519-signed,
offline-verifiable receipts** of agent actions, with SHA-256-hashed inputs/outputs chained
tamper-evidently. Argus is an agent that **autonomously rewrites tests and opens PRs** — so the
natural question is *"can I trust what it did?"* Treeship answers it: a signed, independently
verifiable record of exactly what the heal agent ran and produced.

**The pitch in one line:** *self-healing QA you can audit.*

## Tier 1 — zero-dependency (this branch)

Wrap the existing `argus` CLI with the `treeship` CLI. No Argus code changes.

```bash
# one-time
curl -fsSL treeship.dev/setup | sh
treeship init

# run a self-heal under a signed receipt (see scripts/heal-with-receipt.sh)
scripts/heal-with-receipt.sh http://localhost:3100/login tests/generated/login.spec.ts
```
The script opens a Treeship session, records the heal as a signed agent action
(`agent://argus`, `heal.dom-drift`), wraps the real `argus heal` (capturing its command, exit code,
and hashed I/O), then closes + reports the session. Verify or share:

```bash
treeship verify last        # ✓ signature valid  ✓ chain valid
treeship hub push last      # → https://treeship.dev/verify/<artifact-id>
```

You can wrap any Argus step the same way — e.g. the CI gate:
`treeship wrap -- pnpm exec playwright test`, or generation:
`treeship wrap -- node packages/cli/dist/index.js generate <url> --run`.

Receipts land in `.treeship/` (gitignored). Nothing here runs automatically — it's a user-run demo.

## Tier 2 — optional SDK observer (not built; design)

For per-step receipts (one per tool call / behavior handoff) without shelling out, the
`@treeship/sdk` would hook the **`AgentObserver`** seam already built into the loop
(`packages/core/src/agent/observer.ts`): a `TreeshipObserver implements AgentObserver` that emits a
receipt on `onToolCall`/`onToolResult`/`onLoopEnd`, activated only behind an env flag
(e.g. `TREESHIP_ENABLED=1`) via dynamic import — so core keeps zero hard dependency. Deferred
because the `@treeship/sdk` API isn't yet verified (their published docs are CLI-focused); confirm
the SDK surface against the repo before implementing.

## Why it's worth it (and the caveats)

- **Trust for autonomous changes** — a reviewer can verify the heal agent's claimed steps, not just
  read the PR text. Strengthens the self-heal (M3) and CI-gate (M2) stories.
- **Founder collaboration + a differentiated portfolio bullet** ("cryptographic agent-action
  provenance over a QA agent").
- **Caveats:** additive, not core; Treeship is niche; Tier 2's SDK API needs verification. Tier 1
  (above) is the low-risk path and already tells the whole story.

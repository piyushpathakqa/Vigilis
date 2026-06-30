# Vigilis — Sellable demo (governance cloud)

A 5-minute live demo of the **paid** layer: verifiable, governed proof of every
agent decision, across the org. The free OSS agent is the wedge; *this* is what
you charge for.

> Honesty note to keep in the pitch: attestation is **verifiable / auditable** —
> it records *what happened*, not whether the agent's judgment was correct. Never
> claim it "guarantees correctness."

## Setup (one time)

No GitHub creds needed — the cloud runs in local dev mode with a one-click "Dev
login". From the repo root:

```bash
rm -f apps/cloud/.data/cloud.db        # optional: start from a clean slate
pnpm --filter @argus/cloud dev         # serves http://localhost:3300
```

Open <http://localhost:3300>, click **Dev login**, then click **Reset demo data**
in the dashboard's demo control. That seeds the **Acme Inc** org with the story
below and puts it on the **Free** plan (at the upgrade wall).

To reset between runs: click **Reset demo data** again (idempotent).

## The story (what's seeded)

Acme Inc ships AI-written tests. Their agent made these decisions last sprint —
each one has a signed receipt in the cloud:

| Repo | Spec | Verdict | Outcome |
|---|---|---|---|
| acme/web | login.spec | **dom-drift** | healed (selector changed, safe) |
| acme/web | nav.spec | **flake** | quarantined (not healed) |
| acme/checkout | checkout-total.spec | **real-bug** | **refused** — total was wrong |
| acme/checkout | coupon.spec | **dom-drift** | healed |
| acme/mobile | onboarding.spec | **dom-drift** | healed |
| acme/mobile | paywall.spec | **real-bug** | **refused** — access control regressed |

Three repos, all three verdicts, two genuine bugs the agent **refused to hide**.

## Click path + what to say

**1. The audit trail (trust).**
On the dashboard, point at the verdict tags.
> "Every row is a signed receipt. The agent healed the cosmetic drifts — but
> here [open `checkout-total.spec`] it found the order total was wrong and
> **refused to heal**. It failed loudly instead of greening a real bug. That
> refusal is itself attested — you can audit *why* it made the call."

Open the `real-bug` receipt to show the rationale.

**2. The wall (why Free converts).**
> "Acme runs three repos. On Free they get one, 14 days of history, and no
> export." Point at the nudge ("protecting 3 repos; Free covers 1") and the
> locked **Export (Team)** link.

**3. The upgrade (the sellable moment).**
Click **team** in the demo control.
> "The moment Security or an auditor asks for the trail, they upgrade." The
> nudge clears (all 3 repos covered), **Export CSV / JSON** unlock, retention
> jumps to **365 days**. Click an export to show the compliance trail download.

Click **enterprise** to show **unlimited** retention + repos (SSO/RBAC tier).

**4. The anchor (close).**
> "Team is $149/mo — under 2% of one QA engineer's salary — for a gate on every
> PR that refuses to hide a real bug, and signs the proof." (See `docs/PRICING.md`.)

## Reset

Click **Reset demo data** (returns to Acme Inc / Free / the seeded receipts).
The control only appears in local dev (`devBypassEnabled()`); it never ships on a
real GitHub-auth deployment.

## Appendix — close the loop with the real agent (optional, advanced)

Instead of seeded receipts, generate a *live* one from the OSS agent against the
bundled `apps/sample-shop`:

1. In the dashboard, open **API keys** and create a key (copy the plaintext once).
2. Run the agent against sample-shop with the cloud reporter enabled:
   ```bash
   VIGILIS_CLOUD_URL=http://localhost:3300 VIGILIS_CLOUD_KEY=<your key> \
     # …run the agent/heal flow against apps/sample-shop (see AGENTS.md)…
   ```
3. Refresh the dashboard — the real run's receipt appears alongside the seeded
   story. This proves the ingest path end-to-end, not just the UI.

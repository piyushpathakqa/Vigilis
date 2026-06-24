# Vigilis — Pricing & Packaging

> **Status:** v0 strawman. Numbers are hypotheses to validate against real buyers (TRE-60) before locking the public pricing page (TRE-59). Tracks Linear epic **TRE-53**.

## Model: open-core + governance cloud

The **agent is free and open-source**; the **governance cloud** on top is paid.

- **Why free at the bottom:** healing/generating tests is commoditizing (Playwright-native agents, Claude Code do it). Charging for the wedge loses to free. The free agent is the adoption engine — keep it genuinely good, not crippled.
- **Why the cloud is defensible:** healing is commoditizing, but *provable, governed, compliant* autonomous test-fixing is not. The paid layer leans on the **Treeship (proof) + ZMem (memory)** primitives — the moat.
- **Boundary (non-negotiable):** the cloud is a **separate service** with its own DB/auth/Stripe. The MIT core gains only an *optional* cloud-reporter hook (no key = no-op). Paid logic never leaks into the OSS core.

## Tiers

| | **Free / OSS** | **Team** (self-serve, Stripe) | **Enterprise** (sales-led) |
|---|---|---|---|
| **Price** | $0 | **$149/mo** + **$25/extra repo** (5 incl.) | **from ~$24k/yr** |
| Run the agent (generate/triage/heal/refuse/gate), self-hosted, your keys | ✅ unlimited | ✅ | ✅ |
| Local receipts (Treeship) + local memory (ZMem) | ✅ | ✅ | ✅ |
| Hosted **audit dashboard** (org-wide heal/refusal trail) | taste: 1 repo, 14-day history | ✅ up to 5 repos, **1-yr retention** | ✅ unlimited, unlimited retention |
| Compliance export (CSV/JSON → PDF) | — | ✅ | ✅ + SOC2-style attestations |
| Shared team memory (ZMem cloud) + review console | — | ✅ | ✅ |
| Approval gates / policy | — | basic | ✅ RBAC + policy templates |
| SSO, private deploy, multi-tenant, SLA | — | email support | ✅ |

Annual billing = 2 months free. Keep to **three tiers** for the MVP — no middle tier yet.

## Metering

**Flat Team base + per-repo** (decided). Value tracks *gate coverage* (more protected repos = more receipts = more to audit). Reads cleanly to a buyer ("$ per protected repo") and doesn't under-price a small team gating many repos. Rejected: per-seat (audit isn't a per-head value), pure usage (unpredictable bill, more to build), flat per-org (weak value-capture at the top).

## The "vs a QA hire" anchor

- US QA engineer, fully loaded ≈ **$110k/yr** (~$9.2k/mo); offshore ≈ $30–60k/yr.
- **Team $149/mo ≈ 1.6%** of one QA hire — runs on every PR, never sleeps, signs its work.
- **Enterprise $24k/yr ≈ ~22%** of one US QA hire — continuous, auditable gating across the org.

> **The line:** *"For under 2% of a QA engineer's salary, a gate on every PR that refuses to hide a real bug — and signs the proof."*

## Conversion levers

- **Free → Team:** they hit the wall the moment they want org-wide history (>14 days), a 2nd protected repo, or an export for a review.
- **Team → Enterprise:** SSO + retention + SOC2 export the moment Security/Compliance gets involved.

## Grounding (comparables)

- Managed QA (QA Wolf, etc.): ~$30k–$100k+/yr (full-service). Vigilis is cheaper *and* self-serve at the bottom (open-core).
- Self-healing platforms (Mabl, Testim): enterprise ~$40k+/yr.
- Dev tools self-serve: $20–40/seat — we go per-repo, which lands higher per account without feeling per-head.
- The edge that justifies price: the **signed audit trail + fail-closed refusal contract** nobody else in the category sells.

## Open hypotheses to validate (TRE-60)

1. Is **$149 + $25/repo** within an eng lead's self-serve-expense ceiling (~$200–500/mo)?
2. Does **per-repo** feel fair, or do teams with many tiny repos balk? (fallback: generous included count.)
3. Enterprise floor — **$24k vs $36k** — does SOC2 export alone close deals?

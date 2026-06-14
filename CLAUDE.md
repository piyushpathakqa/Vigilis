# Argus — Product & Engineering Context

> Context for an AI coding agent (Claude Code) working in this repository.
> Companion to `AGENTS.md` (which covers implementation status, milestones, and repo layout).
> This file covers **product thesis, principles, and architecture constraints** — read both.

---

## 1. What Argus is

Argus is a **trust and provenance layer for autonomous testing** — not "another self-healing test tool."

The thesis: an agent rewrites tests autonomously, so the only question that matters is **"can I trust what it did?"** Argus answers that with verifiable, signed proof of every tool call and model decision. Self-healing is the *wedge* (it earns adoption); attestation is the *product* (it's the defensible value).

One-line positioning: **the trust layer for autonomous testing — works with the test healer you already have.**

---

## 2. Core principles that must hold in the code

1. **Attestation is the product; healing is the wedge.** Do not invest in healing as the differentiator — framework-native healers (e.g. Playwright agents) are commoditizing it. Invest in making every agent action *verifiable*.
2. **The attestation backend must be swappable.** Treeship is the current implementation but must sit behind an interface (e.g. `AttestationProvider`). Never hard-couple to it. A local/no-op provider must exist so the system runs and tests pass without Treeship. This is non-negotiable: a customer deployment must not break if Treeship is unavailable.
3. **Never mask a real bug.** This is enforced behavior, not a comment. The heal path must distinguish *dom-drift* (safe to heal) from *genuine behavior change* (must fail and surface). When triage is uncertain, fail loudly rather than heal. The triage decision and its rationale must be captured in the attestation record so it is auditable.
4. **Agent-agnostic.** Where possible, sit *on top of* execution/healing agents and attest their actions rather than reinventing the healer. The long-term target is attesting any engineering agent, not just Argus's own.
5. **Clean open-core boundary.** Keep the agent/healing/attestation-client core OSS-clean. The commercial layer (org policy/governance, audit reporting, dashboards, SSO, multi-tenant) is separate. The OSS core must not depend on the paid layer; the paid layer must not leak proprietary logic into the core.

---

## 3. How attestation works (implement/maintain correctly)

The mechanism, end to end:

1. **Hash each step.** Each meaningful step — tool call, model decision, action, result — is serialized into a record and hashed (cryptographic hash; one input change → completely different fingerprint, not reversible).
2. **Chain the records.** Each record embeds the hash of the *previous* record. This forms a hash chain: removing or editing any step breaks every hash after it, so tampering is detectable ("chain intact" = no breaks).
3. **Sign the session.** The completed chain is signed with a private key held by the attestation provider. Anyone with the matching public key can verify it; nobody can forge it without the private key.
4. **Independent notary.** The provider (Treeship) is a *separate* system from Argus. This independence is what makes the proof credible to third parties — Argus signing its own logs would be "marking its own homework."

Implementation notes:
- Records are **append-only**; never mutate a sealed session.
- Each record should capture: inputs, model/prompt version, the decision + rationale, the action taken, the result, and a timestamp.
- **Delegate key management and crypto to the provider.** Do not roll custom crypto or key handling inside Argus.
- A "session" is the full chain of artifacts for one run (e.g. "21 artifacts, chain intact, verified").

**Honesty constraint (important for code and any user-facing strings):** attestation proves *what happened* — integrity and provenance, that these exact steps ran in this order, unaltered. It does **not** prove the agent's judgment was correct. If the agent wrongly classifies a real bug as dom-drift, attestation faithfully records the wrong decision. Use the words **"verifiable"** and **"auditable."** Never claim attestation "guarantees correctness."

---

## 4. Coverage strategy (affects module structure)

- **Web (Playwright):** supported now. Primary surface.
- **Mobile:** roadmap (Appium-style execution path). Design the execution layer so a mobile driver can slot in without touching the attestation core.
- **CTV / streaming (Roku, Fire TV, Tizen, webOS, Apple TV, consoles):** a different execution stack (device farms, tools like Suitest/Appium, D-pad navigation, no DOM). Strategy is to **attest existing CTV test execution, not replace it.**

**Architectural implication:** keep a clean separation between (a) execution/healing *adapters* and (b) the *attestation core*. The attestation core must NOT assume Playwright or any specific execution engine — it must be able to wrap external, non-Playwright test runs.

---

## 5. Roadmap horizons (for prioritization)

- **H1 — widen the QA surface (adoption, not moat):** API/contract testing, flaky-test detection & quarantine, visual + accessibility checks, coverage-gap finder.
- **H2 — move up the SDLC (all attested):** dependency/framework-upgrade agent, PR-review agent, incident triage, spec→test→code traceability.
- **H3 — the trust runtime (the long-term target):** agent action ledger, policy/guardrail engine, compliance/audit reporting; generalize attestation to *any* engineering agent (Copilot, Cursor, Devin, in-house). Where reasonable, design the attestation core so it is not QA-specific.

---

## 6. Competitive context (so priorities reflect reality)

- **Playwright native agents** (free, Microsoft): commoditize healing. Integrate and attest; do not compete on healing.
- **Shiplight:** mature standalone self-healer (intent-cache-heal), web-only, closed. Out-trust, don't out-heal.
- **TestDino:** observability/analytics over test reliability — mutable dashboards, not cryptographic proof. Argus's edge is verifiable evidence.
- **Horizontal attestation (e.g. Prova):** general agent-attestation category. Argus's defensibility is QA-vertical depth + integration, not "owning attestation."

---

## 7. What to avoid

- Hard-coupling to Treeship.
- Any heal path that can silently green a real failure.
- Correctness guarantees in user-facing strings (use "verifiable"/"auditable").
- Custom crypto or key management inside Argus.
- Enterprise-layer logic leaking into the OSS core.

---

## 8. Glossary

- **Attestation:** verifiable, signed record of what an agent did.
- **Hash chain:** records linked by embedding each prior record's hash; tamper-evident.
- **Signature:** private-key stamp on the sealed session; verifiable with the public key.
- **Session / artifacts:** the full set of chained records for one run.
- **dom-drift vs behavior change:** a cosmetic/locator change safe to heal, vs a genuine functional regression that must surface as a failure.
- **Notary:** the independent attestation provider (Treeship) that signs sessions.

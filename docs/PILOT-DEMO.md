# Pilot Demo — "Auditable AI QA, powered by Argus"

> **Audience:** decision-makers at a QA services firm evaluating a pilot.
> **Goal:** prove the one-pager's three claims are *real, running, verifiable* software — and land one web pilot.
> **The arc:** healing is the *wedge* (free in tools now), the **signed receipt is the premium**, and **refusing to mask a real bug is the trust proof.** Everything else supports those three beats.
> Technical runbook (commands only) lives in [`DEMO.md`](./DEMO.md); this file is the *pitch* script.

---

## The one line to open and close with

> "Your clients are starting to ask why they should pay for QA the tool now does for free. The honest answer: they're not paying for the healing. They're paying for **proof** — that testing actually ran, ran correctly, and didn't quietly bury a real bug. That proof is what we sell. Let me show you it's real."

---

## Format (recommended: hybrid — lowest risk, highest impact)

A live LLM heal costs money, takes ~40s, and varies run-to-run — not what you want live in front of a client. So:

- **Pre-record** the two scenarios (A and B) as clean ~60s clips (or GIFs). Deterministic, no live risk.
- **Keep the receipt LIVE and clickable.** This is the money moment — "don't take my word for it, verify it yourself" only works if it's a real URL they (or their auditor) can open. It needs no auth and never expires.
- **2–3 framing slides** for problem → thesis → coverage/pilot. Everything else is screen.

Total runtime: **8–10 minutes**, then Q&A.

| Beat | Live or recorded | Asset |
|---|---|---|
| Framing | Slides | problem → "trust is the un-commoditizable part" |
| A — self-heal | Recorded clip | `sample-shop` drift → `argus heal` → green → PR |
| **Receipt** | **Live (clickable)** | <https://treeship.dev/receipt/ssn_b965f6f0a82f1294> (drift heal) |
| B — refuse real bug | Recorded clip | `sample-shop` real-bug → `argus heal` refuses → stays red · receipt <https://treeship.dev/receipt/ssn_3834e1bcc2651d7d> |
| Where it runs | Live or screenshot | GitHub QA Gate check (red→green) + MCP |
| Coverage + pilot ask | Slide | web now · mobile next · CTV = wrap existing |

---

## Pre-flight checklist (do this 30 min before)

- [ ] `pnpm install && pnpm build` clean.
- [ ] `npx playwright install chromium` done.
- [ ] `.env` has a working `ANTHROPIC_API_KEY` (only if running A/B live; not needed for recorded).
- [ ] Landing page loads: <https://argus-web-psi.vercel.app>.
- [ ] Receipt loads: <https://treeship.dev/receipt/ssn_b965f6f0a82f1294> (open it once to warm it).
- [ ] `treeship --version` works (for the live `verify` moment).
- [ ] Recorded clips for A and B are on disk and cued.
- [ ] Browser tabs pre-opened: landing page, receipt, GitHub Actions (a green + a red run).
- [ ] Terminal font bumped to ~18pt; window cleared.

---

## The script

### 0. Frame (slide, ~45s)

State the shift from the one-pager: AI is commoditizing automation + maintenance hours; the un-commoditizable part is **trust**. "A low-cost AI tool can heal a test. It cannot hand your client a tamper-evident report that proves what it did. That's the service we're adding to your firm."

### 1. Scenario A — self-healing (the wedge, ~2 min) — *recorded clip*

Narrate over the clip:
- "Here's a passing end-to-end test against a sample shop. Green."
- "A developer ships a UI tweak — renames a button's `data-testid`. Pure cosmetic drift. **Today this is a red build and an hour of an engineer's time** — multiplied across a suite, it's the single biggest cost in E2E."
- Test runs → **RED** (`getByTestId('login-submit')` not found).
- `argus heal …` runs → triages **`dom-drift`**, rewrites the locator to the new id, **re-runs and verifies green independently**, opens a PR.
- Land it: "That maintenance line item — the thing your clients are questioning — just went to near-zero. That's the wedge. But it's not what they pay a premium for."

> Commands (for the recording): see [`DEMO.md` §1](./DEMO.md). Use `--model claude-haiku-4-5`.

### 2. The receipt (the PREMIUM, ~2.5 min) — *LIVE, clickable*

This is the demo. Slow down here.

- Open the receipt URL live: <https://treeship.dev/receipt/ssn_b965f6f0a82f1294>
- Walk it out loud:
  - **Timeline** — every tool call and model decision the agent made, in order, timestamped (read the spec → checked the live DOM → wrote the fix → re-ran Playwright).
  - **The decision + rationale** — *why* it concluded "dom-drift," captured, not narrated after the fact.
  - **Side-effect ledger** — exactly which files it wrote, which URLs it hit.
  - **"Chain intact · verified"** — each step is hashed and chained to the one before it; change any step and every hash after it breaks. **Tamper-evident.**
  - **Signed by an independent notary (Treeship)** — "Argus signing its own logs would be marking its own homework. This is signed by a *separate* system, so the proof is credible to a third party."
- The killer move — hand them the keys:
  > "Don't take my word for any of this. **You** verify it." → run `treeship verify <session>` live (prints *"Verified. This receipt is authentic."*), or point out anyone with the public key can.
- Land it: "**This** is the client-facing deliverable. Faster cycles are nice. A report your client can hand to *their* auditor is a premium service tier."

**Honesty guardrail (say this — it builds credibility, doesn't cost you):** "To be precise: this proves *what happened* — that these exact steps ran, in this order, unaltered. It's **verifiable and auditable**. It does not claim the agent's judgment is infallible — which is exactly why the next part matters."

### 3. Scenario B — won't mask a real bug (the TRUST PROOF, ~2 min) — *recorded clip*

- "Here's the fear with anything self-healing: does it just paper over real failures to stay green? Watch what happens with an actual bug."
- Seed a genuine break (login rejects valid credentials). Test runs → **RED**.
- `argus heal …` runs → triages **`real-bug`** → **refuses to heal**, exits non-zero, **the gate stays red.**
- The receipt records the refusal *and the reason*.
- Land it: "It heals cosmetic drift. It **surfaces** real bugs — never hides them. And the audit trail proves which call it made and why. That combination — heal the noise, escalate the signal, prove both — is the trust you can charge for."

> Commands: see [`DEMO.md` §2](./DEMO.md).

### 4. Where it runs (~1 min) — *live or screenshot*

- GitHub **QA Gate**: Argus runs as a *required* check — failing tests block the deploy (show a green run and a red run).
- **MCP**: the same engine drives from Claude Desktop/Code — "your engineers can ask Claude to generate or heal a test in-editor."
- "Same core, two surfaces: CI and Claude."

### 5. Coverage + the pilot ask (~1 min) — *slide*

- Honest scope: **Web — now** (where the pilot starts). **Mobile — near-term.** **CTV/streaming — we wrap your existing test tooling in the audit layer rather than replace it.**
- The ask, straight from the one-pager:
  > "One web client. We handle integration end-to-end — near-zero lift on your side. Two metrics agreed up front: **maintenance hours saved**, and **the client's reaction to the auditable report.** If it doesn't deliver, nothing's lost. If it does, we formalize it as a service line across your book."

---

## Q&A — likely objections & answers

- **"Isn't self-healing free in Playwright now?"** → Yes — that's the point. Healing is the wedge, not the product. The receipt is the product, and no free tool produces a signed, third-party-verifiable audit trail.
- **"Could it heal a real bug into a false green?"** → That's Scenario B. By design it refuses; uncertain triage fails loudly. And the receipt proves which decision was made.
- **"Who signs it — can you forge it?"** → An independent provider (Treeship) holds the key; we don't. Verifiable with the public key, not forgeable without the private one.
- **"What if Treeship is down / we don't trust a third party?"** → The attestation backend is swappable behind an interface; the system runs (and tests pass) without it. The notary is a choice, not a hard dependency. *(Roadmap: TRE-47.)*
- **"Does this prove the test is correct?"** → No, and we don't claim that — it proves *what was done*, verifiably. Correctness of judgment is a separate (human-reviewable) concern; the audit trail is what makes that review possible.
- **"Regulated client — is this real evidence?"** → Tamper-evident, signed, timestamped, independently verifiable. That's the shape compliance teams accept.

---

## Asset links

- **Slide deck:** [`pitch/auditable-ai-qa.html`](./pitch/auditable-ai-qa.html) — open in a browser, **F** = fullscreen, **S** = speaker notes (talk track embedded), arrows to navigate. PDF handout: [`pitch/auditable-ai-qa.pdf`](./pitch/auditable-ai-qa.pdf). *Present from the HTML for best fidelity.*
- Landing page: <https://argus-web-psi.vercel.app>
- Live verified receipt (drift heal): <https://treeship.dev/receipt/ssn_b965f6f0a82f1294>
- Live verified receipt (real-bug refusal): <https://treeship.dev/receipt/ssn_3834e1bcc2651d7d>
- Repo: <https://github.com/piyushpathakqa/argus> · technical runbook: [`DEMO.md`](./DEMO.md) · MCP: [`MCP.md`](./MCP.md) · provenance: [`TREESHIP.md`](./TREESHIP.md)

## Still to produce (see "next steps")

- The two recorded clips (A and B) — fallbacks for the live runs.
- Optional: regenerate the drift receipt on a longer run so the activity **density chart** renders (needs ≥3 active 30s windows; the current Haiku run is ~40s / 2 windows).

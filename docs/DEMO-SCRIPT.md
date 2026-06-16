# Argus — live demo run-of-show + transcript

> Read-while-you-present script. **[DO]** = what you do · **[SAY]** = say it roughly verbatim · **[SHOW]** = what's on screen.
> ~10 min. Timed against a real machine: red test ~12s · drift heal ~26s · real-bug refusal ~58s.
> Strategy/objections live in [`PILOT-DEMO.md`](./PILOT-DEMO.md); this is the talk track.

## Pre-flight (15 min before)
```bash
cd /Users/piyushpathak/Work/argus
pnpm build && npx playwright install chromium     # once
grep -q "ANTHROPIC_API_KEY=sk-" .env && echo "key ok"
treeship --version
```
- **Two terminals**, font ~18pt, cleared.
- **Tabs pre-open:** landing page · heal receipt (`…ssn_b965f6f0a82f1294`) · refusal receipt (`…ssn_3834e1bcc2651d7d`).
- Working tree clean: `git checkout tests/generated/login.spec.ts`.

---

## 0 · Open (~45s) — [SHOW] landing page
**[SAY]** "Quick context before I show you anything. AI can write code fast now — which means the bottleneck is shifting to testing and guardrails. The new tools self-heal tests automatically, which sounds great… until you ask the obvious question: if an agent rewrote my test to make it pass, how do I know it didn't just hide a real bug? That's what I built this to answer. Let me show you — live."

---

## 1 · Scenario A — drift heals (~2 min)
**[DO]** Terminal 1: `NEXT_PUBLIC_ARGUS_DEMO_DRIFT=1 pnpm --filter @argus/sample-shop dev`
**[SAY]** "This is a normal end-to-end test against a sample shop. Now a developer ships a UI tweak and renames a button's test-id — happens constantly. Watch what it does to the suite."

**[DO]** Terminal 2: `npx playwright test`  → **[SHOW]** red, 2 failed
**[SAY]** "There's the red — locator not found. Today this is a human's afternoon: find it, fix the selector, re-run. Instead —"

**[DO]** Terminal 2:
```bash
node --env-file=.env packages/cli/dist/index.js heal \
  http://localhost:3100/login --spec tests/generated/login.spec.ts \
  --model claude-haiku-4-5 --no-pr
```
**[SAY] (while it scrolls)** "— I point Argus at it. It's reading the spec, looking at the live DOM, working out what changed. And notice — it doesn't patch blindly. It triages first."

**[SHOW]** verdict: `dom-drift`
**[SAY]** "There — it classified this as DOM drift. Cosmetic. The button still works, the id just moved. So it rewrites the locator, re-runs the test itself to confirm it's genuinely green, and it's done. About 30 seconds, zero human time. That's the wedge — but it's not the point."

**[DO]** after: `git checkout tests/generated/login.spec.ts` (reset)

---

## 2 · The receipt (~2.5 min) — the money moment, slow down
**[SAY]** "Because that heal didn't happen in a black box. Every step was recorded into a signed receipt. Here's the real one."

**[DO]** open tab → `https://treeship.dev/receipt/ssn_b965f6f0a82f1294`
**[SAY]** "Live, public, no login. Every tool call and decision, in order. Here's the triage verdict and the exact reason it gave. The whole chain is hashed — change one step and every hash after it breaks, so tampering is obvious. And it's signed by an independent system — Treeship, built by Zerker Lab — not by Argus itself. An agent vouching for its own logs is marking its own homework. This is a separate notary. So you don't trust me —"

**[DO]** (optional) Terminal: `treeship verify ssn_b965f6f0a82f1294`  → "Verified. This receipt is authentic."
**[SAY]** "— you verify it. One honest line: this proves *what happened* — verifiably, auditably. It doesn't claim the agent's judgment is perfect. Which is exactly why this next part matters."

---

## 3 · Scenario B — refuses a real bug (~2 min)
**[DO]** Terminal 1: stop, restart with the bug seed:
```bash
NEXT_PUBLIC_ARGUS_DEMO_BUG=1 pnpm --filter @argus/sample-shop dev
```
**[SAY]** "Same setup — but now I've planted a real bug: login rejects valid credentials. The app is genuinely broken. The test goes red exactly like before. Watch what Argus does differently."

**[DO]** Terminal 2: same `heal …` command
**[SAY] (while it scrolls)** "It investigates the same way — reads the spec, drives the live page…"

**[SHOW]** verdict: `real-bug` → refuses, exit non-zero
**[SAY]** "There — real-bug, high confidence. Read the reasoning: credentials are rejected, the page never navigates, this isn't a locator problem, it's the app. So it refuses to heal. It will not touch the test. Exit non-zero, the gate stays red, the bug surfaces. And — same as before — the receipt records that it refused, and why."

**[DO]** open tab → `https://treeship.dev/receipt/ssn_3834e1bcc2651d7d`
**[SAY]** "That's the whole thing: it heals the noise, escalates the signal, and proves which call it made every single time."

---

## 4 · Where it runs (~1 min)
**[SAY]** "This runs as a required check in CI, so a failing test blocks the deploy — it's a real gate, not a report. And the same engine ships as an MCP server, so your team can drive it straight from Claude. Same core, two surfaces."

---

## 5 · Close + ask (~1 min)
**[SAY]** "So — self-healing is becoming free; every tool will have it. The part that isn't free is trust: proof you can hand to a client, or to their auditor. That's what Argus is."

**[SAY — pitch close]** "I'd love to run this on one of your web clients as a pilot. I handle the integration end-to-end — near-zero lift on your side. We agree two metrics up front: test-maintenance hours saved, and how your client reacts to the report. If it doesn't deliver, nothing's lost."

---

## Cheat sheet (tape to the side of your screen)
1. Terminal1 `…DEMO_DRIFT=1 … dev` → Terminal2 `npx playwright test` (red) → `heal … --no-pr` (dom-drift, green) → `git checkout tests/…`
2. Open heal receipt → optional `treeship verify ssn_b965f6f0a82f1294`
3. Terminal1 restart `…DEMO_BUG=1 … dev` → Terminal2 `heal …` (real-bug, refuses) → open refusal receipt
4. CI gate + MCP one-liner → close + pilot ask

## If a live run stalls
Don't wait. Say "this normally takes ~30 seconds — here's one I ran earlier" and cut to the receipt tab (it's the proof anyway). The only thing that *must* be live is opening a receipt. Reset with `git checkout tests/generated/login.spec.ts` between runs.

# LinkedIn launch post — "Introducing Vigilis"

> **For review (Revaz):** this is the **developer-facing launch/funnel post** — deliberately
> developer-first, with **no SOX/compliance messaging by design.** Per our hybrid strategy the
> funnel targets the developer *champion* (open-source adoption); the compliance/SOX angle is a
> *separate* surface aimed at the *buyer* (SOX/audit) and never mixed into this. The post now
> also plants the bigger go-big vision — testing is the wedge; the trust layer for *all*
> AI-written code is the direction.
>
> Ready to publish. **Attach ONE of** (video usually gets more reach):
> • Video: `apps/web/public/vigilis-refuse.mp4` (1080×1080, 19s, autoplays muted — the refusal story)
> • Image: `docs/vigilis-linkedin-card.png` (1200×1200 — heal vs refuse, branded)
> • Or the original `docs/vigilis-receipts-comparison.png`.
> Plain text (LinkedIn doesn't render markdown). Reply to every comment for the first ~48h.
> Consider putting the link in the first comment for reach.

---

Tell an AI coding agent to "make CI pass," and the cheapest path to green is deleting the test that caught the bug.

AI now writes and fixes tests on its own. Massive speed win — and a trust problem no dashboard solves:

When an agent turns a failing test green, did it fix the bug, or hide it?

At scale, nobody can hand-check every change. So the only question that matters becomes: can you trust what the agent did?

That's why I've been building Vigilis.

Healing broken tests is becoming a commodity — every coding agent can rewrite a stale locator. So the agent is free and open-source.

What's worth paying for is trust:

→ Cosmetic drift (a renamed button)? It heals it, quietly.
→ A real behavior change (checkout total drops from $49 to $0)? It REFUSES to touch the test, fails the build, and surfaces the bug — instead of burying it.
→ Every decision is signed into a tamper-evident receipt, stamped by an independent notary. Not Vigilis marking its own homework.

And when it refuses, the block lands where your team already works — a Slack alert and a Linear ticket, each linking the signed receipt. (Optional, off by default.)

The way I think about it:
Git is a ledger of your code.
Vigilis is a ledger of your agent's decisions — proof you can hand to an auditor who doesn't already trust you.

One honest note: it proves what the agent did — these exact steps, in order, unaltered. It does not claim the agent was always right. Verifiable and auditable, not "guaranteed correct." (That's the stronger promise anyway — it actually holds up.)

Testing is where this bites first — but as agents touch more of your code, "can I trust what the AI did?" becomes the question for all of it. A verifiable, signed record of every agent decision is what we're building toward.

MIT-licensed, runs in your CI on your own keys:
npm i -D vigilis

The provenance layer is powered by Treeship, built by @Zerker Lab — and the independence is the whole point: an agent signing its own logs is marking its own homework. Huge thanks to @Revaz. 🙏

If you ship AI-written code: when an agent changes your tests, how do you know it didn't just make the failure disappear?

→ vigilis.dev

#AITesting #DevTools #QA #OpenSource #AIagents #SoftwareEngineering

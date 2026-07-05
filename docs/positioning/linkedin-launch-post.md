# LinkedIn launch post — "Introducing Vigilis"

> Ready to publish. Attach `docs/vigilis-receipts-comparison.png`. Plain text (LinkedIn
> doesn't render markdown). Reply to every comment for the first ~48h. Consider putting
> the link in the first comment for reach. A shorter/personal-voice variant is easy to spin.

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

The way I think about it:
Git is a ledger of your code.
Vigilis is a ledger of your agent's decisions — proof you can hand to an auditor who doesn't already trust you.

One honest note: it proves what the agent did — these exact steps, in order, unaltered. It does not claim the agent was always right. Verifiable and auditable, not "guaranteed correct." (That's the stronger promise anyway — it actually holds up.)

MIT-licensed, runs in your CI on your own keys:
npm i -D vigilis

If you ship AI-written code: when an agent changes your tests, how do you know it didn't just make the failure disappear?

→ vigilis.dev

#AITesting #DevTools #QA #OpenSource #AIagents #SoftwareEngineering

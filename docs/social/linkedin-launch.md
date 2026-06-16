# Vigilis — launch-day LinkedIn post

The flagship announcement. Richer than the series teaser (post 5) — use this *as* post 5, or as a standalone launch-day post after the teasers have run.

**Posting notes**
- LinkedIn does not render Markdown — drop `**bold**` when pasting (or use CAPS/line breaks for emphasis).
- **Reach tip:** posts with outbound links sometimes get throttled. Consider putting the GitHub/site links in the **first comment** instead of the body, and saying "links in the comments 👇". Both versions below are written so they work either way.
- Attach a visual: the landing-page hero, a screenshot of a live receipt, or the Remotion MP4 of a failing test. Native video/images lift reach.
- Best post time: Tue–Thu morning.
- **Tags:** replace `@Zerker Lab` / `@Treeship` / `@Revaz` with the real LinkedIn company-page and profile handles so they actually notify. Tagging triggers founder amplification (Revaz offered + said he'd post his own endorsement).

> **➡️ Version C below is the recommended launch post** — it credits Treeship / Zerker Lab as the independent provenance layer and opens the product on-ramp. Use it over Versions A/B for launch night.

---

## Version A — flagship (narrative)

> Self-healing tests are about to be free. So I spent the last few weeks building the part that isn't.
>
> Today I'm open-sourcing **Vigilis** — the trust layer for autonomous testing.
>
> Here's the thing nobody's saying out loud: AI can already repair broken tests. Playwright, mabl, Testim — healing is becoming a checkbox feature. That's genuinely good; test maintenance was always the tax, never the value.
>
> But it creates a new problem. If an agent silently rewrites a test to make it pass, how do you know it fixed a stale locator — and didn't quietly paper over a real bug to turn the build green?
>
> Green is an outcome. Outcomes can be manufactured. What you actually want is proof.
>
> So that's what Vigilis does:
>
> ✅ Generates real Playwright tests from a URL
> ✅ Runs them in CI as a required gate — failing tests block the deploy
> ✅ Triages failures — real bug vs DOM drift vs flake
> ✅ Heals cosmetic drift, verifies green, opens a PR
> 🛑 Refuses to heal a real bug — it surfaces it, never papers over it
> 🔏 Seals every run in a signed, tamper-evident receipt, signed by an independent notary
>
> And you don't have to trust me. Here's a real, live receipt — public, no login, independently verifiable — from a run where it caught a real bug and *refused* to heal it:
> 👉 https://treeship.dev/receipt/ssn_3834e1bcc2651d7d
>
> It's open source. CLI + an MCP server, so you can drive the whole thing from Claude.
> 🌐 https://vigilis.dev
> 💻 https://github.com/piyushpathakqa/Vigilis
>
> One honest line: a receipt proves *what happened* — verifiable and auditable. It doesn't claim the agent is infallible. It makes its decisions reviewable instead of invisible. That's the whole point.
>
> Self-healing is becoming free. Trust is the part that isn't.
>
> If you run QA — or sell it — I'd genuinely love your take. 👇
>
> #QA #TestAutomation #SDET #AIinTesting #OpenSource #QualityEngineering #Playwright

---

## Version B — short (punchy)

> I open-sourced **Vigilis** today — the trust layer for autonomous testing.
>
> AI can already heal broken tests. The unanswered question: when an agent rewrites a test to go green, how do you know it didn't bury a real bug?
>
> Vigilis answers it. It self-heals cosmetic UI drift — but refuses to heal a real bug, and seals every run in a signed, independently verifiable receipt. Green you can actually prove.
>
> Don't trust me — verify a real one yourself:
> 👉 https://treeship.dev/receipt/ssn_3834e1bcc2651d7d
>
> Open source, CLI + MCP (drive it from Claude):
> 🌐 https://vigilis.dev
> 💻 https://github.com/piyushpathakqa/Vigilis
>
> Self-healing is becoming free. Trust is the part that isn't. Would love your take. 👇
>
> #QA #TestAutomation #SDET #AIinTesting #OpenSource

---

## Suggested first comment (if links go in comments)

> Links 👇
> • Try it / docs: https://vigilis.dev
> • Code (MIT, open source): https://github.com/piyushpathakqa/Vigilis
> • A live receipt where it *healed* drift: https://treeship.dev/receipt/ssn_b965f6f0a82f1294
> • A live receipt where it *refused* a real bug: https://treeship.dev/receipt/ssn_3834e1bcc2651d7d
> • Built with provenance from @Treeship.

*Data notes:* all links live and verified. Product claims (generate/gate/triage/heal/refuse/receipt, MCP + CLI, open source) are all true of the current build. The "self-healing is commoditizing" framing references real products (Playwright, mabl, Testim). Nothing fabricated.

---

## Version C — launch with Treeship / Zerker Lab (RECOMMENDED)

> AI is writing more of our code every day. Which quietly makes one thing the bottleneck: tests and guardrails — the part you can least afford to get wrong.
>
> So today I'm open-sourcing Vigilis — an AI agent that writes, gates, and self-heals your Playwright tests, and runs them 24/7.
>
> But the part I actually care about isn't the healing. When an agent rewrites your tests on its own, the real question isn't "did it pass?" — it's "can I trust what it did?"
>
> So every run Vigilis does is sealed in a signed, tamper-evident receipt — every tool call and decision, independently verifiable. It auto-heals cosmetic UI drift… but refuses to heal a real bug, and the receipt proves which call it made, and why.
>
> That trust layer is powered by Treeship, built by @Zerker Lab — an independent provenance system. And that independence is the whole point: an agent signing its own logs is marking its own homework. Treeship is the notary that makes the proof actually credible.
>
> Don't take my word for it — verify a real one yourself. Here's a run where Vigilis caught a real bug and refused to heal it:
> 👉 https://treeship.dev/receipt/ssn_3834e1bcc2651d7d
>
> Open source. CLI + an MCP server, so you can drive it from Claude.
> 🌐 https://vigilis.dev
> 💻 https://github.com/piyushpathakqa/Vigilis
>
> Playwright today — more frameworks next. If your team wants this running on your stack, let's talk.
>
> Huge thanks to @Revaz and the @Zerker Lab team. Self-healing is becoming free. Trust is the part that isn't.
>
> #QA #TestAutomation #SDET #AIinTesting #OpenSource #QualityEngineering #DevTools

### How to land the co-marketing (do this on launch night)
- **Tag** the real @Zerker Lab page, @Treeship, and @Revaz's profile so they're notified.
- **Revaz offered an endorsement** — let him drop it as a comment (best for reach: comments from a tagged founder boost the post), or paste his words as a pull-quote if he confirms the wording. His draft was roughly:
  > "Piyush is one of the best test-driven engineers I've worked with — he's turned that expertise into an agent that runs 24/7, powered by Zerker Lab + Treeship. As guardrails and test-centered engineering become the bottleneck, Vigilis has helped us move much faster."
  *(Use his final wording — don't post a quote he hasn't signed off on.)*
- **Product on-ramp:** the "if your team wants this on your stack, let's talk" line is the seed for the enterprise/multi-framework path Revaz floated (other orgs install Vigilis → packaged paid product). Keep it soft on launch day; follow up in DMs.

### First comment (links + credit)
> Links 👇
> • Try it / docs: https://vigilis.dev
> • Code (MIT): https://github.com/piyushpathakqa/Vigilis
> • A receipt where it healed drift: https://treeship.dev/receipt/ssn_b965f6f0a82f1294
> • A receipt where it refused a real bug: https://treeship.dev/receipt/ssn_3834e1bcc2651d7d
> • Provenance powered by Treeship, built by @Zerker Lab — thanks @Revaz 🙏

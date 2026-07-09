'use client';

import { useEffect } from 'react';

const MARKUP = `
<nav>
  <div class="nav-in">
    <a class="mark" data-view="home" href="#home"><span class="b">[</span>VIGILIS<span class="b">]</span></a>
    <div class="nav-r">
      <a class="lnk" data-view="home" href="#home">Home</a>
      <a class="lnk" data-view="how" href="#how">How it works</a>
      <a class="lnk" href="/use-cases">Use cases</a>
      <a class="lnk" href="https://github.com/piyushpathakqa/Vigilis">GitHub</a>
      <a class="nav-cta" href="#start">Get started</a>
    </div>
  </div>
</nav>

<header class="hero" id="top" data-view="home">
  <div class="wrap">
    <div class="badges">
      <span class="pill"><span class="dot"></span>Open source &middot; MIT</span>
      <span class="pill">Built by Piyush&nbsp;Pathak</span>
    </div>
    <h1>The QA gate for <span class="g">AI-written code.</span></h1>
    <p class="lede">Coding agents can make CI pass. <b>Vigilis makes sure it should.</b> Point it at the Playwright, Cypress, or Selenium suite you already have: it heals safe drift, blocks real regressions, and signs the proof.</p>
    <div class="cta-row">
      <div class="install">
        <code><span class="p">$</span> npm i -D vigilis</code>
        <button class="copy" data-copy="npm i -D vigilis" aria-label="Copy install command">COPY</button>
      </div>
      <a class="btn-gh" href="https://github.com/piyushpathakqa/Vigilis">&#9733; Star on GitHub</a>
    </div>
  </div>
  <div class="wrap">
    <div class="product">
      <div class="gate-panel surface framed" id="gatepanel">
        <i class="corner c-tl"></i><i class="corner c-tr"></i><i class="corner c-bl"></i><i class="corner c-br"></i>
        <div class="gp-bar">
          <span class="d"></span><span class="d"></span><span class="d"></span>
          <span class="t">qa-gate.run</span>
          <span class="live"><span class="pulse"></span>live</span>
        </div>
        <div class="gp-grid" id="gpgrid"></div>
        <div class="gp-foot">
          <span class="gp-stat" id="gpstat">scanning suite&hellip;</span>
          <span class="gp-deploy" id="gpdeploy">DEPLOY <i class="led"></i></span>
        </div>
      </div>
      <div class="float pr" aria-hidden="true">
        <span class="fl-lbl">Safe drift &middot; PR opened</span>
        <div class="fl-diff"><span class="del">- getByTestId('login-btn')</span><br><span class="add">+ getByTestId('signin-btn')</span></div>
      </div>
      <div class="float rcpt" aria-hidden="true">
        <span class="fl-lbl">Refusal receipt</span>
        <div class="fl-h">Spec untouched.<br>Deploy blocked.</div>
        <p class="fl-p">Expected <b>$49.00</b>, received <b>$0.00</b>. Behaviour changed, not selector drift.</p>
        <div class="fl-rid">ssn_8f31c0 &middot; offline verifiable</div>
      </div>
      <p class="hint">click any cell for its <b>run report</b></p>
    </div>
  </div>
</header>

<div class="trust" data-view="home">
  <div class="trust-in">
    <span>Works with</span>
    <span class="fw">Playwright</span><span class="s">/</span><span class="fw">Cypress</span><span class="s">/</span><span class="fw">Selenium</span>
    <span class="s">&middot;</span><span>runs in your CI</span><span class="s">&middot;</span><span>your own keys</span>
  </div>
</div>

<section class="blk" data-view="home">
  <div class="narrow">
    <div class="eyebrow reveal">The problem</div>
    <h2 class="big reveal">Tell any coding agent to make CI pass, and the cheapest path to green is deleting the test that caught the bug.</h2>
  </div>
  <div class="wrap">
    <div class="versus reveal">
      <div class="vp surface bad">
        <div class="vp-bar"><div class="who">A general coding agent</div><div class="obj">objective: make CI pass</div></div>
        <div class="vp-trace">
<div><span class="p">&gt;</span> "make the checkout test pass"</div>
<div><span class="p">&middot;</span> expected $49.00, got $0.00</div>
<div><span class="p">&middot;</span> rewrites assertion to expect <span class="danger">$0.00</span></div>
<div><span class="p">&middot;</span> CI turns <span class="green">green</span></div>
        </div>
        <div class="vp-out"><i class="ic"></i> the $0.00 checkout bug ships</div>
      </div>
      <div class="vp surface good">
        <div class="vp-bar"><div class="who">Vigilis</div><div class="obj">objective: tell the truth</div></div>
        <div class="vp-trace">
<div><span class="p">$</span> vigilis heal --spec checkout</div>
<div><span class="p">&middot;</span> triage: real regression, not drift</div>
<div><span class="p">&middot;</span> <span class="warn">refuses</span> to touch the spec</div>
<div><span class="p">&middot;</span> gate fails, <span class="warn">deploy blocked</span></div>
        </div>
        <div class="vp-out"><i class="ic"></i> bug caught, refusal sealed</div>
      </div>
    </div>
    <p class="say reveal">Vigilis is the one that refuses. And signs proof of the call.</p>
  </div>
</section>

<section class="blk" data-view="home" style="padding-top:0">
  <div class="narrow">
    <div class="eyebrow reveal">Watch it happen</div>
    <h2 class="big reveal">A real run refusing a real bug.</h2>
  </div>
  <div class="wrap">
    <div class="demo surface framed reveal" id="demo">
      <i class="corner c-tl"></i><i class="corner c-tr"></i><i class="corner c-bl"></i><i class="corner c-br"></i>
      <div class="demo-bar">
        <span class="d"></span><span class="d"></span><span class="d"></span>
        <span class="demo-t">vigilis heal &middot; checkout.spec.ts</span>
        <span class="demo-state" id="demo-state"></span>
        <button class="demo-replay" id="demo-replay" aria-label="Replay the run">&#8635; replay</button>
      </div>
      <div class="demo-body" id="demo-body"></div>
    </div>
  </div>
</section>

<section class="blk" data-view="home">
  <div class="narrow">
    <div class="eyebrow reveal">After the refusal</div>
    <h2 class="big reveal">The refusal goes where your team already works.</h2>
    <p class="say reveal">A real-bug refusal can page Slack and open a Linear ticket &mdash; each linking the signed receipt. Heals and flakes stay silent; only a held regression interrupts anyone.</p>
  </div>
  <div class="wrap">
    <div class="rcpair reveal">
      <div class="rc surface">
        <div class="rc-top"><span class="verdict v-refuse"><span class="ic"></span>Slack alert</span><span class="branch">#qa-alerts</span></div>
        <div class="rc-body">
          <div class="row"><span class="k">fires</span><span class="v">on a real-bug refusal only &mdash; never on heals or flakes</span></div>
          <div class="row"><span class="k">posts</span><span class="v">checkout-total.spec.ts &mdash; expected <span class="ok">$49.00</span>, got <span class="bug">$0.00</span></span></div>
          <div class="row"><span class="k">links</span><span class="v ok">signed receipt &middot; ssn_8f31c0</span></div>
        </div>
        <div class="seal"><span class="chk">&#10003;</span> suspected regression &middot; receipt attached &middot; offline verifiable</div>
      </div>
      <div class="rc surface r2">
        <div class="rc-top"><span class="verdict v-refuse"><span class="ic"></span>Linear ticket</span><span class="branch">auto-filed</span></div>
        <div class="rc-body">
          <div class="row"><span class="k">opens</span><span class="v">one issue for the held regression</span></div>
          <div class="row"><span class="k">links</span><span class="v ok">signed receipt in the issue body</span></div>
          <div class="row"><span class="k">dedup</span><span class="v">CI re-runs reuse the same ticket &mdash; no spam</span></div>
        </div>
        <div class="seal"><span class="chk">&#10003;</span> deduplicated &middot; receipt attached &middot; auditable</div>
      </div>
    </div>
    <div class="wrapband reveal"><b>Optional, off by default.</b> A no-op until you set <span style="color:var(--dim)">SLACK_WEBHOOK_URL</span> <span class="sep">/</span> <span style="color:var(--dim)">LINEAR_API_KEY</span> &mdash; nothing leaves your CI without your keys.</div>
    <p class="seal-note reveal">A refusal flags a <b style="color:var(--mist)">suspected</b> real regression, not a confirmed bug. The receipt is verifiable and auditable &mdash; it proves the agent refused and what it saw, not that the judgement was correct. Every alert and ticket links that signed receipt, so a human can verify before they act.</p>
  </div>
</section>

<section class="blk" data-view="home">
  <div class="narrow">
    <div class="eyebrow reveal">Vigilis vs. the rest</div>
    <h2 class="big reveal">Everyone else heals to <span class="dim">green</span>. Vigilis heals to <span class="green">true</span>.</h2>
  </div>
  <div class="wrap">
    <div class="cmp reveal">
      <div class="cmp-row">
        <div class="cmp-who">DIY coding agents<span class="ex">Claude Code, Codex, Cursor + Playwright MCP</span></div>
        <div class="cmp-what">Optimize for "make it pass." No refusal, no contract, no proof. They will rewrite the assertion that caught the bug.</div>
      </div>
      <div class="cmp-row">
        <div class="cmp-who">Self-healing platforms<span class="ex">Shiplight, QA Wolf, Autonoma, Mabl, Testim</span></div>
        <div class="cmp-what">Heal to make builds green, then report real bugs. Masking is mitigated by human review or confidence scores, soft controls on a system grading its own work.</div>
      </div>
      <div class="cmp-row win">
        <div class="cmp-who">Vigilis</div>
        <div class="cmp-what">Heals the suite you already have. Refuses real regressions as a hard, fail-closed contract. Signs every call into an independent, offline-verifiable receipt.</div>
      </div>
    </div>
  </div>
</section>

<section class="blk" data-view="home">
  <div class="narrow">
    <div class="eyebrow reveal">What a verdict looks like</div>
    <h2 class="big reveal">Two failures. Two very different receipts.</h2>
    <p class="say reveal">The same agent meets a cosmetic change and a real bug. It heals one, refuses the other &mdash; and signs proof of which.</p>
  </div>
  <div class="wrap">
    <div class="rcpair reveal">
      <div class="rc surface">
        <div class="rc-top"><span class="verdict v-heal"><span class="ic"></span>Healed &middot; safe drift</span><span class="branch">acme/web</span></div>
        <div class="rc-body">
          <div class="row"><span class="k">test</span><span class="v">login.spec.ts</span></div>
          <div class="row"><span class="k">cause</span><span class="v">button id renamed, same button, same label</span></div>
          <div class="row"><span class="k">change</span><span class="v"><div class="diff"><span class="del">- #login</span><br><span class="add">+ #signin</span></div></span></div>
          <div class="row"><span class="k">result</span><span class="v ok">re-ran &#8594; green, fix PR opened</span></div>
        </div>
        <div class="seal"><span class="chk">&#10003;</span> signed &middot; chain intact &middot; suite stays green</div>
      </div>
      <div class="rc surface r2">
        <div class="rc-top"><span class="verdict v-refuse"><span class="ic"></span>Refused &middot; real bug</span><span class="branch">acme/checkout</span></div>
        <div class="rc-body">
          <div class="row"><span class="k">test</span><span class="v">checkout-total.spec.ts</span></div>
          <div class="row"><span class="k">cause</span><span class="v bug">behaviour changed, not selector drift</span></div>
          <div class="row"><span class="k">assert</span><span class="v">expected <span class="ok">$49.00</span>, got <span class="bug">$0.00</span></span></div>
          <div class="row"><span class="k">result</span><span class="v bug">spec untouched, deploy blocked</span></div>
        </div>
        <div class="seal"><span class="chk">&#10003;</span> signed &middot; chain intact &middot; bug surfaced</div>
      </div>
    </div>
    <p class="punch reveal">A dashboard you can edit isn't evidence. Every verdict is sealed by an <b>independent notary</b> into a tamper-evident receipt &mdash; so &ldquo;the agent refused a real bug&rdquo; is something you can <b>prove to an auditor</b>, not just claim.</p>
    <p class="seal-note reveal">Why everyone shipping AI-written code needs this: the moment an agent can change code with no human watching, &ldquo;trust me&rdquo; stops being enough. You need a signed record of what it decided &mdash; from a notary that can't quietly rewrite it. <span style="color:var(--dim)">Verifiable and auditable: it proves what happened, not that the judgment was correct.</span></p>
  </div>
</section>

<section class="blk" id="start" data-view="home">
  <div class="wrap">
    <div class="band surface reveal">
      <h2>Stop shipping false green.</h2>
      <p>Drop Vigilis into the suite you already have.</p>
      <div class="qs">
        <div class="qs-bar">
          <span class="d"></span><span class="d"></span><span class="d"></span>
          <span class="t">quickstart</span>
          <button class="qs-copy" data-copy="npm i -D vigilis&#10;npx playwright install chromium&#10;vigilis init&#10;vigilis generate https://your-app.com --run" aria-label="Copy quickstart commands">COPY</button>
        </div>
        <div class="qs-body">
<div><span class="c">$</span> npm i -D vigilis</div>
<div><span class="c">$</span> npx playwright install chromium</div>
<div><span class="c">$</span> vigilis init</div>
<div><span class="c">$</span> vigilis generate https://your-app.com --run</div>
        </div>
      </div>
      <p class="reqs">Runs in your CI with your own Anthropic key and chromium. About 10&cent; per run on Haiku, Opus by default. <a href="https://github.com/piyushpathakqa/Vigilis">Read the docs &#9656;</a></p>
      <div class="cta-row">
        <a class="btn-gh" href="https://github.com/piyushpathakqa/Vigilis">&#9733; Star on GitHub</a>
      </div>
    </div>
  </div>
</section>

<section class="blk" id="how" data-view="how">
  <div class="narrow">
    <div class="eyebrow reveal">Receipts, not promises</div>
    <h2 class="big reveal">Same failure. Three verdicts. The agent picks, and proves which.</h2>
    <p class="say reveal">Any tool can turn a build green. The question is what it did with the failure: heal safe drift, park a flake, or refuse to bury a real bug.</p>
  </div>
  <div class="wrap">
    <div class="fork reveal">
      <div class="triage">
        <div class="lbl">Triage</div>
        <p>A spec just failed. <b>What kind of failure is it?</b> <span class="m">&nbsp;bug &middot; drift &middot; flake</span></p>
      </div>
      <div class="connector" aria-hidden="true"><i class="stem"></i><i class="bar"></i><i class="dl"></i><i class="dr"></i></div>
      <div class="receipts">
        <div class="rc surface">
          <div class="rc-top"><span class="verdict v-heal"><span class="ic"></span>Healed</span><span class="branch">if drift &#9656;</span></div>
          <div class="rc-body">
            <div class="row"><span class="k">cause</span><span class="v">locator stale, testid renamed</span></div>
            <div class="row"><span class="k">change</span><span class="v"><div class="diff"><span class="del">- getByTestId('login-btn')</span><br><span class="add">+ getByTestId('signin-btn')</span></div></span></div>
            <div class="row"><span class="k">verify</span><span class="v ok">re-ran &#8594; 3 passed</span></div>
            <div class="row"><span class="k">result</span><span class="v">fix PR opened for review</span></div>
          </div>
          <div class="seal"><span class="chk">&#10003;</span> observed by Vigilis &middot; sealed by Treeship</div>
        </div>
        <div class="rc surface r2">
          <div class="rc-top"><span class="verdict v-flake"><span class="ic"></span>Quarantined</span><span class="branch">if flake &#9656;</span></div>
          <div class="rc-body">
            <div class="row"><span class="k">cause</span><span class="v">timing / environment, not code</span></div>
            <div class="row"><span class="k">action</span><span class="v">flagged, not silently retried</span></div>
            <div class="row"><span class="k">result</span><span class="v">quarantined for review</span></div>
          </div>
          <div class="seal"><span class="chk">&#10003;</span> observed by Vigilis &middot; sealed by Treeship</div>
        </div>
        <div class="rc surface r3">
          <div class="rc-top"><span class="verdict v-refuse"><span class="ic"></span>Refused to heal</span><span class="branch">if real bug &#9656;</span></div>
          <div class="rc-body">
            <div class="row"><span class="k">cause</span><span class="v bug">behaviour changed, not drift</span></div>
            <div class="row"><span class="k">assert</span><span class="v">expected <span class="ok">$49.00</span>, got <span class="bug">$0.00</span></span></div>
            <div class="row"><span class="k">change</span><span class="v">none, spec untouched</span></div>
            <div class="row"><span class="k">result</span><span class="v bug">QA Gate failed, deploy blocked</span></div>
          </div>
          <div class="seal"><span class="chk">&#10003;</span> observed by Vigilis &middot; sealed by Treeship</div>
        </div>
      </div>
    </div>
    <p class="seal-note reveal">Every heal and every refusal becomes an offline-verifiable receipt when the <a href="https://www.treeship.dev">Treeship</a> CLI is present. No hard dependency, <span style="color:var(--dim)">--no-receipt</span> to opt out.</p>
  </div>
</section>

<section class="blk" data-view="how">
  <div class="narrow">
    <div class="eyebrow reveal">Why you can trust it</div>
    <h2 class="big reveal">Whoever writes the code can't be the one who clears it.</h2>
    <p class="say reveal">Three separate layers. No layer grades its own work. Open each to see the boundary it can't cross.</p>
  </div>
  <div class="wrap">
    <div class="powers reveal">
      <details class="layer actor">
        <summary>
          <span class="ly-role">Actor</span>
          <span class="ly-name">Whatever writes the code &amp; tests</span>
          <span class="ly-who">dev &middot; Claude Code &middot; Codex &middot; any agent</span>
          <span class="ly-chev">&#9662;</span>
        </summary>
        <div class="ly-detail">
          <div class="ly-col does"><span class="lbl">Does</span><p>Write code, specs, and fixes. Propose changes.</p></div>
          <div class="ly-col not"><span class="lbl">Never</span><p>Decide whether its own output is correct, or clear its own build.</p></div>
        </div>
      </details>
      <div class="custody"><span class="cust-line"></span><span class="cust-lbl">observed by &#9662;</span></div>
      <details class="layer observer" open>
        <summary>
          <span class="ly-role">Observer</span>
          <span class="ly-name">Vigilis verifies the behaviour</span>
          <span class="ly-who">runs &middot; triages &middot; heals safe drift &middot; refuses real bugs &middot; gates the deploy</span>
          <span class="ly-chev">&#9662;</span>
        </summary>
        <div class="ly-detail">
          <div class="ly-col does"><span class="lbl">Does</span><p>Judge the actor's output. Heal cosmetic drift, refuse real regressions, block the gate.</p></div>
          <div class="ly-col not"><span class="lbl">Never</span><p>Edit a spec to force a pass, or vouch for itself. Its verdict is handed on, not self-sealed.</p></div>
        </div>
      </details>
      <div class="custody"><span class="cust-line"></span><span class="cust-lbl">sealed by &#9662;</span></div>
      <details class="layer notary">
        <summary>
          <span class="ly-role">Notary</span>
          <span class="ly-name">Treeship signs the evidence</span>
          <span class="ly-who">independent, offline-verifiable receipt for every heal and refusal</span>
          <span class="ly-chev">&#9662;</span>
        </summary>
        <div class="ly-detail">
          <div class="ly-col does"><span class="lbl">Does</span><p>Seal what Vigilis decided into a tamper-evident receipt anyone can verify.</p></div>
          <div class="ly-col not"><span class="lbl">Never</span><p>Judge correctness or change a verdict. It proves what happened, nothing more.</p></div>
        </div>
      </details>
    </div>
    <p class="punch reveal" style="margin-top:34px">Three layers, and no layer grades its own work. <b>That separation is the guarantee, not a bigger model.</b></p>
  </div>
</section>

<section class="blk" data-view="how">
  <div class="narrow">
    <div class="eyebrow reveal">Under the hood</div>
    <h2 class="big reveal">One core. Four behaviors.</h2>
  </div>
  <div class="wrap">
    <div class="loop reveal">
      <div class="step"><div class="n">01</div><h3>Author <span style="font-family:var(--mono);font-weight:500;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint)">&middot; soon</span></h3><p>Plain-English intent in, a structured test plan out. <span style="color:var(--faint)">(on the roadmap)</span></p><div class="out">&#8594; *.plan.json</div></div>
      <div class="step"><div class="n">02</div><h3>Generate</h3><p>Explores the app from a URL and writes specs with real assertions.</p><div class="out">&#8594; tests/*.spec.ts</div></div>
      <div class="step"><div class="n">03</div><h3>Triage</h3><p>Classifies every failure: real bug, DOM drift, or flake.</p><div class="out">&#8594; root-cause report</div></div>
      <div class="step"><div class="n">04</div><h3>Heal</h3><p>Rewrites the locator, re-runs to verify green, opens a PR. Refuses real bugs.</p><div class="out">&#8594; pull request</div></div>
    </div>
    <div class="wrapband reveal"><b>Wrapped by CI:</b> the loop runs as a required <span class="green">QA Gate</span> check in GitHub Actions. <span class="sep">/</span> <b>Wrapped by Treeship + ZMem:</b> each heal and refusal is sealed into a signed receipt, and prior verdicts are recalled as governed memory.</div>
  </div>
</section>

<div class="cred">
  <div class="cred-in">
    Vigilis is built by <b>Piyush&nbsp;Pathak</b>. It consumes <b>Treeship</b> for independent attestation and <b>ZMem</b> for governed memory &mdash; external primitives Vigilis doesn't own or control. Because the notary that signs every verdict is independent, Vigilis can make a fail-closed, signed guarantee the rest of the category can't.
  </div>
</div>

<footer>
  <div class="wrap">
    <div class="foot-grid">
      <div class="mark"><span class="b">[</span>VIGILIS<span class="b">]</span></div>
      <div class="foot-links">
        <a href="/use-cases">Use cases</a>
        <a href="https://github.com/piyushpathakqa/Vigilis">GitHub</a>
        <a href="https://www.npmjs.com/package/vigilis">npm</a>
        <a href="https://github.com/piyushpathakqa/Vigilis/blob/main/docs/MCP.md">MCP</a>
        <a href="https://github.com/piyushpathakqa/Vigilis/blob/main/docs/TREESHIP.md">Receipts</a>
      </div>
    </div>
  </div>
</footer>

<div class="modal-backdrop" id="modal" aria-hidden="true">
  <div class="modal surface framed" role="dialog" aria-modal="true" aria-labelledby="m-spec">
    <i class="corner c-tl"></i><i class="corner c-tr"></i><i class="corner c-bl"></i><i class="corner c-br"></i>
    <div class="m-bar">
      <span class="m-verdict" id="m-verdict"><span class="ic"></span><span id="m-vtext"></span></span>
      <button class="m-close" id="m-close" aria-label="Close report">&#10005;</button>
    </div>
    <div class="m-spec" id="m-spec"></div>
    <div class="m-body" id="m-body"></div>
    <div class="m-seal" id="m-seal"></div>
  </div>
</div>
`;

type SpecState = 'pass' | 'heal' | 'bug';
interface Spec {
  name: string;
  state: SpecState;
  asserts: number;
  dur: string;
  diff?: [string, string];
  pr?: number;
}
interface DemoStep {
  k: string;
  t?: string;
  work?: number;
  state?: string;
}

const NAMES = [
  'auth/login', 'auth/logout', 'auth/reset', 'nav/header', 'nav/footer', 'search/query', 'search/filter',
  'catalog/list', 'catalog/detail', 'cart/add', 'cart/remove', 'cart/qty', 'checkout/address', 'checkout/ship',
  'checkout/total', 'checkout/pay', 'account/profile', 'account/orders', 'account/addr', 'settings/notif',
  'settings/privacy', 'a11y/contrast', 'a11y/keys', 'perf/lcp', 'i18n/locale', 'email/verify', 'api/health',
  'upload/file', 'webhook/retry', 'flags/toggle', 'session/expiry', 'export/csv',
];

const STEPS: DemoStep[] = [
  { k: 'cmd', t: 'vigilis heal --spec checkout.spec.ts' },
  { k: 'gap' },
  { k: 'dim', t: 'running   checkout/order-total.spec.ts', work: 1 },
  { k: 'red', t: '✗  assertion failed' },
  { k: 'pad', t: 'expected $49.00     received <span class="r">$0.00</span>' },
  { k: 'gap' },
  { k: 'dim', t: 'triage    comparing run against last green', work: 1 },
  { k: 'amber', t: '→  behaviour changed, not selector drift' },
  { k: 'gap' },
  { k: 'amberB', t: 'decision: REFUSE TO HEAL' },
  { k: 'dim', t: '·  spec left untouched' },
  { k: 'red', t: '·  QA Gate failed → deploy blocked', state: 'blocked' },
  { k: 'gap' },
  { k: 'dim', t: 'sealing   receipt', work: 1 },
  { k: 'green', t: '✓  sealed · ssn_8f31c0 · observed by Vigilis · sealed by Treeship' },
  { k: 'gap' },
  { k: 'greenDim', t: 'done in 3.2s · 0 assertions weakened' },
];

export function Redesign() {
  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    let gtimer: ReturnType<typeof setInterval> | undefined;
    let dTimer: ReturnType<typeof setTimeout> | undefined;

    // copy buttons
    document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((b) => {
      b.addEventListener('click', () => {
        if (navigator.clipboard) navigator.clipboard.writeText(b.dataset.copy ?? '');
        const o = b.textContent;
        b.textContent = 'COPIED';
        b.style.color = 'var(--signal)';
        setTimeout(() => {
          b.textContent = o;
          b.style.color = '';
        }, 1200);
      });
    });

    // reveal-on-scroll
    const io = new IntersectionObserver(
      (es) => {
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.14 },
    );
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

    const reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;

    // ===== gate panel =====
    const grid = document.getElementById('gpgrid');
    const stat = document.getElementById('gpstat');
    const deploy = document.getElementById('gpdeploy');
    const panel = document.getElementById('gatepanel');
    let keydownHandler: ((e: KeyboardEvent) => void) | undefined;

    if (grid && stat && deploy && panel) {
      let COLS = 8;
      const ROWS = 4;
      let N = COLS * ROWS;
      if (window.matchMedia('(max-width:520px)').matches) {
        COLS = 6;
        N = COLS * ROWS;
      }
      const heal: Record<number, number> = { 11: 1, 22: 1 };
      const bug: Record<number, number> = { 18: 1 };
      const stateOf = (i: number): SpecState => (bug[i] ? 'bug' : heal[i] ? 'heal' : 'pass');

      const specs: Spec[] = [];
      for (let i = 0; i < N; i++) {
        specs.push({
          name: (NAMES[i] || `spec-${i}`) + '.spec.ts',
          state: stateOf(i),
          asserts: 2 + (i % 5),
          dur: ((400 + ((i * 137) % 900)) / 1000).toFixed(2) + 's',
        });
      }
      const s11 = specs[11];
      if (s11) {
        s11.diff = ["- getByRole('button', { name: 'Add' })", "+ getByRole('button', { name: 'Add to cart' })"];
        s11.pr = 128;
      }
      const s22 = specs[22];
      if (s22) {
        s22.diff = ["- getByTestId('save')", "+ getByTestId('save-profile')"];
        s22.pr = 131;
      }

      const cells: HTMLDivElement[] = [];
      for (let i = 0; i < N; i++) {
        const c = document.createElement('div');
        c.className = 'cell';
        grid.appendChild(c);
        cells.push(c);
      }
      const scan = document.createElement('div');
      scan.className = 'scan';
      grid.appendChild(scan);
      const stamp = document.createElement('div');
      stamp.className = 'seal-stamp';
      stamp.appendChild(document.createTextNode('SEALED ✓'));
      grid.appendChild(stamp);

      const clickable = (c: Element) =>
        c.classList.contains('pass') || c.classList.contains('heal') || c.classList.contains('bug');
      const resolveRow = (r: number) => {
        for (let i = r * COLS; i < r * COLS + COLS; i++) {
          const cell = cells[i];
          const spec = specs[i];
          if (!cell || !spec) continue;
          const st = stateOf(i);
          cell.classList.add(st);
          cell.tabIndex = 0;
          cell.setAttribute('role', 'button');
          cell.setAttribute('aria-label', `${spec.name}, ${st}, open run report`);
        }
      };
      const finish = () => {
        const nb = Object.keys(bug).length;
        const nh = Object.keys(heal).length;
        const np = N - nb - nh;
        stat.innerHTML = `<b>${np} passed</b> &middot; ${nh} healed &middot; <span style="color:var(--alert)">${nb} bug held</span>`;
        deploy.className = 'gp-deploy blocked';
        deploy.innerHTML = 'DEPLOY BLOCKED <i class="led"></i>';
        panel.classList.add('sealed');
      };
      const reset = () => {
        cells.forEach((c) => {
          c.className = 'cell';
          c.removeAttribute('tabindex');
          c.removeAttribute('role');
          c.removeAttribute('aria-label');
        });
        stat.innerHTML = 'scanning suite&hellip;';
        deploy.className = 'gp-deploy';
        deploy.innerHTML = 'DEPLOY <i class="led"></i>';
        panel.classList.remove('sealed');
        grid.classList.remove('scanning');
      };
      const ensureResolved = () => {
        for (let r = 0; r < ROWS; r++) resolveRow(r);
        finish();
      };
      const play = () => {
        reset();
        void grid.offsetWidth;
        grid.classList.add('scanning');
        for (let r = 0; r < ROWS; r++) {
          const rr = r;
          timeouts.push(setTimeout(() => resolveRow(rr), 340 + rr * 480));
        }
        timeouts.push(setTimeout(finish, 2400));
      };

      // run-report modal
      const modal = document.getElementById('modal');
      const mVerdict = document.getElementById('m-verdict');
      const mVtext = document.getElementById('m-vtext');
      const mSpec = document.getElementById('m-spec');
      const mBody = document.getElementById('m-body');
      const mSeal = document.getElementById('m-seal');
      const mClose = document.getElementById('m-close');
      let engaged = false;
      let lastFocus: HTMLElement | null = null;

      const rid = (i: number) => {
        const h = (n: number) => ('0000000' + ((n * 2654435761) >>> 0).toString(16)).slice(-7);
        return 'ssn_' + h(i + 3) + h(i + 11);
      };
      const rrows = (a: [string, string, string?][]) =>
        a
          .map((r) => `<div class="row"><span class="k">${r[0]}</span><span class="v ${r[2] || ''}">${r[1]}</span></div>`)
          .join('');

      if (modal && mVerdict && mVtext && mSpec && mBody && mSeal && mClose) {
        const openModal = (i: number) => {
          if (!engaged) {
            engaged = true;
            if (gtimer) clearInterval(gtimer);
            ensureResolved();
          }
          const s = specs[i];
          if (!s) return;
          let v: string;
          let vc: string;
          if (s.state === 'pass') {
            v = 'PASSED';
            vc = 'v-pass';
            mBody.innerHTML = rrows([
              ['status', 'all assertions passed', 'ok'],
              ['checks', s.asserts + ' assertions'],
              ['time', s.dur],
              ['flake', 'none detected'],
            ]);
          } else if (s.state === 'heal') {
            v = 'HEALED';
            vc = 'v-heal';
            mBody.innerHTML = rrows([
              ['cause', 'locator stale, selector renamed'],
              ['change', `<div class="diff"><span class="del">${s.diff?.[0] ?? ''}</span><br><span class="add">${s.diff?.[1] ?? ''}</span></div>`],
              ['verify', 're-ran, passed', 'ok'],
              ['result', `fix PR #${s.pr} opened`],
            ]);
          } else {
            v = 'BUG HELD';
            vc = 'v-bug';
            mBody.innerHTML = rrows([
              ['cause', 'behaviour changed, not drift', 'bug'],
              ['assert', 'expected <span class="ok">$49.00</span>, got <span class="bug">$0.00</span>'],
              ['change', 'none, spec untouched'],
              ['result', 'gate failed, deploy blocked', 'bug'],
            ]);
          }
          mVerdict.className = 'm-verdict ' + vc;
          mVtext.innerHTML = v;
          mSpec.textContent = s.name;
          mSeal.innerHTML = `<span><span class="chk">&#10003;</span> observed by Vigilis &middot; sealed by Treeship</span><span class="m-rid">${rid(i)}</span>`;
          lastFocus = document.activeElement as HTMLElement | null;
          modal.classList.add('open');
          modal.setAttribute('aria-hidden', 'false');
          mClose.focus();
        };
        const closeModal = () => {
          modal.classList.remove('open');
          modal.setAttribute('aria-hidden', 'true');
          if (lastFocus && lastFocus.focus) lastFocus.focus();
        };
        mClose.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
          if (e.target === modal) closeModal();
        });
        keydownHandler = (e: KeyboardEvent) => {
          if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
        };
        document.addEventListener('keydown', keydownHandler);
        grid.addEventListener('click', (e) => {
          const c = (e.target as Element | null)?.closest?.('.cell') as HTMLDivElement | null;
          if (!c) return;
          const i = cells.indexOf(c);
          if (i < 0 || !clickable(c)) return;
          openModal(i);
        });
        grid.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          const c = (e.target as Element | null)?.closest?.('.cell') as HTMLDivElement | null;
          if (!c) return;
          const i = cells.indexOf(c);
          if (i < 0 || !clickable(c)) return;
          e.preventDefault();
          openModal(i);
        });
      }

      if (reduce) ensureResolved();
      else {
        play();
        gtimer = setInterval(play, 6800);
      }
    }

    // ===== animated heal-run demo =====
    const dBody = document.getElementById('demo-body');
    const dState = document.getElementById('demo-state');
    const dReplay = document.getElementById('demo-replay');
    const demoEl = document.getElementById('demo');
    let dObs: IntersectionObserver | undefined;

    const dSetState = (s: string) => {
      if (!dState) return;
      if (s === 'live') {
        dState.className = 'demo-state live';
        dState.innerHTML = '<span class="ic"></span>running';
      } else if (s === 'blocked') {
        dState.className = 'demo-state blocked';
        dState.innerHTML = '<span class="ic"></span>deploy blocked';
      } else {
        dState.className = 'demo-state';
        dState.innerHTML = '';
      }
    };
    const dEndCursor = () => {
      if (!dBody) return;
      const c = document.createElement('div');
      c.className = 'ln cmd';
      c.innerHTML = '<span class="p">$</span> <span class="cur"></span>';
      dBody.appendChild(c);
    };
    const dRenderAll = () => {
      if (!dBody) return;
      dBody.innerHTML = '';
      STEPS.forEach((s) => {
        const d = document.createElement('div');
        d.className = 'ln';
        if (s.k === 'gap') d.innerHTML = '&nbsp;';
        else if (s.k === 'cmd') {
          d.className = 'ln cmd';
          d.innerHTML = '<span class="p">$</span> ' + (s.t ?? '');
        } else {
          d.className = 'ln ' + s.k;
          d.innerHTML = s.t ?? '';
        }
        dBody.appendChild(d);
      });
      dSetState('blocked');
      dEndCursor();
    };
    const dPlay = () => {
      if (!dBody) return;
      if (dTimer) clearTimeout(dTimer);
      dBody.innerHTML = '';
      dSetState('live');
      let i = 0;
      const step = () => {
        if (i >= STEPS.length) {
          dSetState('blocked');
          dEndCursor();
          return;
        }
        const s = STEPS[i++];
        if (!s) return;
        const d = document.createElement('div');
        d.className = 'ln';
        if (s.k === 'cmd') {
          d.className = 'ln cmd';
          dBody.appendChild(d);
          const full = '$ ' + (s.t ?? '');
          let j = 0;
          const type = () => {
            if (j <= full.length) {
              d.innerHTML = full.slice(0, j).replace(/^\$/, '<span class="p">$</span>') + '<span class="cur"></span>';
              j++;
              dTimer = setTimeout(type, 26);
            } else {
              d.innerHTML = full.replace(/^\$/, '<span class="p">$</span>');
              dTimer = setTimeout(step, 360);
            }
          };
          type();
          return;
        }
        if (s.k === 'gap') d.innerHTML = '&nbsp;';
        else {
          d.className = 'ln ' + s.k;
          d.innerHTML = (s.t ?? '') + (s.work ? '<span class="wk"> …</span>' : '');
        }
        dBody.appendChild(d);
        if (s.state) dSetState(s.state);
        dTimer = setTimeout(step, s.work ? 780 : s.k === 'gap' ? 120 : 250);
      };
      step();
    };
    if (dReplay) dReplay.addEventListener('click', dPlay);
    if (reduce) {
      dRenderAll();
    } else if (dBody && demoEl) {
      let dPlayed = false;
      dObs = new IntersectionObserver(
        (es) => {
          es.forEach((e) => {
            if (e.isIntersecting && !dPlayed) {
              dPlayed = true;
              dPlay();
              dObs?.unobserve(e.target);
            }
          });
        },
        { threshold: 0.45 },
      );
      dObs.observe(demoEl);
    }

    // ===== view routing =====
    const route = () => {
      const hash = (location.hash || '').replace('#', '');
      const v = hash.indexOf('how') > -1 ? 'how' : 'home';
      document.querySelectorAll<HTMLElement>('[data-view]').forEach((el) => {
        const t = el.tagName;
        if (t === 'SECTION' || t === 'HEADER' || el.classList.contains('trust')) {
          // Use an explicit 'block' (not '') for the active view: how-view sections
          // are hidden by a CSS rule (section[data-view="how"]{display:none}), and an
          // empty inline value falls back to that rule, leaving the How tab blank.
          el.style.display = el.getAttribute('data-view') === v ? 'block' : 'none';
        }
      });
      document.querySelectorAll('.nav-r a[data-view]').forEach((a) => {
        a.classList.toggle('active', a.getAttribute('data-view') === v);
      });
      document.querySelectorAll(`[data-view="${v}"] .reveal`).forEach((el) => el.classList.add('in'));
      if (v === 'home' && hash && hash !== 'home') {
        const tgt = document.getElementById(hash);
        if (tgt) {
          tgt.scrollIntoView();
          return;
        }
      }
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', route);
    route();

    return () => {
      timeouts.forEach(clearTimeout);
      if (gtimer) clearInterval(gtimer);
      if (dTimer) clearTimeout(dTimer);
      io.disconnect();
      dObs?.disconnect();
      window.removeEventListener('hashchange', route);
      if (keydownHandler) document.removeEventListener('keydown', keydownHandler);
    };
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: MARKUP }} />;
}

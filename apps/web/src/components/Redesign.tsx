'use client';

import { useEffect } from 'react';

const MARKUP = `
<nav>
  <div class="nav-in">
    <div class="mark"><span class="b">[</span>VIGILIS<span class="b">]</span></div>
    <div class="nav-links">
      <a href="#proof">Proof</a>
      <a href="#loop">The loop</a>
      <a href="#why">Why</a>
      <a href="#install">Install</a>
    </div>
    <a class="nav-cta" href="https://github.com/piyushpathakqa/Vigilis">GitHub ▸</a>
  </div>
</nav>

<header class="hero">
  <div class="wrap">
    <span class="tag"><span class="dot"></span>Open-source · self-healing QA · CLI + MCP · MIT</span>
    <h1>The QA agent that proves it <span class="strike">hid your bug</span> didn't.</h1>
    <p class="sub">Point it at <b>the brittle Cypress, Selenium, or Playwright suite you already have</b>. Vigilis heals the drift, gates every run on signed evidence, and stays fail-closed so it <b>never papers over a real bug</b>.</p>

    <div class="hero-cta">
      <div class="install">
        <code><span class="p">$</span> npm i -D vigilis</code>
        <button class="copy" data-copy="npm i -D vigilis">copy</button>
      </div>
      <a class="btn-ghost" href="#proof">See heal vs. refuse ▸</a>
    </div>

    <div class="hero-meta">
      <span><b>Works with</b> the Cypress · Selenium · Playwright suite you've got</span>
      <span><b>Runs as</b> CLI · MCP · GitHub Actions gate</span>
    </div>

    <div class="term">
      <div class="term-bar">
        <span class="d"></span><span class="d"></span><span class="d"></span>
        <span class="t">vigilis heal · login.spec.ts</span>
      </div>
      <div class="term-body" id="term"></div>
    </div>
  </div>
</header>

<section id="proof">
  <div class="wrap">
    <div class="sec-head reveal">
      <span class="eyebrow">The difference, side by side</span>
      <h2>One drift it fixed. One bug it refused to touch.</h2>
      <p>Any self-healing tool can turn a build green. The real question: did it fix the locator, or quietly bury a regression? Vigilis answers with evidence.</p>
    </div>

    <div class="receipts">
      <div class="rc reveal">
        <div class="rc-top">
          <span class="verdict v-heal"><span class="ic"></span>Healed</span>
          <span class="ssn">dom-drift</span>
        </div>
        <div class="rc-body">
          <div class="row"><span class="k">spec</span><span class="v">login.spec.ts · "sign in"</span></div>
          <div class="row"><span class="k">triage</span><span class="v">locator stale · data-testid renamed</span></div>
          <div class="row"><span class="k">change</span><span class="v"><div class="diff"><span class="del">- getByTestId('login-btn')</span><br><span class="add">+ getByTestId('signin-btn')</span></div></span></div>
          <div class="row"><span class="k">verify</span><span class="v ok">re-ran → 3 passed</span></div>
          <div class="row"><span class="k">result</span><span class="v">fix PR opened for review</span></div>
        </div>
        <div class="seal"><span><span class="chk">✓</span> heal sealed into a signed receipt</span></div>
      </div>

      <div class="rc reveal">
        <div class="rc-top">
          <span class="verdict v-refuse"><span class="ic"></span>Refused to heal</span>
          <span class="ssn">real bug</span>
        </div>
        <div class="rc-body">
          <div class="row"><span class="k">spec</span><span class="v">checkout.spec.ts · "order total"</span></div>
          <div class="row"><span class="k">triage</span><span class="v bug">behaviour changed · not drift</span></div>
          <div class="row"><span class="k">assert</span><span class="v">expected <span class="ok">$49.00</span> · got <span class="bug">$0.00</span></span></div>
          <div class="row"><span class="k">change</span><span class="v">none, spec untouched</span></div>
          <div class="row"><span class="k">result</span><span class="v bug">QA Gate failed · deploy blocked</span></div>
        </div>
        <div class="seal"><span><span class="chk">✓</span> refusal sealed into a signed receipt</span></div>
      </div>
    </div>

    <p class="seal-note reveal">Sealing is automatic when the <a href="https://www.treeship.dev">Treeship</a> CLI is present. Every heal and every refusal becomes an offline-verifiable receipt, no hard dependency, <span class="dim">--no-receipt</span> to opt out. <a href="https://github.com/piyushpathakqa/Vigilis/blob/main/docs/TREESHIP.md">How receipts work ▸</a></p>

    <p class="punch reveal">It could have rewritten that assertion and shipped green. It didn't. <b>You get evidence, not a black box.</b></p>
  </div>
</section>

<section id="loop">
  <div class="wrap">
    <div class="sec-head reveal">
      <span class="eyebrow">One core · four behaviors</span>
      <h2>It authors, generates, triages, and heals.</h2>
    </div>
    <div class="loop reveal">
      <div class="step"><div class="n">01</div><h3>Author</h3><p>Plain-English intent in, a structured test plan out.</p><div class="out">→ *.plan.json</div></div>
      <div class="step"><div class="n">02</div><h3>Generate</h3><p>Explores the app from a URL and writes specs with real assertions.</p><div class="out">→ tests/*.spec.ts</div></div>
      <div class="step"><div class="n">03</div><h3>Triage</h3><p>Classifies every failure: real bug, DOM drift, or flake.</p><div class="out">→ root-cause report</div></div>
      <div class="step"><div class="n">04</div><h3>Heal</h3><p>Rewrites the locator, re-runs to verify green, opens a PR. Refuses real bugs.</p><div class="out">→ pull request</div></div>
    </div>
    <div class="wrapband reveal">
      <b>Wrapped by CI:</b> the loop runs as a required <span class="green">QA Gate</span> check in GitHub Actions <span class="sep">·</span> <b>and by Treeship:</b> each heal is sealed into a signed receipt.
    </div>
  </div>
</section>

<section id="why">
  <div class="wrap">
    <div class="sec-head reveal">
      <span class="eyebrow">Why teams reach for it</span>
      <h2>Built for the QA engineer who doesn't trust auto-healing.</h2>
    </div>
    <div class="why reveal">
      <div class="cell"><h3><span class="g">▸</span> Heals the suite you already have</h3><p>Sitting on brittle Cypress or Selenium tests you can't justify rewriting? Point Vigilis at them. It fixes the drift in place. No migration, no greenfield rewrite.</p></div>
      <div class="cell"><h3><span class="g">▸</span> A gate, not a suggestion</h3><p>Runs as a required QA Gate check in GitHub Actions. A real regression can't merge its way to production around it.</p></div>
      <div class="cell"><h3><span class="g">▸</span> Refusal is the feature</h3><p>The hard line: it will not heal a real bug. Drift gets a verified-green fix PR; bugs block the gate and stay loud.</p></div>
      <div class="cell"><h3><span class="g">▸</span> One core, two surfaces</h3><p>The same QA tools drive the CLI in CI and an MCP server in Claude Desktop. Defined once, no divergence.</p></div>
    </div>
  </div>
</section>

<section id="install">
  <div class="wrap">
    <div class="sec-head reveal">
      <span class="eyebrow">Install · 60 seconds</span>
      <h2>Drop it into the project you already have.</h2>
    </div>
    <div class="term reveal" style="margin-top:28px">
      <div class="term-bar"><span class="d"></span><span class="d"></span><span class="d"></span><span class="t">your-project · zsh</span></div>
      <div class="term-body">
<div class="ln"><span class="dim"># install, auto-detects Playwright / Cypress / Selenium</span></div>
<div class="ln cmd"><span class="p">$</span> npm i -D vigilis</div>
<div class="ln cmd"><span class="p">$</span> export ANTHROPIC_API_KEY=sk-...</div>
<div class="ln cmd"><span class="p">$</span> vigilis init</div>
<br>
<div class="ln"><span class="dim"># write a real spec from a URL and run it</span></div>
<div class="ln cmd"><span class="p">$</span> vigilis generate https://your-app.com/login --run</div>
<div class="ln arrow">  explore → write → run   <span class="green">3 passed</span></div>
      </div>
    </div>
    <p class="seal-note reveal" style="margin-top:18px">Needs an Anthropic <b style="color:var(--dim)">API</b> key and chromium. Defaults to Opus for quality; add <span class="dim">--model claude-haiku-4-5</span> for ~10¢ runs. On npm: <a href="https://www.npmjs.com/package/vigilis">vigilis</a> · drive it from Claude via the <a href="https://github.com/piyushpathakqa/Vigilis/blob/main/docs/MCP.md">MCP server</a>.</p>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="sec-head reveal">
      <span class="eyebrow">Status · honest</span>
      <h2>The full loop runs as code today.</h2>
      <p>M0–M3 complete: generate from a URL, gate in CI, triage a failure, self-heal drift with a PR while refusing real bugs. M4 (MCP polish + demos) in progress.</p>
    </div>
    <div class="arch reveal">
      <div class="node app"><div class="lbl">App</div><h3>Vigilis</h3><p>Autonomous QA. Writes tests, heals safe drift, opens PRs, fails loudly on real regressions.</p></div>
      <div class="node"><div class="lbl">Primitive</div><h3>Treeship</h3><p>The signed, offline-verifiable receipts each heal runs on. Provenance for agent actions.</p></div>
      <div class="node"><div class="lbl">Lab</div><h3>Zerker Labs</h3><p>Building the primitives and apps for governed agents that take real actions in production.</p></div>
    </div>
  </div>
</section>

<footer>
  <div class="wrap">
    <div class="foot-grid">
      <div>
        <div class="mark"><span class="b">[</span>VIGILIS<span class="b">]</span></div>
        <p class="sub" style="font-size:13px;margin-top:12px;max-width:38ch">Self-healing QA you can audit. A receipt, not a black box.</p>
      </div>
      <div class="foot-links">
        <a href="https://github.com/piyushpathakqa/Vigilis">GitHub</a>
        <a href="https://www.npmjs.com/package/vigilis">npm</a>
        <a href="https://github.com/piyushpathakqa/Vigilis/blob/main/docs/MCP.md">MCP</a>
        <a href="https://github.com/piyushpathakqa/Vigilis/blob/main/docs/DEMO.md">Demo</a>
        <a href="https://github.com/piyushpathakqa/Vigilis/blob/main/docs/TREESHIP.md">Receipts</a>
      </div>
    </div>
    <p class="foot-note">MIT · Built by Piyush Pathak · Provenance powered by <a href="https://www.treeship.dev">Treeship</a> (Zerker Labs)</p>
  </div>
</footer>
`;

type Line = { t: string; c: 'cmd' | 'red' | 'amber' | 'dim' | 'green' };

const LINES: Line[] = [
  { t: '$ vigilis heal --spec checkout.spec.ts', c: 'cmd' },
  { t: 'triage   real bug, order total changed', c: 'red' },
  { t: 'decision REFUSE, will not heal a behaviour change', c: 'amber' },
  { t: 'gate     QA Gate failed · deploy blocked', c: 'dim' },
  { t: '', c: 'dim' },
  { t: '✓ refusal sealed into a signed receipt', c: 'green' },
];

const colorVar = (c: Line['c']) => `var(--${c === 'dim' ? 'faint' : c})`;

export function Redesign() {
  useEffect(() => {
    // copy buttons
    document.querySelectorAll<HTMLButtonElement>('.copy').forEach((b) => {
      b.addEventListener('click', () => {
        navigator.clipboard?.writeText(b.dataset.copy ?? '');
        const o = b.textContent;
        b.textContent = 'copied';
        b.style.color = 'var(--green)';
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
      { threshold: 0.15 },
    );
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

    // hero terminal typing animation
    const reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    const term = document.getElementById('term');
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    if (term) {
      if (reduce) {
        term.innerHTML = '';
        LINES.forEach((l) => {
          const d = document.createElement('div');
          d.className = 'ln';
          if (l.c === 'cmd') {
            d.classList.add('cmd');
            d.innerHTML = l.t.replace(/^\$/, '<span class="p">$</span>');
          } else {
            d.style.color = colorVar(l.c);
            d.textContent = l.t;
          }
          term.appendChild(d);
        });
        const c = document.createElement('span');
        c.className = 'cur';
        term.appendChild(c);
      } else {
        let li = 0;
        let ci = 0;
        const tick = () => {
          if (cancelled || !term) return;
          if (li >= LINES.length) {
            const c = document.createElement('span');
            c.className = 'cur';
            term.appendChild(c);
            return;
          }
          const cur = LINES[li];
          if (!cur) return;
          let line = term.children[li] as HTMLElement | undefined;
          if (!line) {
            line = document.createElement('div');
            line.className = 'ln';
            if (cur.c === 'cmd') line.classList.add('cmd');
            else line.style.color = colorVar(cur.c);
            term.appendChild(line);
          }
          const full = cur.t;
          if (ci <= full.length) {
            let shown = full.slice(0, ci);
            if (cur.c === 'cmd') shown = shown.replace(/^\$/, '<span class="p">$</span>');
            line.innerHTML = shown + '<span class="cur"></span>';
            ci++;
            timers.push(setTimeout(tick, cur.c === 'cmd' ? 32 : 15));
          } else {
            let shown = full;
            if (cur.c === 'cmd') shown = shown.replace(/^\$/, '<span class="p">$</span>');
            line.innerHTML = shown;
            li++;
            ci = 0;
            timers.push(setTimeout(tick, li === 1 ? 400 : 150));
          }
        };
        timers.push(setTimeout(tick, 500));
      }
    }

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      io.disconnect();
    };
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: MARKUP }} />;
}

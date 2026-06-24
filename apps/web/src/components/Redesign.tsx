'use client';

import { useEffect } from 'react';

const MARKUP = `
<nav>
  <div class="nav-in">
    <a class="mark" href="#top"><span class="b">[</span>VIGILIS<span class="b">]</span></a>
    <div class="nav-links">
      <a href="#proof">Proof</a>
      <a href="#why">Why us</a>
      <a href="#loop">The loop</a>
      <a href="#install">Install</a>
    </div>
    <a class="nav-cta" href="https://github.com/piyushpathakqa/Vigilis">GitHub &#9656;</a>
  </div>
</nav>

<header class="hero" id="top">
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <span class="kicker"><span class="dot"></span>Open-source &middot; CLI + MCP server &middot; MIT</span>
      <h1>Self-healing QA<br><span class="l2">that refuses to hide a real bug.</span></h1>
      <p class="sub">Point it at <b>the Cypress, Selenium, or Playwright suite you already have</b>. It heals the drift and gates every run on <b>signed evidence</b>.</p>
      <div class="hero-cta">
        <div class="install">
          <code><span class="p">$</span> npm i -D vigilis</code>
          <button class="copy" data-copy="npm i -D vigilis" aria-label="Copy install command">COPY</button>
        </div>
        <a class="btn-ghost" href="#proof">Heal vs. refuse &#9656;</a>
      </div>
    </div>

    <div class="hero-visual">
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
      <p class="gp-hint">click any cell for its <b>run report</b></p>
    </div>
  </div>
</header>

<section id="proof">
  <div class="wrap">
    <div class="sec-head reveal">
      <span class="eyebrow"><span class="ix">01</span> The decision that is the product</span>
      <h2>Same failure. Two verdicts. The agent picks, and proves which.</h2>
      <p>Any self-healing tool can turn a build green. The real question is what it did with the failure: rewrite a stale locator, or quietly bury a regression?</p>
    </div>

    <div class="fork reveal">
      <div class="triage">
        <div class="lbl">Triage</div>
        <p>A spec just failed. <b>What kind of failure is it?</b> <span class="mono">&nbsp;bug &middot; drift &middot; flake</span></p>
      </div>
      <div class="connector" aria-hidden="true"><i class="stem"></i><i class="bar"></i><i class="dl"></i><i class="dr"></i></div>
      <div class="receipts">
        <div class="rc surface">
          <div class="rc-top">
            <span class="verdict v-heal"><span class="ic"></span>Healed</span>
            <span class="branch">if drift &#9656;</span>
          </div>
          <div class="rc-body">
            <div class="row"><span class="k">spec</span><span class="v">login.spec.ts &middot; "sign in"</span></div>
            <div class="row"><span class="k">cause</span><span class="v">locator stale &middot; testid renamed</span></div>
            <div class="row"><span class="k">change</span><span class="v"><div class="diff"><span class="del">- getByTestId('login-btn')</span><br><span class="add">+ getByTestId('signin-btn')</span></div></span></div>
            <div class="row"><span class="k">verify</span><span class="v ok">re-ran &#8594; 3 passed</span></div>
            <div class="row"><span class="k">result</span><span class="v">fix PR opened for review</span></div>
          </div>
          <div class="seal"><span class="chk">&#10003;</span> heal sealed into a signed receipt</div>
        </div>
        <div class="rc surface r2">
          <div class="rc-top">
            <span class="verdict v-refuse"><span class="ic"></span>Refused to heal</span>
            <span class="branch">if real bug &#9656;</span>
          </div>
          <div class="rc-body">
            <div class="row"><span class="k">spec</span><span class="v">checkout.spec.ts &middot; "order total"</span></div>
            <div class="row"><span class="k">cause</span><span class="v bug">behaviour changed, not drift</span></div>
            <div class="row"><span class="k">assert</span><span class="v">expected <span class="ok">$49.00</span> &middot; got <span class="bug">$0.00</span></span></div>
            <div class="row"><span class="k">change</span><span class="v">none, spec untouched</span></div>
            <div class="row"><span class="k">result</span><span class="v bug">QA Gate failed &middot; deploy blocked</span></div>
          </div>
          <div class="seal"><span class="chk">&#10003;</span> refusal sealed into a signed receipt</div>
        </div>
      </div>
    </div>

    <p class="seal-note reveal">Sealing is automatic when the <a href="https://www.treeship.dev">Treeship</a> CLI is present. Every heal and every refusal becomes an offline-verifiable receipt, with no hard dependency and <span class="mono">--no-receipt</span> to opt out. <a href="https://github.com/piyushpathakqa/Vigilis/blob/main/docs/TREESHIP.md">How receipts work &#9656;</a></p>
    <p class="punch reveal">It could have rewritten that assertion and shipped green. It didn't. <b>You get evidence, not a black box.</b></p>
  </div>
</section>

<section id="why">
  <div class="wrap">
    <div class="sec-head reveal">
      <span class="eyebrow"><span class="ix">02</span> The real question</span>
      <h2>Why not just tell Claude Code or Codex to fix your tests?</h2>
      <p>General coding agents are great at writing code with you. As an unattended QA gate they're dangerous, for one reason: ask one to turn a red build green, and the cheapest path to green is to weaken the assertion that caught the bug. They optimize for "make it pass," nothing stops them at a real regression, and they leave no record of the call they made.</p>
    </div>

    <div class="versus reveal">
      <div class="vp surface bad">
        <div class="vp-bar">
          <div class="who">A general coding agent</div>
          <div class="obj">objective: make CI pass</div>
        </div>
        <div class="vp-trace">
<div><span class="p">&gt;</span> "the checkout test is failing, make it pass"</div>
<div><span class="p">&middot;</span> assertion: expected $49.00, got $0.00</div>
<div><span class="p">&middot;</span> rewrites the assertion to expect <span class="danger">$0.00</span></div>
<div><span class="p">&middot;</span> CI turns <span style="color:var(--signal)">green</span></div>
        </div>
        <div class="vp-out"><i class="ic"></i> the $0.00 checkout bug ships to prod</div>
      </div>

      <div class="vp surface good">
        <div class="vp-bar">
          <div class="who">Vigilis</div>
          <div class="obj">objective: tell the truth about the failure</div>
        </div>
        <div class="vp-trace">
<div><span class="p">$</span> vigilis heal --spec checkout</div>
<div><span class="p">&middot;</span> triage: behavioural regression, not drift</div>
<div><span class="p">&middot;</span> <span class="warn">refuses</span> to touch the spec</div>
<div><span class="p">&middot;</span> QA Gate fails, <span class="warn">deploy blocked</span></div>
        </div>
        <div class="vp-out"><i class="ic"></i> bug caught before prod, refusal sealed</div>
      </div>
    </div>

    <p class="punch reveal">Vigilis is not a smarter test writer. It's the gate that knows <b>when not to act</b>, and signs the proof. You can't get that from a prompt you hope a general agent will honor on every PR, unattended, forever.</p>

    <div class="hired reveal">
      <div class="h"><b>Rescue</b>Teams buried in a brittle Cypress or Selenium suite that breaks on every cosmetic change, who can't risk a blind auto-fix hiding a real one.</div>
      <div class="h"><b>Trust</b>Eng and QA leads who want CI automation they can leave running unattended, governed by a hard contract instead of a hopeful prompt.</div>
      <div class="h"><b>Evidence</b>Regulated teams who need a signed, independent audit trail for anything an agent changes in the test suite.</div>
    </div>
  </div>
</section>

<section id="loop">
  <div class="wrap">
    <div class="sec-head reveal">
      <span class="eyebrow"><span class="ix">03</span> One core &middot; four behaviors</span>
      <h2>It authors, generates, triages, and heals.</h2>
    </div>
    <div class="loop reveal">
      <div class="step"><div class="n">01</div><h3>Author</h3><p>Plain-English intent in, a structured test plan out.</p><div class="out">&#8594; *.plan.json</div></div>
      <div class="step"><div class="n">02</div><h3>Generate</h3><p>Explores the app from a URL and writes specs with real assertions.</p><div class="out">&#8594; tests/*.spec.ts</div></div>
      <div class="step"><div class="n">03</div><h3>Triage</h3><p>Classifies every failure: real bug, DOM drift, or flake.</p><div class="out">&#8594; root-cause report</div></div>
      <div class="step"><div class="n">04</div><h3>Heal</h3><p>Rewrites the locator, re-runs to verify green, opens a PR. Refuses real bugs.</p><div class="out">&#8594; pull request</div></div>
    </div>
    <div class="wrapband reveal">
      <b>Wrapped by CI:</b> the loop runs as a required <span class="green">QA Gate</span> check in GitHub Actions. <span class="sep">/</span> <b>Wrapped by Treeship:</b> each heal and refusal is sealed into a signed receipt.
    </div>
  </div>
</section>

<section id="install">
  <div class="wrap">
    <div class="sec-head reveal">
      <span class="eyebrow"><span class="ix">04</span> Install &middot; 60 seconds</span>
      <h2>Drop it into the project you already have.</h2>
    </div>
    <div class="surface framed reveal" style="margin-top:30px;overflow:hidden">
      <i class="corner c-tl"></i><i class="corner c-tr"></i><i class="corner c-bl"></i><i class="corner c-br"></i>
      <div class="gp-bar"><span class="d"></span><span class="d"></span><span class="d"></span><span class="t">your-project &middot; zsh</span></div>
      <div class="term-body">
<div><span class="dim"># install, auto-detects Playwright / Cypress / Selenium</span></div>
<div style="color:var(--mist)"><span class="p">$</span> npm i -D vigilis</div>
<div style="color:var(--mist)"><span class="p">$</span> export ANTHROPIC_API_KEY=sk-...</div>
<div style="color:var(--mist)"><span class="p">$</span> vigilis init</div>
<br>
<div><span class="dim"># write a real spec from a URL and run it</span></div>
<div style="color:var(--mist)"><span class="p">$</span> vigilis generate https://your-app.com/login --run</div>
<div style="color:var(--faint)">&nbsp;&nbsp;explore &#8594; write &#8594; run &nbsp;<span class="green">3 passed</span></div>
      </div>
    </div>
    <p class="seal-note reveal" style="margin-top:20px">Needs an Anthropic API key and chromium. Defaults to Opus for quality; add <span class="mono">--model claude-haiku-4-5</span> for roughly 10&cent; runs. On npm: <a href="https://www.npmjs.com/package/vigilis">vigilis</a>. Drive it from Claude via the <a href="https://github.com/piyushpathakqa/Vigilis/blob/main/docs/MCP.md">MCP server</a>.</p>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="sec-head reveal">
      <span class="eyebrow"><span class="ix">05</span> Status &middot; honest</span>
      <h2>The full loop runs as code today.</h2>
      <p>M0&#8211;M3 complete: generate from a URL, gate in CI, triage a failure, self-heal drift with a PR while refusing real bugs. M4 (MCP polish and demos) in progress.</p>
    </div>
    <div class="arch reveal">
      <div class="node surface app"><div class="lbl">App</div><h3>Vigilis</h3><p>Autonomous QA. Heals safe drift, opens PRs, fails loudly on real regressions.</p></div>
      <div class="node surface"><div class="lbl">Primitive</div><h3>Treeship</h3><p>The signed, offline-verifiable receipts each heal runs on. Provenance for agent actions.</p></div>
      <div class="node surface"><div class="lbl">Lab</div><h3>Zerker Labs</h3><p>Building the primitives and apps for governed agents that take real actions in production.</p></div>
    </div>
  </div>
</section>

<footer>
  <div class="wrap">
    <div class="foot-grid">
      <div>
        <div class="mark"><span class="b">[</span>VIGILIS<span class="b">]</span></div>
        <p class="sub" style="font-size:13px;margin-top:13px;max-width:38ch">Self-healing QA you can audit. A receipt, not a black box.</p>
      </div>
      <div class="foot-links">
        <a href="https://github.com/piyushpathakqa/Vigilis">GitHub</a>
        <a href="https://www.npmjs.com/package/vigilis">npm</a>
        <a href="https://github.com/piyushpathakqa/Vigilis/blob/main/docs/MCP.md">MCP</a>
        <a href="https://github.com/piyushpathakqa/Vigilis/blob/main/docs/DEMO.md">Demo</a>
        <a href="https://github.com/piyushpathakqa/Vigilis/blob/main/docs/TREESHIP.md">Receipts</a>
      </div>
    </div>
    <p class="foot-note">MIT &middot; Built by Piyush Pathak &middot; Provenance powered by <a href="https://www.treeship.dev">Treeship</a> (Zerker Labs)</p>
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

const NAMES = [
  'auth/login.spec.ts', 'auth/logout.spec.ts', 'auth/reset-password.spec.ts', 'nav/header.spec.ts',
  'nav/footer-links.spec.ts', 'search/query.spec.ts', 'search/filters.spec.ts', 'catalog/list.spec.ts',
  'catalog/detail.spec.ts', 'cart/add-item.spec.ts', 'cart/remove-item.spec.ts', 'cart/quantity.spec.ts',
  'checkout/address.spec.ts', 'checkout/shipping.spec.ts', 'checkout/order-total.spec.ts', 'checkout/payment.spec.ts',
  'account/profile.spec.ts', 'account/orders.spec.ts', 'account/addresses.spec.ts', 'settings/notifications.spec.ts',
  'settings/privacy.spec.ts', 'a11y/contrast.spec.ts', 'a11y/keyboard-nav.spec.ts', 'perf/lcp.spec.ts',
];

export function Redesign() {
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let interval: ReturnType<typeof setInterval> | undefined;

    // copy buttons
    document.querySelectorAll<HTMLButtonElement>('.copy').forEach((b) => {
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
      { threshold: 0.18 },
    );
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

    const reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    const grid = document.getElementById('gpgrid');
    const stat = document.getElementById('gpstat');
    const deploy = document.getElementById('gpdeploy');
    const panel = document.getElementById('gatepanel');

    let keydownHandler: ((e: KeyboardEvent) => void) | undefined;

    if (grid && stat && deploy && panel) {
      const COLS = 6;
      const ROWS = 4;
      const N = COLS * ROWS;
      const heal: Record<number, boolean> = { 9: true, 16: true };
      const bug: Record<number, boolean> = { 14: true };
      const stateOf = (i: number): SpecState => (bug[i] ? 'bug' : heal[i] ? 'heal' : 'pass');

      const specs: Spec[] = [];
      for (let i = 0; i < N; i++) {
        specs.push({
          name: NAMES[i] || `spec-${i}.ts`,
          state: stateOf(i),
          asserts: 2 + (i % 5),
          dur: ((400 + ((i * 137) % 900)) / 1000).toFixed(2) + 's',
        });
      }
      const s9 = specs[9];
      if (s9) {
        s9.diff = ["- getByRole('button', { name: 'Add' })", "+ getByRole('button', { name: 'Add to cart' })"];
        s9.pr = 128;
      }
      const s16 = specs[16];
      if (s16) {
        s16.diff = ["- getByTestId('save')", "+ getByTestId('save-profile')"];
        s16.pr = 131;
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
        stat.innerHTML =
          '<b>21 passed</b> &middot; 2 healed &middot; <span style="color:var(--alert)">1 bug held</span>';
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
          timers.push(setTimeout(() => resolveRow(rr), 340 + rr * 480));
        }
        timers.push(setTimeout(finish, 2400));
      };

      // run report modal
      const modal = document.getElementById('modal');
      const mVerdict = document.getElementById('m-verdict');
      const mVtext = document.getElementById('m-vtext');
      const mSpec = document.getElementById('m-spec');
      const mBody = document.getElementById('m-body');
      const mSeal = document.getElementById('m-seal');
      const mClose = document.getElementById('m-close');

      if (modal && mVerdict && mVtext && mSpec && mBody && mSeal && mClose) {
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
        const openModal = (i: number) => {
          if (!engaged) {
            engaged = true;
            if (interval) clearInterval(interval);
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
            mSeal.innerHTML = `<span><span class="chk">&#10003;</span> run sealed into a signed receipt</span><span class="m-rid">${rid(i)}</span>`;
          } else if (s.state === 'heal') {
            v = 'HEALED';
            vc = 'v-heal';
            mBody.innerHTML = rrows([
              ['cause', 'locator stale &middot; selector renamed'],
              ['change', `<div class="diff"><span class="del">${s.diff?.[0] ?? ''}</span><br><span class="add">${s.diff?.[1] ?? ''}</span></div>`],
              ['verify', 're-ran &#8594; passed', 'ok'],
              ['result', `fix PR #${s.pr} opened`],
            ]);
            mSeal.innerHTML = `<span><span class="chk">&#10003;</span> heal sealed into a signed receipt</span><span class="m-rid">${rid(i)}</span>`;
          } else {
            v = 'BUG HELD &middot; REFUSED';
            vc = 'v-bug';
            mBody.innerHTML = rrows([
              ['cause', 'behaviour changed, not drift', 'bug'],
              ['assert', 'expected <span class="ok">$49.00</span> &middot; got <span class="bug">$0.00</span>'],
              ['change', 'none, spec untouched'],
              ['result', 'QA Gate failed &middot; deploy blocked', 'bug'],
            ]);
            mSeal.innerHTML = `<span><span class="chk">&#10003;</span> refusal sealed into a signed receipt</span><span class="m-rid">${rid(i)}</span>`;
          }
          mVerdict.className = 'm-verdict ' + vc;
          mVtext.innerHTML = v;
          mSpec.textContent = s.name;
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
          const t = e.target as Element | null;
          const c = t?.closest?.('.cell') as HTMLDivElement | null;
          if (!c) return;
          const i = cells.indexOf(c);
          if (i < 0 || !clickable(c)) return;
          openModal(i);
        });
        grid.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          const t = e.target as Element | null;
          const c = t?.closest?.('.cell') as HTMLDivElement | null;
          if (!c) return;
          const i = cells.indexOf(c);
          if (i < 0 || !clickable(c)) return;
          e.preventDefault();
          openModal(i);
        });
      }

      if (reduce) {
        ensureResolved();
      } else {
        play();
        interval = setInterval(play, 6800);
      }
    }

    return () => {
      timers.forEach(clearTimeout);
      if (interval) clearInterval(interval);
      if (keydownHandler) document.removeEventListener('keydown', keydownHandler);
      io.disconnect();
    };
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: MARKUP }} />;
}

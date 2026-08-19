import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

// Site palette (matches globals.css / VigilisRefuse)
const VOID = '#06080b';
const PANEL = '#0c1014';
const HAIR = '#1c232c';
const HAIR2 = '#2a323d';
const MIST = '#ece7da';
const DIM = '#8a929c';
const SIGNAL = '#41f59a';
const AMBER = '#ffb000';
const ALERT = '#ff6a5d';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function Bg() {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: VOID,
        backgroundImage: `radial-gradient(900px 600px at 50% -10%, ${SIGNAL}12, transparent 60%), radial-gradient(700px 500px at 92% 8%, ${AMBER}0a, transparent 55%), linear-gradient(${HAIR}1a 1px, transparent 1px), linear-gradient(90deg, ${HAIR}1a 1px, transparent 1px)`,
        backgroundSize: 'auto, auto, 72px 72px, 72px 72px',
      }}
    />
  );
}

/** Persistent brand mark, top center — the site's nav wordmark. */
function Brand() {
  return (
    <div
      style={{
        position: 'absolute',
        top: 56,
        left: 0,
        right: 0,
        textAlign: 'center',
        fontFamily: MONO,
        fontSize: 30,
        fontWeight: 700,
        letterSpacing: 3,
        color: MIST,
      }}
    >
      <span style={{ color: AMBER }}>[</span>VIGILIS<span style={{ color: AMBER }}>]</span>
      <div style={{ marginTop: 10, fontSize: 17, fontWeight: 400, letterSpacing: 4, color: DIM, textTransform: 'uppercase' }}>
        The QA gate for AI-written code
      </div>
    </div>
  );
}

function Stage({
  children,
  local,
  dur,
}: {
  children: React.ReactNode;
  local: number;
  dur: number;
}) {
  const opacity = interpolate(local, [0, 12, dur - 12, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const y = interpolate(local, [0, 14], [18, 0], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill
      style={{
        opacity,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 96,
        paddingTop: 170,
        transform: `translateY(${y}px)`,
      }}
    >
      <div style={{ width: '100%', maxWidth: 1080 }}>{children}</div>
    </AbsoluteFill>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: MONO,
        fontSize: 24,
        letterSpacing: 6,
        color: DIM,
        textTransform: 'uppercase',
        marginBottom: 30,
      }}
    >
      {children}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: PANEL, border: `1px solid ${HAIR2}`, borderRadius: 20, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 24px', borderBottom: `1px solid ${HAIR}` }}>
        <i style={{ width: 13, height: 13, borderRadius: '50%', background: '#ff5f56', display: 'inline-block' }} />
        <i style={{ width: 13, height: 13, borderRadius: '50%', background: '#ffbd2e', display: 'inline-block' }} />
        <i style={{ width: 13, height: 13, borderRadius: '50%', background: '#27c93f', display: 'inline-block' }} />
        <span style={{ fontFamily: MONO, fontSize: 22, color: DIM, marginLeft: 12 }}>{title}</span>
      </div>
      <div style={{ padding: '30px 34px 36px', fontFamily: MONO, fontSize: 29, lineHeight: 1.9, color: MIST }}>
        {children}
      </div>
    </div>
  );
}

function line(local: number, at: number) {
  return interpolate(local, [at, at + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

function Stamp({
  stamp,
  color,
  children,
}: {
  stamp: number;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'inline-block',
        transform: `scale(${0.7 + 0.3 * stamp}) rotate(${-3 + 3 * stamp}deg)`,
        opacity: stamp,
        border: `3px solid ${color}`,
        borderRadius: 16,
        padding: '18px 34px',
        color,
        fontFamily: SANS,
        fontSize: 50,
        fontWeight: 800,
        letterSpacing: -1,
        boxShadow: `0 0 60px -12px ${color}66`,
      }}
    >
      {children}
    </div>
  );
}

const SPEC_LINES = [
  "test('checkout flow', async ({ page }) => {",
  "  await page.goto('/cart');",
  "  await page.getByRole('button', { name: 'Pay' }).click();",
  "  await expect(page.getByText('Thanks!')).toBeVisible();",
  '});',
];

// 01 — Generate: explore the app, write a real spec
function Generate({ local, dur }: { local: number; dur: number }) {
  const fullText = SPEC_LINES.join('\n');
  const chars = Math.floor(
    interpolate(local, [22, dur - 40], [0, fullText.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );
  const shown = fullText.slice(0, chars);
  const caret = local % 30 < 15 ? '▋' : ' ';
  return (
    <Stage local={local} dur={dur}>
      <Eyebrow>01 · Generate</Eyebrow>
      <Panel title="vigilis generate">
        <div style={{ opacity: line(local, 6) }}>
          <span style={{ color: SIGNAL }}>$</span> vigilis generate https://your-app.com --run
        </div>
        <pre style={{ margin: '14px 0 0', fontFamily: MONO, whiteSpace: 'pre-wrap', color: DIM, fontSize: 27 }}>
          {shown}
          <span style={{ color: MIST }}>{caret}</span>
        </pre>
        <div style={{ opacity: line(local, dur - 34), color: SIGNAL, marginTop: 14 }}>
          ✓ wrote tests/checkout.spec.ts · ran green
        </div>
      </Panel>
    </Stage>
  );
}

// 02 — Gate: a required CI check, fail-closed
function Gate({ local, dur }: { local: number; dur: number }) {
  return (
    <Stage local={local} dur={dur}>
      <Eyebrow>02 · Gate</Eyebrow>
      <Panel title="github actions · required check">
        <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
          <div style={{ fontSize: 64, color: ALERT }}>✕</div>
          <div>
            <div style={{ color: MIST }}>Required check · QA Gate</div>
            <div style={{ color: ALERT, fontSize: 26 }}>FAILING — deploy blocked</div>
          </div>
        </div>
        <div style={{ opacity: line(local, 48), color: DIM, marginTop: 22, fontSize: 26 }}>
          a spec just broke. before anything ships, Vigilis asks: <span style={{ color: MIST }}>what kind of failure is this?</span>
        </div>
      </Panel>
    </Stage>
  );
}

// 03 — Triage: classify the failure; the refusal contract
function Triage({ local, dur, fps }: { local: number; dur: number; fps: number }) {
  const stamp = spring({ frame: local - 26, fps, config: { damping: 10, mass: 0.6 } });
  return (
    <Stage local={local} dur={dur}>
      <Eyebrow>03 · Triage</Eyebrow>
      <div style={{ fontFamily: MONO, fontSize: 27, color: DIM, marginBottom: 24 }}>
        classifying failure… <span style={{ color: MIST }}>bug · drift · flake</span>
      </div>
      <Stamp stamp={stamp} color={AMBER}>
        DOM-DRIFT — safe to heal
      </Stamp>
      <div style={{ opacity: line(local, 52), marginTop: 30, fontFamily: MONO, fontSize: 27, color: DIM }}>
        locator renamed · behaviour unchanged
      </div>
      <div style={{ opacity: line(local, 68), marginTop: 12, fontFamily: SANS, fontSize: 28, color: MIST }}>
        A real bug gets <span style={{ color: ALERT, fontWeight: 700 }}>refused</span> — the gate stays blocked. Fail-closed.
      </div>
    </Stage>
  );
}

// 04 — Heal: fix drift, re-verify, open a PR, unblock
function Heal({ local, dur }: { local: number; dur: number }) {
  const rows = [
    { at: 12, el: <span><span style={{ color: DIM }}>heal&nbsp;&nbsp;&nbsp;→</span> rewrote the stale locator</span> },
    { at: 34, el: <span><span style={{ color: DIM }}>verify&nbsp;→</span> <span style={{ color: SIGNAL }}>re-ran the spec · green</span></span> },
    { at: 56, el: <span><span style={{ color: DIM }}>pr&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;→</span> #42 opened for review</span> },
    { at: 78, el: <span><span style={{ color: DIM }}>gate&nbsp;&nbsp;&nbsp;→</span> <span style={{ color: SIGNAL }}>✓ QA Gate passing — deploy unblocked</span></span> },
  ];
  return (
    <Stage local={local} dur={dur}>
      <Eyebrow>04 · Heal</Eyebrow>
      <Panel title="vigilis heal">
        {rows.map((r) => (
          <div key={r.at} style={{ opacity: line(local, r.at) }}>{r.el}</div>
        ))}
      </Panel>
    </Stage>
  );
}

// 05 — Attest: hash-chained receipt, independent notary, offline verify
function Attest({ local, dur, fps }: { local: number; dur: number; fps: number }) {
  const stamp = spring({ frame: local - 66, fps, config: { damping: 11, mass: 0.7 } });
  const rows = [
    { at: 10, el: <span><span style={{ color: DIM }}>receipt&nbsp;→</span> every tool call + decision, hash-chained</span> },
    { at: 30, el: <span><span style={{ color: DIM }}>notary&nbsp;&nbsp;→</span> Treeship · independent</span> },
    { at: 50, el: <span><span style={{ color: DIM }}>check&nbsp;&nbsp;&nbsp;→</span> vigilis verify · offline, no secrets</span> },
  ];
  return (
    <Stage local={local} dur={dur}>
      <Eyebrow>05 · Attest</Eyebrow>
      <Panel title="receipts, not promises">
        {rows.map((r) => (
          <div key={r.at} style={{ opacity: line(local, r.at) }}>{r.el}</div>
        ))}
        <div style={{ marginTop: 24 }}>
          <Stamp stamp={stamp} color={SIGNAL}>
            🔗 chain intact · verifiable · auditable
          </Stamp>
        </div>
      </Panel>
    </Stage>
  );
}

// Outro — brand + install
function Outro({ local, dur, fps }: { local: number; dur: number; fps: number }) {
  const pop = spring({ frame: local - 6, fps, config: { damping: 12 } });
  return (
    <Stage local={local} dur={dur}>
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            transform: `scale(${0.85 + 0.15 * pop})`,
            opacity: pop,
            fontFamily: MONO,
            fontSize: 74,
            fontWeight: 700,
            color: MIST,
            letterSpacing: 3,
          }}
        >
          <span style={{ color: AMBER }}>[</span>VIGILIS<span style={{ color: AMBER }}>]</span>
        </div>
        <div style={{ opacity: line(local, 22), marginTop: 24, fontFamily: SANS, fontSize: 44, fontWeight: 700, color: MIST, letterSpacing: -1 }}>
          Generate · Gate · Triage · Heal · Attest
        </div>
        <div style={{ opacity: line(local, 40), marginTop: 40, display: 'inline-flex', alignItems: 'center', gap: 18 }}>
          <span style={{ fontFamily: MONO, fontSize: 30, color: MIST, background: PANEL, border: `1px solid ${HAIR2}`, borderRadius: 10, padding: '14px 26px' }}>
            <span style={{ color: SIGNAL }}>$</span> npm i -D vigilis
          </span>
          <span style={{ fontFamily: MONO, fontSize: 30, color: SIGNAL }}>vigilis.dev</span>
        </div>
      </div>
    </Stage>
  );
}

// scene durations (frames @30fps)
const D_GEN = 135;
const D_GATE = 108;
const D_TRIAGE = 120;
const D_HEAL = 120;
const D_ATTEST = 132;
const D_OUTRO = 96;

const T_GEN = 0;
const T_GATE = T_GEN + D_GEN;
const T_TRIAGE = T_GATE + D_GATE;
const T_HEAL = T_TRIAGE + D_TRIAGE;
const T_ATTEST = T_HEAL + D_HEAL;
const T_OUTRO = T_ATTEST + D_ATTEST;

export const VIGILIS_LOOP_FRAMES = T_OUTRO + D_OUTRO; // 711 @30fps = 23.7s

export const VigilisLoop = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: VOID }}>
      <Bg />
      <Brand />
      <Sequence from={T_GEN} durationInFrames={D_GEN}>
        <Generate local={frame - T_GEN} dur={D_GEN} />
      </Sequence>
      <Sequence from={T_GATE} durationInFrames={D_GATE}>
        <Gate local={frame - T_GATE} dur={D_GATE} />
      </Sequence>
      <Sequence from={T_TRIAGE} durationInFrames={D_TRIAGE}>
        <Triage local={frame - T_TRIAGE} dur={D_TRIAGE} fps={fps} />
      </Sequence>
      <Sequence from={T_HEAL} durationInFrames={D_HEAL}>
        <Heal local={frame - T_HEAL} dur={D_HEAL} />
      </Sequence>
      <Sequence from={T_ATTEST} durationInFrames={D_ATTEST}>
        <Attest local={frame - T_ATTEST} dur={D_ATTEST} fps={fps} />
      </Sequence>
      <Sequence from={T_OUTRO} durationInFrames={D_OUTRO}>
        <Outro local={frame - T_OUTRO} dur={D_OUTRO} fps={fps} />
      </Sequence>
    </AbsoluteFill>
  );
};

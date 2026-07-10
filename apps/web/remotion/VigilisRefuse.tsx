import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

// Site palette
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
        backgroundImage: `radial-gradient(700px 500px at 50% -8%, ${SIGNAL}14, transparent 60%), radial-gradient(600px 400px at 90% 10%, ${AMBER}0a, transparent 55%), linear-gradient(${HAIR}1a 1px, transparent 1px), linear-gradient(90deg, ${HAIR}1a 1px, transparent 1px)`,
        backgroundSize: 'auto, auto, 72px 72px, 72px 72px',
      }}
    />
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
        transform: `translateY(${y}px)`,
      }}
    >
      <div style={{ width: '100%', maxWidth: 900 }}>{children}</div>
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
        marginBottom: 34,
      }}
    >
      {children}
    </div>
  );
}

function line(local: number, at: number) {
  return interpolate(local, [at, at + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

// 1 — Hook
function Hook({ local, dur }: { local: number; dur: number }) {
  return (
    <Stage local={local} dur={dur}>
      <Eyebrow>The QA gate for AI-written code</Eyebrow>
      <div style={{ fontFamily: SANS, fontWeight: 800, color: MIST, fontSize: 74, lineHeight: 1.08, letterSpacing: -1 }}>
        Your AI just made a<br />failing test pass.
      </div>
      <div
        style={{
          opacity: line(local, 42),
          marginTop: 40,
          fontFamily: SANS,
          fontSize: 44,
          fontWeight: 600,
          color: AMBER,
        }}
      >
        Did it fix the bug — or hide it?
      </div>
    </Stage>
  );
}

// 2 — The run (terminal)
function Run({ local, dur }: { local: number; dur: number }) {
  const rows = [
    { at: 8, el: (<span><span style={{ color: SIGNAL }}>$</span> vigilis heal checkout.spec.ts</span>) },
    { at: 26, el: (<span style={{ color: ALERT }}>✗ 1 passed, 1 failed</span>) },
    { at: 44, el: (<span style={{ color: DIM }}>assert: expected <span style={{ color: SIGNAL }}>$49.00</span> · got <span style={{ color: ALERT }}>$0.00</span></span>) },
    { at: 62, el: (<span style={{ color: DIM }}>selectors all present — not a locator change</span>) },
  ];
  return (
    <Stage local={local} dur={dur}>
      <div style={{ background: PANEL, border: `1px solid ${HAIR2}`, borderRadius: 20, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 24px', borderBottom: `1px solid ${HAIR}` }}>
          <i style={{ width: 13, height: 13, borderRadius: '50%', background: '#ff5f56', display: 'inline-block' }} />
          <i style={{ width: 13, height: 13, borderRadius: '50%', background: '#ffbd2e', display: 'inline-block' }} />
          <i style={{ width: 13, height: 13, borderRadius: '50%', background: '#27c93f', display: 'inline-block' }} />
          <span style={{ fontFamily: MONO, fontSize: 22, color: DIM, marginLeft: 12 }}>checkout regression</span>
        </div>
        <div style={{ padding: '30px 30px 36px', fontFamily: MONO, fontSize: 30, lineHeight: 2, color: MIST }}>
          {rows.map((r) => (
            <div key={r.at} style={{ opacity: line(local, r.at) }}>{r.el}</div>
          ))}
        </div>
      </div>
    </Stage>
  );
}

// 3 — Refuse (the money moment)
function Refuse({ local, dur, fps }: { local: number; dur: number; fps: number }) {
  const stamp = spring({ frame: local - 20, fps, config: { damping: 11, mass: 0.7 } });
  return (
    <Stage local={local} dur={dur}>
      <div style={{ fontFamily: MONO, fontSize: 26, color: DIM, letterSpacing: 3, marginBottom: 26 }}>VERDICT</div>
      <div
        style={{
          display: 'inline-block',
          transform: `scale(${0.7 + 0.3 * stamp}) rotate(${-3 + 3 * stamp}deg)`,
          opacity: stamp,
          border: `3px solid ${ALERT}`,
          borderRadius: 18,
          padding: '22px 40px',
          color: ALERT,
          fontFamily: SANS,
          fontSize: 60,
          fontWeight: 800,
          letterSpacing: -1,
          boxShadow: `0 0 60px -10px ${ALERT}66`,
        }}
      >
        REAL BUG — REFUSED TO HEAL
      </div>
      <div style={{ opacity: line(local, 40), marginTop: 34, fontFamily: MONO, fontSize: 32, color: MIST }}>
        build blocked · test untouched · bug surfaced
      </div>
      <div style={{ opacity: line(local, 56), marginTop: 14, fontFamily: SANS, fontSize: 30, color: DIM }}>
        It won't weaken the assertion that caught the bug.
      </div>
    </Stage>
  );
}

// 4 — Sign
function Sign({ local, dur, fps }: { local: number; dur: number; fps: number }) {
  const seal = spring({ frame: local - 16, fps, config: { damping: 12 } });
  return (
    <Stage local={local} dur={dur}>
      <div
        style={{
          transform: `scale(${0.8 + 0.2 * seal})`,
          opacity: seal,
          fontFamily: SANS,
          fontWeight: 800,
          fontSize: 52,
          color: SIGNAL,
          marginBottom: 8,
        }}
      >
        🔏 Sealed by an independent notary
      </div>
      <div style={{ opacity: line(local, 34), fontFamily: MONO, fontSize: 34, color: MIST, marginTop: 22 }}>
        ✓ verified · 21 artifacts · chain intact
      </div>
      <div style={{ opacity: line(local, 52), fontFamily: SANS, fontSize: 30, color: DIM, marginTop: 26, lineHeight: 1.5 }}>
        Proof of what the agent did — verifiable and auditable.
        <br />Not "guaranteed correct." A stronger promise, because it holds up.
      </div>
    </Stage>
  );
}

// 5 — CTA
function Cta({ local, dur }: { local: number; dur: number }) {
  return (
    <Stage local={local} dur={dur}>
      <div style={{ fontFamily: MONO, fontSize: 54, fontWeight: 700, color: MIST, letterSpacing: 2 }}>
        <span style={{ color: AMBER }}>[</span>VIGILIS<span style={{ color: AMBER }}>]</span>
      </div>
      <div style={{ marginTop: 26, fontFamily: SANS, fontSize: 60, fontWeight: 800, color: MIST, letterSpacing: -1, lineHeight: 1.1 }}>
        The trust layer for<br />autonomous testing.
      </div>
      <div style={{ opacity: line(local, 34), marginTop: 40, display: 'inline-flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontFamily: MONO, fontSize: 30, color: MIST, background: PANEL, border: `1px solid ${HAIR2}`, borderRadius: 10, padding: '14px 24px' }}>
          <span style={{ color: SIGNAL }}>$</span> npm i -D vigilis
        </span>
        <span style={{ fontFamily: MONO, fontSize: 30, color: SIGNAL }}>vigilis.dev</span>
      </div>
    </Stage>
  );
}

// scene durations (frames @30fps)
const D_HOOK = 96;
const D_RUN = 126;
const D_REFUSE = 132;
const D_SIGN = 108;
const D_CTA = 108;

// cumulative start offsets
const T_HOOK = 0;
const T_RUN = T_HOOK + D_HOOK;
const T_REFUSE = T_RUN + D_RUN;
const T_SIGN = T_REFUSE + D_REFUSE;
const T_CTA = T_SIGN + D_SIGN;

export const VIGILIS_REFUSE_FRAMES = T_CTA + D_CTA; // 570 @30fps = 19s

export const VigilisRefuse = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: VOID }}>
      <Bg />
      <Sequence from={T_HOOK} durationInFrames={D_HOOK}>
        <Hook local={frame - T_HOOK} dur={D_HOOK} />
      </Sequence>
      <Sequence from={T_RUN} durationInFrames={D_RUN}>
        <Run local={frame - T_RUN} dur={D_RUN} />
      </Sequence>
      <Sequence from={T_REFUSE} durationInFrames={D_REFUSE}>
        <Refuse local={frame - T_REFUSE} dur={D_REFUSE} fps={fps} />
      </Sequence>
      <Sequence from={T_SIGN} durationInFrames={D_SIGN}>
        <Sign local={frame - T_SIGN} dur={D_SIGN} fps={fps} />
      </Sequence>
      <Sequence from={T_CTA} durationInFrames={D_CTA}>
        <Cta local={frame - T_CTA} dur={D_CTA} />
      </Sequence>
    </AbsoluteFill>
  );
};

import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

// Professional palette
const BG = '#0a0e17';
const PANEL = '#111826';
const HAIR = '#1e293b';
const INK = '#e8edf5';
const DIM = '#94a3b8';
const FAINT = '#5b6b82';
const GREEN = '#34d399';
const BLUE = '#60a5fa';
const RED = '#f87171';
const AMBER = '#fbbf24';

const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

function Bg() {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG,
        backgroundImage: `radial-gradient(1100px 600px at 18% -10%, ${BLUE}12, transparent 60%), radial-gradient(900px 500px at 92% 110%, ${GREEN}10, transparent 60%), linear-gradient(${HAIR}0f 1px, transparent 1px), linear-gradient(90deg, ${HAIR}0f 1px, transparent 1px)`,
        backgroundSize: 'auto, auto, 80px 80px, 80px 80px',
      }}
    />
  );
}

function Stage({ children, local, dur }: { children: React.ReactNode; local: number; dur: number }) {
  const opacity = interpolate(local, [0, 14, dur - 14, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const y = interpolate(local, [0, 16], [22, 0], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ opacity, padding: '128px 150px', transform: `translateY(${y}px)` }}>
      {children}
    </AbsoluteFill>
  );
}

function fade(local: number, at: number) {
  return interpolate(local, [at, at + 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
}

function Eyebrow({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: MONO, fontSize: 26, letterSpacing: 7, color, textTransform: 'uppercase' }}>
      {children}
    </div>
  );
}

function H({ children, size = 78 }: { children: React.ReactNode; size?: number }) {
  return (
    <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: size, lineHeight: 1.06, letterSpacing: -1.5, color: INK, marginTop: 26, maxWidth: '20ch' }}>
      {children}
    </div>
  );
}

function Bullet({
  local,
  at,
  n,
  color,
  head,
  sub,
}: {
  local: number;
  at: number;
  n?: string;
  color: string;
  head: React.ReactNode;
  sub?: React.ReactNode;
}) {
  const o = fade(local, at);
  const x = interpolate(local, [at, at + 14], [-16, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ opacity: o, transform: `translateX(${x}px)`, display: 'flex', gap: 26, marginTop: 30 }}>
      <div
        style={{
          flex: 'none',
          width: n ? 52 : 16,
          height: n ? 52 : 16,
          marginTop: n ? 4 : 14,
          borderRadius: n ? 12 : 4,
          background: n ? 'transparent' : color,
          border: n ? `2px solid ${color}` : 'none',
          color,
          fontFamily: MONO,
          fontWeight: 700,
          fontSize: 26,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {n}
      </div>
      <div>
        <div style={{ fontFamily: SANS, fontSize: 40, fontWeight: 600, color: INK, lineHeight: 1.25 }}>{head}</div>
        {sub && <div style={{ fontFamily: SANS, fontSize: 31, color: DIM, marginTop: 8, lineHeight: 1.4, maxWidth: '46ch' }}>{sub}</div>}
      </div>
    </div>
  );
}

// 1 — Title
function Title({ local }: { local: number }) {
  return (
    <Stage local={local} dur={D_TITLE}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
        <Eyebrow color={GREEN}>End-to-end testing for reliability</Eyebrow>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 110, lineHeight: 1.02, letterSpacing: -3, color: INK, marginTop: 30 }}>
          Catching failures<br />before customers do.
        </div>
        <div style={{ opacity: fade(local, 34), marginTop: 46, fontFamily: SANS, fontSize: 38, color: DIM }}>
          <span style={{ color: INK, fontWeight: 600 }}>Piyush Pathak</span> · 13+ years in QA automation for production APIs &amp; distributed systems
        </div>
      </div>
    </Stage>
  );
}

// 2 — The problem
function Problem({ local }: { local: number }) {
  return (
    <Stage local={local} dur={D_PROBLEM}>
      <Eyebrow color={RED}>The problem</Eyebrow>
      <H>Breaking changes kept slipping to production.</H>
      <div style={{ marginTop: 20 }}>
        <Bullet local={local} at={30} color={RED} head="Thin automated coverage — regressions reached customers." />
        <Bullet local={local} at={60} color={RED} head="The hardest failures are cross-service" sub="a change in one place quietly breaks a workflow two services away — invisible inside a single repo." />
        <Bullet local={local} at={92} color={AMBER} head={<span>A customer finds it <span style={{ color: AMBER }}>before we do.</span></span>} />
      </div>
    </Stage>
  );
}

// 3 — Pyramid
function Pyramid({ local }: { local: number }) {
  const tiers = [
    { w: 900, label: 'Unit — fast, isolated', c: FAINT, at: 34 },
    { w: 640, label: 'Integration — service boundaries', c: BLUE, at: 52 },
    { w: 380, label: 'E2E — critical customer journeys', c: GREEN, at: 70 },
  ];
  return (
    <Stage local={local} dur={D_PYRAMID}>
      <Eyebrow color={GREEN}>The model</Eyebrow>
      <H>Weight the pyramid where the risk lives.</H>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 46 }}>
        {tiers.map((t) => (
          <div
            key={t.label}
            style={{
              opacity: fade(local, t.at),
              width: t.w,
              padding: '20px 0',
              textAlign: 'center',
              background: PANEL,
              border: `1px solid ${t.c}66`,
              boxShadow: `inset 0 0 0 1px ${t.c}22`,
              borderRadius: 12,
              fontFamily: MONO,
              fontSize: 27,
              color: t.c === FAINT ? DIM : t.c,
            }}
          >
            {t.label}
          </div>
        ))}
      </div>
      <div style={{ opacity: fade(local, 92), textAlign: 'center', marginTop: 32, fontFamily: SANS, fontSize: 32, color: DIM }}>
        A few E2E tests over the critical journeys — front to back, across services, the way a real user experiences it.
      </div>
    </Stage>
  );
}

// 4 — Keeping E2E reliable
function Reliable({ local }: { local: number }) {
  return (
    <Stage local={local} dur={D_RELIABLE}>
      <Eyebrow color={GREEN}>Keeping E2E reliable</Eyebrow>
      <H size={64}>A flaky suite is worse than none — people stop trusting it.</H>
      <div style={{ marginTop: 14 }}>
        <Bullet local={local} at={40} n="1" color={GREEN} head="Stable fixtures &amp; mocks" sub={<span>Built an in-house mocking framework at Shutterstock (&ldquo;Midlevel&rdquo;) to test against flaky dependencies — other teams adopted it.</span>} />
        <Bullet local={local} at={130} n="2" color={GREEN} head="Wait on real conditions, never arbitrary waits" sub="the only reliable way to test async and background workflows without false failures." />
        <Bullet local={local} at={240} n="3" color={GREEN} head="Make failures diagnostic" sub={<span>clear reporting, logs, and traces — a red test tells you <i>exactly</i> what broke.</span>} />
        <Bullet local={local} at={340} n="4" color={GREEN} head="Every customer defect becomes a permanent regression test" sub="so the same bug can never escape twice." />
      </div>
    </Stage>
  );
}

// 5 — Gate + results
function Gate({ local, fps }: { local: number; fps: number }) {
  const pop = spring({ frame: local - 70, fps, config: { damping: 13 } });
  return (
    <Stage local={local} dur={D_GATE}>
      <Eyebrow color={BLUE}>Wire it into CI/CD</Eyebrow>
      <H>A quality gate on every merge and deploy.</H>
      <div style={{ marginTop: 8 }}>
        <Bullet local={local} at={30} color={BLUE} head="Breaking changes caught before merge and before deploy — not by a customer in production." />
      </div>
      <div style={{ opacity: fade(local, 60), display: 'flex', gap: 26, marginTop: 54 }}>
        <div style={{ transform: `scale(${0.9 + 0.1 * pop})`, background: PANEL, border: `1px solid ${GREEN}55`, borderRadius: 16, padding: '30px 44px' }}>
          <div style={{ fontFamily: SANS, fontSize: 30, color: DIM }}>Coverage, gated on every deploy</div>
          <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 66, color: INK, marginTop: 6 }}>
            ~60% <span style={{ color: FAINT }}>→</span> <span style={{ color: GREEN }}>~90%</span>
          </div>
        </div>
        <div style={{ background: PANEL, border: `1px solid ${HAIR}`, borderRadius: 16, padding: '30px 44px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontFamily: SANS, fontSize: 32, color: INK }}>↓ Escaped defects dropped</div>
          <div style={{ fontFamily: SANS, fontSize: 32, color: INK, marginTop: 12 }}>↓ Manual release-checking — the automated checks were trusted</div>
        </div>
      </div>
    </Stage>
  );
}

// 6 — Close
function Close({ local }: { local: number }) {
  return (
    <Stage local={local} dur={D_CLOSE}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 82, lineHeight: 1.08, letterSpacing: -2, color: INK, maxWidth: '22ch' }}>
          Catch cross-service failures <span style={{ color: GREEN }}>before</span> they reach production.
        </div>
        <div style={{ opacity: fade(local, 34), marginTop: 40, fontFamily: SANS, fontSize: 38, color: DIM }}>
          Safer releases · faster diagnosis · hands-on for years.
        </div>
        <div style={{ opacity: fade(local, 60), marginTop: 48, fontFamily: MONO, fontSize: 32, color: GREEN }}>
          Let&apos;s dig into your highest-risk workflows. — Piyush
        </div>
      </div>
    </Stage>
  );
}

// durations (frames @30fps)
const D_TITLE = 390;
const D_PROBLEM = 690;
const D_PYRAMID = 690;
const D_RELIABLE = 1620;
const D_GATE = 810;
const D_CLOSE = 540;

const T_TITLE = 0;
const T_PROBLEM = T_TITLE + D_TITLE;
const T_PYRAMID = T_PROBLEM + D_PROBLEM;
const T_RELIABLE = T_PYRAMID + D_PYRAMID;
const T_GATE = T_RELIABLE + D_RELIABLE;
const T_CLOSE = T_GATE + D_GATE;

export const LOOM_RELIABILITY_FRAMES = T_CLOSE + D_CLOSE; // ~4740 @30fps ≈ 158s

export const LoomReliability = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <Bg />
      <Sequence from={T_TITLE} durationInFrames={D_TITLE}>
        <Title local={frame - T_TITLE} />
      </Sequence>
      <Sequence from={T_PROBLEM} durationInFrames={D_PROBLEM}>
        <Problem local={frame - T_PROBLEM} />
      </Sequence>
      <Sequence from={T_PYRAMID} durationInFrames={D_PYRAMID}>
        <Pyramid local={frame - T_PYRAMID} />
      </Sequence>
      <Sequence from={T_RELIABLE} durationInFrames={D_RELIABLE}>
        <Reliable local={frame - T_RELIABLE} />
      </Sequence>
      <Sequence from={T_GATE} durationInFrames={D_GATE}>
        <Gate local={frame - T_GATE} fps={fps} />
      </Sequence>
      <Sequence from={T_CLOSE} durationInFrames={D_CLOSE}>
        <Close local={frame - T_CLOSE} />
      </Sequence>
    </AbsoluteFill>
  );
};

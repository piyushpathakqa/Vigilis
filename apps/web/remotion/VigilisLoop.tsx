import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const CANVAS = '#05060a';
const INK = '#e6edf3';
const MUTED = '#9fb3d1';
const CYAN = '#22d3ee';
const INDIGO = '#6366f1';
const VIOLET = '#a78bfa';
const RED = '#f87171';
const GREEN = '#4ade80';

const MONO =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';
const SANS = '"Space Grotesk", ui-sans-serif, system-ui, sans-serif';

function GridBg() {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: CANVAS,
        backgroundImage: `linear-gradient(${INDIGO}22 1px, transparent 1px), linear-gradient(90deg, ${INDIGO}22 1px, transparent 1px)`,
        backgroundSize: '64px 64px',
      }}
    />
  );
}

function Orb({ frame }: { frame: number }) {
  const pulse = 1 + 0.05 * Math.sin((frame / 30) * Math.PI);
  return (
    <div
      style={{
        position: 'absolute',
        top: 90,
        left: '50%',
        transform: `translateX(-50%) scale(${pulse})`,
        width: 120,
        height: 120,
        borderRadius: '50%',
        background: `radial-gradient(circle at 50% 50%, ${CYAN} 0%, ${INDIGO} 45%, #0b1020 78%)`,
        boxShadow: `0 0 80px 12px ${CYAN}66`,
      }}
    />
  );
}

function Label({ n, text }: { n: string; text: string }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 36 }}>
      <div style={{ fontFamily: MONO, fontSize: 28, color: CYAN, letterSpacing: 4 }}>{n}</div>
      <div style={{ fontFamily: SANS, fontSize: 64, fontWeight: 700, color: INK }}>{text}</div>
    </div>
  );
}

function StageShell({
  children,
  local,
  dur,
}: {
  children: React.ReactNode;
  local: number;
  dur: number;
}) {
  // fade in over first 12 frames, out over last 12
  const opacity = interpolate(
    local,
    [0, 12, dur - 12, dur],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  return (
    <AbsoluteFill
      style={{
        opacity,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 120,
      }}
    >
      <div style={{ width: 1100, maxWidth: '80%' }}>{children}</div>
    </AbsoluteFill>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 18,
        padding: '40px 48px',
        fontFamily: MONO,
        fontSize: 30,
        lineHeight: 1.7,
        color: INK,
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

function Generate({ local, dur }: { local: number; dur: number }) {
  const fullText = SPEC_LINES.join('\n');
  const chars = Math.floor(
    interpolate(local, [10, dur - 20], [0, fullText.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );
  const shown = fullText.slice(0, chars);
  const caret = local % 30 < 15 ? '▋' : ' ';
  return (
    <StageShell local={local} dur={dur}>
      <Label n="01" text="Generate" />
      <Card>
        <pre style={{ margin: 0, fontFamily: MONO, whiteSpace: 'pre-wrap', color: CYAN }}>
          {shown}
          <span style={{ color: INK }}>{caret}</span>
        </pre>
      </Card>
    </StageShell>
  );
}

function Gate({ local, dur, fps }: { local: number; dur: number; fps: number }) {
  // flip red -> green around the midpoint
  const flip = interpolate(local, [dur * 0.45, dur * 0.6], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const color = flip < 0.5 ? RED : GREEN;
  const mark = flip < 0.5 ? '✕' : '✓';
  const status = flip < 0.5 ? 'FAILING — deploy blocked' : 'PASSING — deploy unblocked';
  const pop = spring({ frame: local - Math.round(dur * 0.55), fps, config: { damping: 12 } });
  return (
    <StageShell local={local} dur={dur}>
      <Label n="02" text="Gate" />
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <div
            style={{
              transform: `scale(${flip < 0.5 ? 1 : 1 + 0.2 * pop})`,
              fontSize: 72,
              color,
            }}
          >
            {mark}
          </div>
          <div>
            <div style={{ color: INK }}>Required check · argus-qa</div>
            <div style={{ color, fontSize: 26 }}>{status}</div>
          </div>
        </div>
      </Card>
    </StageShell>
  );
}

function Triage({ local, dur, fps }: { local: number; dur: number; fps: number }) {
  const stamp = spring({ frame: local - 24, fps, config: { damping: 10, mass: 0.6 } });
  return (
    <StageShell local={local} dur={dur}>
      <Label n="03" text="Triage" />
      <Card>
        <div style={{ color: MUTED }}>classifying failure…</div>
        <div
          style={{
            marginTop: 18,
            display: 'inline-block',
            transform: `scale(${0.6 + 0.4 * stamp}) rotate(${-4 + 4 * stamp}deg)`,
            opacity: stamp,
            border: `2px solid ${VIOLET}`,
            borderRadius: 12,
            padding: '10px 24px',
            color: VIOLET,
            fontSize: 38,
            fontWeight: 700,
          }}
        >
          DOM-DRIFT · not a real bug
        </div>
      </Card>
    </StageShell>
  );
}

function Heal({ local, dur }: { local: number; dur: number }) {
  const lines = [
    { t: 'heal   → rewrote stale locator', c: CYAN },
    { t: 'verify → 12 passed (green)', c: GREEN },
    { t: 'pr     → #42 opened', c: INK },
    { t: '✓ verified · 21 artifacts · chain intact', c: VIOLET },
  ];
  return (
    <StageShell local={local} dur={dur}>
      <Label n="04" text="Heal" />
      <Card>
        {lines.map((ln, i) => {
          const at = 16 + i * 22;
          const o = interpolate(local, [at, at + 12], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <div key={ln.t} style={{ opacity: o, color: ln.c }}>
              {ln.t}
            </div>
          );
        })}
      </Card>
    </StageShell>
  );
}

export const VigilisLoop = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seg = 135;
  return (
    <AbsoluteFill style={{ backgroundColor: CANVAS }}>
      <GridBg />
      <Orb frame={frame} />
      <Sequence from={0} durationInFrames={seg}>
        <Generate local={frame} dur={seg} />
      </Sequence>
      <Sequence from={seg} durationInFrames={seg}>
        <Gate local={frame - seg} dur={seg} fps={fps} />
      </Sequence>
      <Sequence from={seg * 2} durationInFrames={seg}>
        <Triage local={frame - seg * 2} dur={seg} fps={fps} />
      </Sequence>
      <Sequence from={seg * 3} durationInFrames={seg}>
        <Heal local={frame - seg * 3} dur={seg} />
      </Sequence>
    </AbsoluteFill>
  );
};

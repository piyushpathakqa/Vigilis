import { AbsoluteFill } from 'remotion';

// Site palette (matches globals.css / VigilisLoop / VigilisRefuse)
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

function Pill({ color, label, sub }: { color: string; label: string; sub: string }) {
  return (
    <div
      style={{
        border: `2px solid ${color}`,
        background: PANEL,
        borderRadius: 14,
        padding: '20px 34px',
        textAlign: 'center',
        boxShadow: `0 0 44px -14px ${color}88`,
      }}
    >
      <div style={{ fontFamily: SANS, fontSize: 40, fontWeight: 800, color, letterSpacing: -0.5 }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 22, color: DIM, marginTop: 8 }}>{sub}</div>
    </div>
  );
}

export const VigilisThumb = () => (
  <AbsoluteFill
    style={{
      backgroundColor: VOID,
      backgroundImage: `radial-gradient(1000px 640px at 50% -12%, ${SIGNAL}14, transparent 60%), radial-gradient(760px 520px at 92% 6%, ${AMBER}0c, transparent 55%), linear-gradient(${HAIR}1a 1px, transparent 1px), linear-gradient(90deg, ${HAIR}1a 1px, transparent 1px)`,
      backgroundSize: 'auto, auto, 72px 72px, 72px 72px',
      justifyContent: 'center',
      alignItems: 'center',
    }}
  >
    {/* brand */}
    <div style={{ position: 'absolute', top: 64, left: 0, right: 0, textAlign: 'center' }}>
      <div style={{ fontFamily: MONO, fontSize: 40, fontWeight: 700, letterSpacing: 4, color: MIST }}>
        <span style={{ color: AMBER }}>[</span>VIGILIS<span style={{ color: AMBER }}>]</span>
      </div>
      <div style={{ marginTop: 12, fontFamily: MONO, fontSize: 20, letterSpacing: 5, color: DIM, textTransform: 'uppercase' }}>
        The QA gate for AI-written code
      </div>
    </div>

    {/* hook */}
    <div style={{ textAlign: 'center', marginTop: -40 }}>
      <div style={{ fontFamily: SANS, fontSize: 78, fontWeight: 800, color: MIST, letterSpacing: -1.5, lineHeight: 1.12 }}>
        Your AI just made a failing test pass.
      </div>
      <div style={{ marginTop: 18, fontFamily: SANS, fontSize: 62, fontWeight: 800, color: AMBER, letterSpacing: -1 }}>
        Did it fix the bug — or hide it?
      </div>

      {/* three verdicts */}
      <div style={{ display: 'flex', gap: 28, justifyContent: 'center', marginTop: 64 }}>
        <Pill color={SIGNAL} label="Healed" sub="dom-drift · PR opened" />
        <Pill color={AMBER} label="Quarantined" sub="flake · flagged" />
        <Pill color={ALERT} label="Refused" sub="real bug · gate blocked" />
      </div>
    </div>

    {/* footer */}
    <div
      style={{
        position: 'absolute',
        bottom: 56,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 22,
        fontFamily: MONO,
        fontSize: 26,
      }}
    >
      <span style={{ color: MIST, background: PANEL, border: `1px solid ${HAIR2}`, borderRadius: 10, padding: '12px 22px' }}>
        <span style={{ color: SIGNAL }}>$</span> npm i -D vigilis
      </span>
      <span style={{ color: SIGNAL }}>vigilis.dev</span>
    </div>
  </AbsoluteFill>
);

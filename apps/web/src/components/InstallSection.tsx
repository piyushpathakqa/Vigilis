'use client';

import { useState } from 'react';
import { motion } from 'motion/react';

type Surface = 'cli' | 'mcp';
type Client = 'claude-code' | 'claude-desktop' | 'cursor';

const CLI_STEPS = [
  { n: 1, label: 'Install in your Playwright, Cypress, or Selenium project', code: 'npm i -D vigilis' },
  { n: 2, label: 'Scaffold config — auto-detects your framework (or pass --framework)', code: 'npx vigilis init' },
  { n: 3, label: 'Generate a real test and run it', code: 'npx vigilis generate https://your-app.com --run' },
  { n: 4, label: 'Heal drift → verified PR + signed receipt', code: 'npx vigilis heal https://your-app.com --spec tests/login.spec.ts' },
];

const DESKTOP_JSON = `{
  "mcpServers": {
    "vigilis": { "command": "npx", "args": ["-y", "vigilis-mcp"] }
  }
}`;

const MCP: Record<Client, { label: string; steps: { n: number; label: string; code: string }[] }> = {
  'claude-code': {
    label: 'Claude Code',
    steps: [{ n: 1, label: 'Add the server (one command)', code: 'claude mcp add vigilis -- npx -y vigilis-mcp' }],
  },
  'claude-desktop': {
    label: 'Claude Desktop',
    steps: [{ n: 1, label: 'Settings → Developer → Edit Config, paste, restart', code: DESKTOP_JSON }],
  },
  cursor: {
    label: 'Cursor',
    steps: [{ n: 1, label: 'Add to ~/.cursor/mcp.json', code: DESKTOP_JSON }],
  },
};

function CopyBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="glass relative rounded-xl p-4 pr-20">
      <pre className="overflow-x-auto font-mono text-sm leading-relaxed text-[var(--color-ink)]">
        <code>{code}</code>
      </pre>
      <button
        onClick={copy}
        className="absolute right-3 top-3 rounded-md border border-white/10 bg-white/5 px-3 py-1 font-mono text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        {copied ? 'Copied ✓' : 'Copy'}
      </button>
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        'rounded-lg px-4 py-2 text-sm font-semibold transition-colors ' +
        (active ? 'bg-white text-black' : 'glass text-[var(--color-muted)] hover:text-[var(--color-ink)]')
      }
    >
      {children}
    </button>
  );
}

function Steps({ steps }: { steps: { n: number; label: string; code: string }[] }) {
  return (
    <div className="mt-6 flex flex-col gap-5">
      {steps.map((s) => (
        <div key={s.n} className="flex gap-4">
          <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--color-cyan)]/40 font-mono text-sm text-[var(--color-cyan)]">
            {s.n}
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-sm text-[var(--color-muted)]">{s.label}</p>
            <CopyBlock code={s.code} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function InstallSection() {
  const [surface, setSurface] = useState<Surface>('cli');
  const [client, setClient] = useState<Client>('claude-code');

  return (
    <section id="install" className="mx-auto max-w-4xl px-6 py-24">
      <div className="flex items-center justify-center gap-3">
        <h2 className="text-center text-3xl font-bold">MCP &amp; CLI</h2>
        <span className="rounded-full border border-[var(--color-violet)]/40 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-[var(--color-violet)]">
          New
        </span>
      </div>
      <p className="mt-3 text-center text-[var(--color-muted)]">
        Drop Vigilis into your Playwright, Cypress, or Selenium project, or drive it from your AI editor over MCP.
      </p>

      {/* surface toggle */}
      <div className="mt-10 flex justify-center gap-3">
        <Pill active={surface === 'cli'} onClick={() => setSurface('cli')}>
          ⌘ CLI
        </Pill>
        <Pill active={surface === 'mcp'} onClick={() => setSurface('mcp')}>
          ⧉ MCP
        </Pill>
      </div>

      <motion.div
        key={surface}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mt-8"
      >
        {surface === 'cli' ? (
          <>
            <Steps steps={CLI_STEPS} />
            <p className="mt-5 text-xs text-[var(--color-muted)]">
              Needs an Anthropic API key + chromium (<code>npx playwright install chromium</code>).
              Generated files are standard Playwright specs — yours to keep.
            </p>
          </>
        ) : (
          <>
            <div className="flex flex-wrap justify-center gap-2">
              {(Object.keys(MCP) as Client[]).map((c) => (
                <Pill key={c} active={client === c} onClick={() => setClient(c)}>
                  {MCP[c].label}
                </Pill>
              ))}
            </div>
            <Steps steps={MCP[client].steps} />
            <p className="mt-5 text-xs text-[var(--color-muted)]">
              No API key needed — your editor&apos;s model is the brain; the server holds the live
              browser. Then just ask it to <em>generate</em> or <em>triage</em> a test.
            </p>
          </>
        )}
      </motion.div>
    </section>
  );
}

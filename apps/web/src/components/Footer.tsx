export function Footer() {
  return (
    <footer className="mx-auto max-w-5xl px-6 py-20">
      <h2 className="text-2xl font-bold">Get started in seconds</h2>
      <pre className="glass mt-6 overflow-x-auto rounded-xl p-6 font-mono text-sm leading-relaxed">
        <code>
          <span className="text-[var(--color-muted)]"># in your Playwright project</span>
          {'\n'}npm i -D vigilis
          {'\n'}npx vigilis init
          {'\n'}npx vigilis generate https://your-app.com --run
          {'\n'}
          {'\n'}<span className="text-[var(--color-muted)]"># or drive it from Claude (MCP)</span>
          {'\n'}npx -y vigilis-mcp
        </code>
      </pre>
      <p className="mt-3 text-xs text-[var(--color-muted)]">
        On npm:{' '}
        <a
          className="underline hover:text-[var(--color-ink)]"
          href="https://www.npmjs.com/package/vigilis"
          target="_blank"
          rel="noreferrer"
        >
          vigilis
        </a>{' '}
        · MIT · needs an Anthropic API key + chromium.
      </p>
      <nav className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-[var(--color-muted)]">
        <a className="hover:text-[var(--color-ink)]" href="https://github.com/piyushpathakqa/Vigilis">
          GitHub
        </a>
        <a className="hover:text-[var(--color-ink)]" href="https://github.com/piyushpathakqa/Vigilis/blob/main/docs/DEMO.md">
          Demo
        </a>
        <a className="hover:text-[var(--color-ink)]" href="https://github.com/piyushpathakqa/Vigilis/blob/main/docs/MCP.md">
          MCP
        </a>
        <a
          className="hover:text-[var(--color-ink)]"
          href="https://treeship.dev/receipt/ssn_3834e1bcc2651d7d"
          target="_blank"
          rel="noreferrer"
        >
          Verify a receipt
        </a>
      </nav>
      <p className="mt-8 text-xs text-[var(--color-muted)]">
        MIT · Built by Piyush Pathak · Provenance powered by{' '}
        <a
          className="underline hover:text-[var(--color-ink)]"
          href="https://www.treeship.dev"
          target="_blank"
          rel="noreferrer"
        >
          Treeship
        </a>{' '}
        (Zerker Lab)
      </p>
    </footer>
  );
}

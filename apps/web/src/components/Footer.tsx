export function Footer() {
  return (
    <footer className="mx-auto max-w-5xl px-6 py-20">
      <h2 className="text-2xl font-bold">Get started in seconds</h2>
      <p className="mt-3 text-[var(--color-muted)]">
        <code>npm i -D vigilis</code> → see the{' '}
        <a className="underline hover:text-[var(--color-ink)]" href="#install">
          MCP &amp; CLI
        </a>{' '}
        setup above. On npm:{' '}
        <a
          className="underline hover:text-[var(--color-ink)]"
          href="https://www.npmjs.com/package/vigilis"
          target="_blank"
          rel="noreferrer"
        >
          vigilis
        </a>{' '}
        ·{' '}
        <a
          className="underline hover:text-[var(--color-ink)]"
          href="https://www.npmjs.com/package/vigilis-mcp"
          target="_blank"
          rel="noreferrer"
        >
          vigilis-mcp
        </a>
        .
      </p>
      <nav className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-[var(--color-muted)]">
        <a className="hover:text-[var(--color-ink)]" href="https://github.com/piyushpathakqa/Vigilis">
          GitHub
        </a>
        <a className="hover:text-[var(--color-ink)]" href="#install">
          MCP &amp; CLI
        </a>
        <a className="hover:text-[var(--color-ink)]" href="https://github.com/piyushpathakqa/Vigilis/blob/main/docs/DEMO.md">
          Demo
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

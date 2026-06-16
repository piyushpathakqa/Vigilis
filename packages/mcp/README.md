# vigilis-mcp

The **Vigilis** MCP server — drive the QA tools (generate / triage / heal Playwright tests, plus
browser + DOM inspection) straight from **Claude Desktop** or **Claude Code** over the
[Model Context Protocol](https://modelcontextprotocol.io).

The client LLM (Claude) does the reasoning; this server holds the live browser and runs the tools.
**No Anthropic API key needed** — Claude is the brain. You do need a browser: `npx playwright install chromium` once.

🌐 [vigilis.dev](https://vigilis.dev) · 💻 [GitHub](https://github.com/piyushpathakqa/Vigilis) · CLI: [`vigilis`](https://www.npmjs.com/package/vigilis)

## Claude Code

```bash
claude mcp add vigilis -- npx -y vigilis-mcp
```

…or commit a project `.mcp.json`:

```json
{
  "mcpServers": {
    "vigilis": { "command": "npx", "args": ["-y", "vigilis-mcp"] }
  }
}
```

## Claude Desktop

Add to `claude_desktop_config.json` (Settings → Developer → Edit Config), then restart:

```json
{
  "mcpServers": {
    "vigilis": { "command": "npx", "args": ["-y", "vigilis-mcp"] }
  }
}
```

"vigilis" then appears in the tools menu. Ask Claude things like *"generate a Playwright test for
the login flow at http://localhost:3000"* or *"this spec is failing — is it a real bug or DOM
drift?"* and it drives the tools.

## What it exposes

The full Vigilis tool registry over MCP: `browser_navigate/click/type/snapshot`,
`dom_query/dom_testids`, `fs_read/write/list`, `playwright_run`, `report_verdict`.

MIT © Piyush Pathak · provenance powered by Treeship (Zerker Lab)

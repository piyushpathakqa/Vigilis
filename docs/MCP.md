# Using Vigilis as an MCP server

The [`vigilis-mcp`](https://www.npmjs.com/package/vigilis-mcp) package exposes Vigilis's QA tools
over the Model Context Protocol, so you can drive the **exact tools the agent uses** — `browser_*`,
`dom_*`, `fs_*`, `playwright_run` — from Claude Desktop or Claude Code. Your client's model becomes
the agent loop; the server holds the live browser.

> No `ANTHROPIC_API_KEY` is needed for the MCP server itself — it only executes tools (the
> reasoning happens in your client). It does launch headless Chromium on the first
> tool call, so run `npx playwright install chromium` once.

## Claude Code

```bash
claude mcp add vigilis -- npx -y vigilis-mcp
```
Or commit a project `.mcp.json`:
```json
{
  "mcpServers": {
    "vigilis": { "command": "npx", "args": ["-y", "vigilis-mcp"] }
  }
}
```

## Claude Desktop

Edit `claude_desktop_config.json` (macOS:
`~/Library/Application Support/Claude/claude_desktop_config.json`), then restart:
```json
{
  "mcpServers": {
    "vigilis": { "command": "npx", "args": ["-y", "vigilis-mcp"] }
  }
}
```
"vigilis" then appears in the tools menu — ask Claude to *generate a test for a URL* or *triage a
failing spec* and it drives the tools.

> Prefer pinning from a clone? `npx playwright install chromium` then point `command` at
> `node` + the built `packages/mcp/dist/index.js`. The `npx -y vigilis-mcp` form needs no checkout.

## Tools exposed

| Tool | What it does |
|------|--------------|
| `browser_navigate` / `browser_click` / `browser_type` | Drive the page |
| `browser_snapshot` | Cleaned HTML of the current page |
| `dom_query` / `dom_testids` | Inspect elements / list `data-testid`s |
| `fs_read` / `fs_write` / `fs_list` | Read/write files (sandboxed to the working dir) |
| `playwright_run` | Run a Playwright spec, get pass/fail |
| `web_search` / `web_fetch` | Search public framework docs / fetch public pages through Parallel |

## Try it

In your MCP client, ask: *"Navigate to http://localhost:3100/login, list the data-testids, log in
with demo/demo, then write a Playwright spec for the flow to tests/generated/login.spec.ts."* The
client will call the Vigilis tools to do it — the same tools `argus generate` uses, now driven by you.

## Public documentation lookup

The shared registry includes lazy `web_search` / `web_fetch` tools using
[Parallel Search MCP](https://docs.parallel.ai/integrations/mcp/search-mcp), with
Fast-mode search and no account or API key. Queries and fetched URLs are sent
to Parallel only when a tool is called. Send public documentation requests only.
Your MCP client's tool permissions still control which calls it makes.

To remove these tools, add `"env": { "VIGILIS_SEARCH": "off" }` to the Vigilis
server entry in your client configuration, then restart it. This also works as
a shell environment variable when starting `vigilis-mcp`. See [SEARCH.md](./SEARCH.md).

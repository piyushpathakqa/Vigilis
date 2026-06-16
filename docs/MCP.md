# Using Vigilis as an MCP server

`@argus/mcp` exposes Vigilis's QA tools over the Model Context Protocol, so you can drive the **exact
tools the agent uses** — `browser_*`, `dom_*`, `fs_*`, `playwright_run` — from Claude Desktop or
Claude Code. Your client's model becomes the agent loop; the server holds the live browser.

> No `ANTHROPIC_API_KEY` is needed for the MCP server itself — it only executes tools (the
> reasoning happens in your client). It does launch headless Chromium on the first browser/DOM
> tool call, so run `npx playwright install chromium` once.

## Build

```bash
pnpm install
pnpm build                       # produces packages/mcp/dist/index.js (the `argus-mcp` bin)
npx playwright install chromium  # one-time, for the browser tools
```

## Claude Code

```bash
claude mcp add argus -- node /ABSOLUTE/PATH/TO/argus/packages/mcp/dist/index.js
```
Or commit a project `.mcp.json`:
```json
{
  "mcpServers": {
    "argus": { "command": "node", "args": ["packages/mcp/dist/index.js"] }
  }
}
```

## Claude Desktop

Edit `claude_desktop_config.json` (macOS:
`~/Library/Application Support/Claude/claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "argus": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/argus/packages/mcp/dist/index.js"]
    }
  }
}
```
Restart Claude Desktop; "argus" appears in the tools menu.

## Tools exposed

| Tool | What it does |
|------|--------------|
| `browser_navigate` / `browser_click` / `browser_type` | Drive the page |
| `browser_snapshot` | Cleaned HTML of the current page |
| `dom_query` / `dom_testids` | Inspect elements / list `data-testid`s |
| `fs_read` / `fs_write` / `fs_list` | Read/write files (sandboxed to the working dir) |
| `playwright_run` | Run a Playwright spec, get pass/fail |

## Try it

In your MCP client, ask: *"Navigate to http://localhost:3100/login, list the data-testids, log in
with demo/demo, then write a Playwright spec for the flow to tests/generated/login.spec.ts."* The
client will call the Vigilis tools to do it — the same tools `argus generate` uses, now driven by you.

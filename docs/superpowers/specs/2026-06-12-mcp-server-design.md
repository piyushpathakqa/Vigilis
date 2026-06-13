# MCP Server — Design Spec (TRE-42)

> Status: approved 2026-06-12 (completion sweep). Implements **M4 / `TRE-42`**.
> Realizes DESIGN's "one core, two consumers": the same Tool Registry, now exposed over MCP.

## 1. Goal

A real stdio MCP server (`@argus/mcp`, bin `argus-mcp`) that exposes Argus's QA tools so a human in
Claude Desktop / Claude Code drives the **exact tools the agent uses** — `browser_*`, `dom_*`,
`fs_*`, `playwright_run`. The server holds the live Playwright-backed `ToolContext`; each MCP tool
call routes to `registry.execute`.

## 2. Why tools (not behaviors)

The MCP client is itself an LLM (Claude Desktop). Exposing the **raw tools** lets that LLM be the
agent loop — the natural MCP shape — rather than nesting a second Anthropic loop inside the server.
(Behaviors stay available via the CLI.)

## 3. Components (`packages/mcp/src/`)

### `server.ts` — `createArgusMcpServer`
```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createDefaultRegistry, type ToolContext } from '@argus/core';

export interface ArgusMcpOptions { getContext: () => Promise<ToolContext> | ToolContext; }

export function createArgusMcpServer(opts: ArgusMcpOptions): McpServer {
  const registry = createDefaultRegistry();
  const server = new McpServer({ name: 'argus-mcp', version: '0.0.0' });
  for (const tool of registry.toMcp()) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputSchema },
      async (args) => {
        const result = await registry.execute(tool.name, args, await opts.getContext());
        return { content: [{ type: 'text', text: result.content }], isError: result.isError ?? false };
      },
    );
  }
  return server;
}
```
`toMcp()` (TRE-31) already yields `{ name, description, inputSchema: ZodRawShape }`. `registry.
execute` re-validates the input (harmless) and never throws — failures come back as `isError`.

### `context.ts` — lazy real context
`createLazyContext()` → `{ getContext, close }`. On first call it launches chromium
(`createPlaywrightSession`) and builds `{ workspaceRoot: cwd, browser, runner:
new PlaywrightTestRunner({ cwd }) }`; subsequent calls reuse it. `close()` tears the browser down.
Lazy so merely starting the server doesn't spawn a browser.

### `index.ts` — the bin
Wraps a `main()`: build the lazy context, `createArgusMcpServer({ getContext })`, connect a
`StdioServerTransport`, and close the context on `SIGINT`/`SIGTERM`. Replaces the M0
`describeServer()` placeholder.

## 4. Testing (Vitest, in-memory — no browser, no stdio)

`server.test.ts`: build the server with a **minimal fake `ToolContext`** (a stub `BrowserSession`
whose `testids()` returns a known list), link a `Client` and the server via
`InMemoryTransport.createLinkedPair()`, then:
- `client.listTools()` → exactly the 10 registry tools.
- `client.callTool({ name: 'dom_testids', arguments: {} })` → routes to `registry.execute`; the
  result text contains the fake's testids.
This proves registration + routing without a real browser or stdio transport.

## 5. Non-goals

- MCP usage docs / Claude Desktop config snippet — **TRE-43** (next).
- Exposing behaviors as MCP tools (the CLI covers those).

## 6. Done when

- `argus-mcp` builds to `dist/index.js` and starts a stdio server exposing the 10 tools.
- `createArgusMcpServer` is integration-tested via the in-memory client/server pair.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` is green.

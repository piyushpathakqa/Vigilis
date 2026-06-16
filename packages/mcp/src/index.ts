#!/usr/bin/env node
/**
 * @argus/mcp — stdio MCP server exposing the Vigilis QA tool registry.
 *
 * Run via the `argus-mcp` bin (e.g. from a Claude Desktop / Claude Code MCP
 * config). The client LLM drives the tools; the server holds the live browser.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createVigilisMcpServer } from './server';
import { createLazyContext } from './context';

async function main(): Promise<void> {
  const lazy = createLazyContext();
  const server = createVigilisMcpServer({ getContext: lazy.getContext });

  const shutdown = async (): Promise<void> => {
    await lazy.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await server.connect(new StdioServerTransport());
}

main().catch((err: unknown) => {
  console.error('[argus-mcp] fatal:', err);
  process.exit(1);
});

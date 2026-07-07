import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createDefaultRegistry, type ToolContext } from '@argus/core';

export interface VigilisMcpOptions {
  /** Supplies the live tool context (browser session + runner + workspace). */
  getContext: () => Promise<ToolContext> | ToolContext;
}

/**
 * Build the Vigilis MCP server: every QA tool from the shared registry, exposed
 * over MCP. Each call routes to `registry.execute` against the provided context.
 */
export function createVigilisMcpServer(opts: VigilisMcpOptions): McpServer {
  const registry = createDefaultRegistry();
  const server = new McpServer({ name: 'vigilis-mcp', version: '0.4.1' });

  for (const tool of registry.toMcp()) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputSchema },
      async (args: Record<string, unknown>) => {
        const ctx = await opts.getContext();
        const result = await registry.execute(tool.name, args, ctx);
        return {
          content: [{ type: 'text' as const, text: result.content }],
          isError: result.isError ?? false,
        };
      },
    );
  }

  return server;
}

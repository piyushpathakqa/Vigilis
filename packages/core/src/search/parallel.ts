import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { ToolResult } from '../tools/types';

export type SearchTool = 'web_search' | 'web_fetch';

/** Injection seam for a caller's chosen search backend. No fallback on errors. */
export interface SearchProvider {
  call(name: SearchTool, args: Record<string, unknown>, signal?: AbortSignal): Promise<ToolResult>;
}

export const PARALLEL_MCP_URL = 'https://search.parallel.ai/mcp';
export const SEARCH_USER_AGENT = 'Vigilis (+https://github.com/piyushpathakqa/Vigilis)';

/** Anonymous Streamable HTTP MCP client. Connections are lazy and bounded per call. */
export class ParallelSearchProvider implements SearchProvider {
  private readonly sessionId = randomUUID();

  constructor(
    private readonly options: { timeoutMs?: number; fetch?: typeof globalThis.fetch } = {},
  ) {}

  async call(
    name: SearchTool,
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<ToolResult> {
    const timeoutMs = this.options.timeoutMs ?? 30_000;
    const deadline = AbortSignal.timeout(timeoutMs);
    const operation = signal ? AbortSignal.any([signal, deadline]) : deadline;
    const client = new Client({ name: 'vigilis', version: '0.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL(PARALLEL_MCP_URL), {
      requestInit: { headers: { 'User-Agent': SEARCH_USER_AGENT } },
      // Include handshake/discovery in the same deadline, not just tools/call.
      fetch: (url, init) =>
        (this.options.fetch ?? globalThis.fetch)(url, {
          ...init,
          signal: init?.signal ? AbortSignal.any([init.signal, operation]) : operation,
        }),
    });
    try {
      operation.throwIfAborted();
      await client.connect(transport);
      const tools = await client.listTools({}, { signal: operation, timeout: timeoutMs });
      if (!tools.tools.some((tool) => tool.name === name)) {
        throw new Error(`Parallel Search MCP does not expose ${name}`);
      }
      const result = await client.callTool(
        { name, arguments: { ...args, session_id: this.sessionId } },
        undefined,
        { signal: operation, timeout: timeoutMs },
      );
      const content = (result.content as { type: string; text?: string }[])
        .filter((block) => block.type === 'text' && typeof block.text === 'string')
        .map((block) => block.text)
        .join('\n');
      if (!content.trim())
        return { content: 'Parallel Search MCP returned no text.', isError: true };
      // Keep source URLs/excerpts and the MCP error flag intact for the agent.
      return { content, isError: result.isError === true };
    } catch (error) {
      return {
        content: operation.aborted
          ? deadline.aborted
            ? 'Web lookup timed out.'
            : 'Web lookup cancelled.'
          : `Web lookup failed: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    } finally {
      await client.close();
    }
  }
}

/** Explicit provider/disable wins; otherwise use the environment, then anonymous Parallel. */
export function resolveSearchProvider(search?: SearchProvider | false): SearchProvider | false {
  if (search !== undefined) return search;
  const mode = process.env.VIGILIS_SEARCH ?? 'parallel';
  if (mode === 'off') return false;
  if (mode === 'parallel') return new ParallelSearchProvider();
  throw new Error('VIGILIS_SEARCH must be "parallel" or "off".');
}

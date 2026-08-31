import { z } from 'zod';
import { defineTool, ToolError } from '../types';

const DEFAULT_LIMIT = 10;
const DEFAULT_TIMEOUT_MS = 15_000;

const youSearchResult = z.object({
  url: z.string(),
  title: z.string(),
  description: z.string().optional(),
  snippets: z.array(z.string()).optional(),
});

const youSearchResponse = z.object({
  results: z
    .object({
      web: z.array(youSearchResult).optional(),
      news: z.array(youSearchResult).optional(),
    })
    .optional(),
});

export function createWebSearchTool(opts?: { fetchFn?: typeof fetch }) {
  const fetchFn = opts?.fetchFn ?? globalThis.fetch;

  return defineTool({
    name: 'web_search',
    description: 'Search the web with You.com and return the top results.',
    input: z.object({
      query: z.string().describe('Search query'),
      limit: z.number().int().positive().max(20).optional().describe('Maximum results to return'),
    }),
    handler: async ({ query, limit = DEFAULT_LIMIT }, _ctx) => {
      const apiKey = process.env.YDC_API_KEY;
      if (!apiKey) {
        throw new ToolError('web_search requires YDC_API_KEY. Get one at https://you.com/platform.');
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
      try {
        const params = new URLSearchParams({
          query,
          count: String(Math.min(limit, 100)),
        });

        const res = await fetchFn(`https://ydc-index.io/v1/search?${params}`, {
          headers: { 'X-API-Key': apiKey, Accept: 'application/json' },
          signal: controller.signal,
        });

        if (!res.ok) {
          const body = await res.text();
          throw new ToolError(`You.com Search API error: HTTP ${res.status} ${res.statusText}. ${body}`);
        }

        const parsed = youSearchResponse.parse(await res.json());
        const results = [...(parsed.results?.web ?? []), ...(parsed.results?.news ?? [])]
          .slice(0, limit)
          .map((r) => ({
            title: r.title,
            url: r.url,
            snippet: r.description ?? r.snippets?.[0] ?? '',
          }));

        return { content: JSON.stringify(results, null, 2), meta: { provider: 'you.com', query } };
      } finally {
        clearTimeout(timer);
      }
    },
  });
}

export const webSearch = createWebSearchTool();

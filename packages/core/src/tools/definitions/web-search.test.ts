import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webSearch, createWebSearchTool } from './web-search';

describe('web_search tool', () => {
  const originalKey = process.env.YDC_API_KEY;

  beforeEach(() => {
    process.env.YDC_API_KEY = 'test-key';
  });

  afterEach(() => {
    process.env.YDC_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it('uses You.com search results', async () => {
    const fetchFn = vi.fn(async () =>
      new Response(
        JSON.stringify({
          results: {
            web: [{ title: 'One', url: 'https://example.com/1', description: 'first' }],
            news: [{ title: 'Two', url: 'https://example.com/2', snippets: ['second'] }],
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const tool = createWebSearchTool({ fetchFn });
    const res = await tool.handler({ query: 'agent search', limit: 5 }, {} as never);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(res.meta).toEqual({ provider: 'you.com', query: 'agent search' });
    expect(JSON.parse(res.content)).toEqual([
      { title: 'One', url: 'https://example.com/1', snippet: 'first' },
      { title: 'Two', url: 'https://example.com/2', snippet: 'second' },
    ]);
  });

  it('fails closed when YDC_API_KEY is missing', async () => {
    delete process.env.YDC_API_KEY;
    await expect(webSearch.handler({ query: 'agent search' }, {} as never)).rejects.toThrow(
      /YDC_API_KEY/,
    );
  });
});

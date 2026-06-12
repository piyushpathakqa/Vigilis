import { z } from 'zod';
import { defineTool } from '../types';
import type { DomMatch } from '../types';

function formatMatch(m: DomMatch): string {
  const attrs = Object.entries(m.attributes)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
  const head = attrs ? `<${m.tag} ${attrs}>` : `<${m.tag}>`;
  return m.text ? `${head} ${m.text}` : head;
}

export const domQuery = defineTool({
  name: 'dom_query',
  description: 'Query the current page for elements matching a selector.',
  input: z.object({ selector: z.string().describe('CSS or testid selector') }),
  handler: async ({ selector }, ctx) => {
    const matches = await ctx.browser.query(selector);
    const content = matches.length ? matches.map(formatMatch).join('\n') : '(no matches)';
    return { content, meta: { count: matches.length } };
  },
});

export const domTestids = defineTool({
  name: 'dom_testids',
  description: 'List all data-testid values present on the current page.',
  input: z.object({}),
  handler: async (_input, ctx) => {
    const ids = await ctx.browser.testids();
    return { content: ids.length ? ids.join('\n') : '(none)', meta: { count: ids.length } };
  },
});

import { z } from 'zod';
import { defineTool } from '../types';

export const browserNavigate = defineTool({
  name: 'browser_navigate',
  description: 'Navigate the browser to a URL.',
  input: z.object({ url: z.string().describe('Absolute URL to open') }),
  handler: async ({ url }, ctx) => {
    await ctx.browser.navigate(url);
    return { content: `Navigated to ${url}`, meta: { url } };
  },
});

export const browserClick = defineTool({
  name: 'browser_click',
  description: 'Click the first element matching a selector.',
  input: z.object({ selector: z.string().describe('CSS or testid selector') }),
  handler: async ({ selector }, ctx) => {
    await ctx.browser.click(selector);
    return { content: `Clicked ${selector}` };
  },
});

export const browserType = defineTool({
  name: 'browser_type',
  description: 'Type text into the element matching a selector.',
  input: z.object({
    selector: z.string().describe('CSS or testid selector'),
    text: z.string().describe('Text to type'),
  }),
  handler: async ({ selector, text }, ctx) => {
    await ctx.browser.type(selector, text);
    return { content: `Typed into ${selector}` };
  },
});

export const browserSnapshot = defineTool({
  name: 'browser_snapshot',
  description: 'Return a trimmed HTML/a11y snapshot of the current page.',
  input: z.object({}),
  handler: async (_input, ctx) => {
    const html = await ctx.browser.snapshot();
    return { content: html, meta: { url: ctx.browser.url() } };
  },
});

/**
 * Reduce a raw HTML document to the locator-relevant signal: drop comments,
 * scripts, styles, and stylesheet/preload links, collapse whitespace, and cap
 * the length. Keeps the title, body markup, text, and data-testids — far more
 * token-efficient than raw `page.content()` for the agent to reason over.
 */
export function trimHtml(html: string, limit = 12000): string {
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<link\b[^>]*>/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > limit ? cleaned.slice(0, limit) : cleaned;
}

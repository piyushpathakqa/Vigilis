import { describe, it, expect } from 'vitest';
import { trimHtml } from './html';

describe('trimHtml', () => {
  it('strips script, style, link, and comment noise', () => {
    const html = `
      <html><head><title>Shop</title><style>.x{color:red}</style>
      <link rel="stylesheet" href="/a.css"></head>
      <body><!-- hydration -->
      <script>window.__DATA__ = {a:1}</script>
      <button data-testid="go">Go</button></body></html>`;
    const out = trimHtml(html);
    expect(out).not.toContain('window.__DATA__');
    expect(out).not.toContain('color:red');
    expect(out).not.toContain('a.css');
    expect(out).not.toContain('hydration');
  });

  it('keeps the title, body markup, and data-testids', () => {
    const out = trimHtml('<html><head><title>Vigilis Shop</title></head><body><button data-testid="go">Go</button></body></html>');
    expect(out).toContain('Vigilis Shop');
    expect(out).toContain('data-testid="go"');
    expect(out).toContain('Go');
  });

  it('collapses runs of whitespace', () => {
    expect(trimHtml('<p>a</p>\n\n   \t  <p>b</p>')).toBe('<p>a</p> <p>b</p>');
  });

  it('caps output at the limit', () => {
    expect(trimHtml('x'.repeat(50), 10)).toHaveLength(10);
  });
});

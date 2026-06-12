import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { createPlaywrightSession, type PlaywrightSessionHandle } from './playwright-session';

// Decide availability at collection time (it.skipIf reads this when tests register,
// before beforeAll runs) — so probe the installed executable synchronously.
let hasBrowser = false;
try {
  hasBrowser = existsSync(chromium.executablePath());
} catch {
  hasBrowser = false;
}

let handle: PlaywrightSessionHandle | undefined;

beforeAll(async () => {
  if (hasBrowser) handle = await createPlaywrightSession({ headless: true });
});

afterAll(async () => {
  await handle?.close();
});

const HTML = `
  <main data-testid="root">
    <h1 data-testid="title">Shop</h1>
    <input data-testid="q" />
    <button data-testid="go">Go</button>
  </main>`;

describe('PlaywrightBrowserSession (chromium)', () => {
  it.skipIf(!hasBrowser)('lists data-testids', async () => {
    await handle!.page.setContent(HTML);
    expect((await handle!.session.testids()).sort()).toEqual(['go', 'q', 'root', 'title']);
  });

  it.skipIf(!hasBrowser)('queries elements with tag/text/attributes', async () => {
    await handle!.page.setContent(HTML);
    const matches = await handle!.session.query('[data-testid="title"]');
    expect(matches[0]).toMatchObject({ tag: 'h1', text: 'Shop' });
    expect(matches[0]?.attributes['data-testid']).toBe('title');
  });

  it.skipIf(!hasBrowser)('types and clicks via selectors', async () => {
    await handle!.page.setContent(HTML);
    await handle!.session.type('[data-testid="q"]', 'hello');
    expect(await handle!.page.inputValue('[data-testid="q"]')).toBe('hello');
    await handle!.session.click('[data-testid="go"]');
  });

  it.skipIf(!hasBrowser)('snapshots cleaned page html (testids in, scripts out)', async () => {
    await handle!.page.setContent(`${HTML}<script>window.__SECRET__ = 42;</script>`);
    const snap = await handle!.session.snapshot();
    expect(snap).toContain('data-testid="title"');
    expect(snap).not.toContain('__SECRET__');
  });
});

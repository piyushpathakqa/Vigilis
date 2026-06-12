import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import type { BrowserSession, DomMatch } from '../tools/types';
import { trimHtml } from './html';

export class PlaywrightBrowserSession implements BrowserSession {
  constructor(private readonly page: Page) {}

  async navigate(url: string): Promise<void> {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
  }
  async click(selector: string): Promise<void> {
    await this.page.locator(selector).first().click();
  }
  async type(selector: string, text: string): Promise<void> {
    await this.page.locator(selector).first().fill(text);
  }
  async snapshot(): Promise<string> {
    return trimHtml(await this.page.content());
  }
  async query(selector: string): Promise<DomMatch[]> {
    return this.page.locator(selector).evaluateAll((els) =>
      els.slice(0, 20).map((el) => {
        const attributes: Record<string, string> = {};
        for (const a of Array.from(el.attributes)) attributes[a.name] = a.value;
        return {
          tag: el.tagName.toLowerCase(),
          text: (el.textContent ?? '').trim(),
          attributes,
        };
      }),
    );
  }
  async testids(): Promise<string[]> {
    return this.page.$$eval('[data-testid]', (els) =>
      els.map((e) => e.getAttribute('data-testid') ?? '').filter(Boolean),
    );
  }
  url(): string {
    return this.page.url();
  }
}

export interface PlaywrightSessionHandle {
  session: PlaywrightBrowserSession;
  page: Page;
  close: () => Promise<void>;
}

/** Launch chromium and return a session + teardown. */
export async function createPlaywrightSession(
  opts: { headless?: boolean } = {},
): Promise<PlaywrightSessionHandle> {
  const browser: Browser = await chromium.launch({ headless: opts.headless ?? true });
  const context = await browser.newContext();
  const page = await context.newPage();
  return {
    session: new PlaywrightBrowserSession(page),
    page,
    close: () => browser.close(),
  };
}

import { describe, it, expect } from 'vitest';
import { browserNavigate, browserClick, browserType, browserSnapshot } from './browser';
import { domQuery, domTestids } from './dom';
import { FakeBrowserSession, makeFakeCtx } from '../testing/fakes';

describe('browser tools', () => {
  it('navigate/click/type delegate to the session', async () => {
    const browser = new FakeBrowserSession();
    const ctx = makeFakeCtx({ browser });
    await browserNavigate.handler({ url: 'http://x/' }, ctx);
    await browserClick.handler({ selector: '#go' }, ctx);
    await browserType.handler({ selector: '#q', text: 'hi' }, ctx);
    expect(browser.calls).toEqual(['navigate:http://x/', 'click:#go', 'type:#q:hi']);
  });

  it('snapshot returns the page HTML and current url in meta', async () => {
    const browser = new FakeBrowserSession();
    browser.snapshotHtml = '<main>shop</main>';
    browser.current = 'http://x/products';
    const res = await browserSnapshot.handler({}, makeFakeCtx({ browser }));
    expect(res.content).toBe('<main>shop</main>');
    expect(res.meta?.url).toBe('http://x/products');
  });
});

describe('dom tools', () => {
  it('dom_query formats matches and reports a count', async () => {
    const browser = new FakeBrowserSession();
    browser.queryResult = [{ tag: 'button', text: 'Add', attributes: { 'data-testid': 'add' } }];
    const res = await domQuery.handler({ selector: 'button' }, makeFakeCtx({ browser }));
    expect(res.meta?.count).toBe(1);
    expect(res.content).toMatch(/button/);
    expect(res.content).toMatch(/Add/);
  });

  it('dom_testids lists ids and reports a count', async () => {
    const browser = new FakeBrowserSession();
    browser.testidList = ['login-submit', 'cart-count'];
    const res = await domTestids.handler({}, makeFakeCtx({ browser }));
    expect(res.meta?.count).toBe(2);
    expect(res.content).toBe('login-submit\ncart-count');
  });
});

import { describe, it, expect } from 'vitest';
import type { DetectFs } from './detect';
import { detectFramework, pickFramework } from './detect';

const fakeFs = (files: Record<string, string>): DetectFs => ({
  readFile: async (p: string): Promise<string> => {
    const v = files[p];
    if (v === undefined) throw new Error('ENOENT');
    return v;
  },
  exists: async (p: string) => p in files,
});

describe('detectFramework', () => {
  it('detects playwright from a dependency', async () => {
    const fs = fakeFs({ '/app/package.json': JSON.stringify({ devDependencies: { '@playwright/test': '1' } }) });
    const got = await detectFramework('/app', fs);
    expect(pickFramework(got)).toBe('playwright');
  });

  it('detects cypress from a config file even without the dep', async () => {
    const fs = fakeFs({ '/app/package.json': '{}', '/app/cypress.config.ts': '' });
    const got = await detectFramework('/app', fs);
    expect(pickFramework(got)).toBe('cypress');
  });

  it('detects selenium from its dependency', async () => {
    const fs = fakeFs({ '/app/package.json': JSON.stringify({ dependencies: { 'selenium-webdriver': '4' } }) });
    const got = await detectFramework('/app', fs);
    expect(pickFramework(got)).toBe('selenium');
  });

  it('returns null framework when nothing matches', async () => {
    const fs = fakeFs({ '/app/package.json': '{}' });
    expect(pickFramework(await detectFramework('/app', fs))).toBeNull();
  });

  it('ranks the higher-confidence framework first when several match', async () => {
    const fs = fakeFs({
      '/app/package.json': JSON.stringify({ devDependencies: { '@playwright/test': '1', cypress: '13' } }),
      '/app/playwright.config.ts': '',
    });
    // playwright matches dep + config (higher) vs cypress dep only
    expect(pickFramework(await detectFramework('/app', fs))).toBe('playwright');
  });

  it('returns empty scores and null framework when package.json is missing and no config files exist', async () => {
    const fs = fakeFs({});
    const scores = await detectFramework('/app', fs);
    expect(scores).toEqual([]);
    expect(pickFramework(scores)).toBeNull();
  });
});

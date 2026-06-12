import { describe, it, expect } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generate, specPathForUrl } from './generate';
import { createDefaultRegistry } from '../tools/definitions';
import { FakeAnthropicClient, makeFakeCtx, makeMessage } from '../tools/testing/fakes';

describe('specPathForUrl', () => {
  it('maps the root path to home', () => {
    expect(specPathForUrl('http://localhost:3100/')).toBe('tests/generated/home.spec.ts');
  });
  it('maps a single segment to its slug', () => {
    expect(specPathForUrl('http://localhost:3100/login')).toBe('tests/generated/login.spec.ts');
  });
  it('joins nested segments with a dash and lowercases', () => {
    expect(specPathForUrl('http://localhost:3100/Products/42')).toBe(
      'tests/generated/products-42.spec.ts',
    );
  });
  it('honours a custom outDir', () => {
    expect(specPathForUrl('http://x/login', 'tests/e2e')).toBe('tests/e2e/login.spec.ts');
  });
  it('falls back to home for an empty/garbage path', () => {
    expect(specPathForUrl('http://x')).toBe('tests/generated/home.spec.ts');
  });
});

describe('generate', () => {
  it('writes the spec to the deterministic path and reports it', async () => {
    const root = await mkdtemp(join(tmpdir(), 'argus-gen-'));
    try {
      const SPEC = "import { test, expect } from '@playwright/test';\ntest('x', async () => {});\n";
      const client = new FakeAnthropicClient([
        makeMessage(
          [{ type: 'tool_use', id: 'tu_1', name: 'browser_snapshot', input: {} }],
          'tool_use',
        ),
        makeMessage(
          [
            {
              type: 'tool_use',
              id: 'tu_2',
              name: 'fs_write',
              input: { path: 'tests/generated/login.spec.ts', content: SPEC },
            },
          ],
          'tool_use',
        ),
        makeMessage([{ type: 'text', text: 'Wrote the login test.' }], 'end_turn'),
      ]);

      const result = await generate({
        client,
        url: 'http://localhost:3100/login',
        registry: createDefaultRegistry(),
        ctx: makeFakeCtx({ workspaceRoot: root }),
      });

      expect(result.specPath).toBe('tests/generated/login.spec.ts');
      expect(result.writtenFiles).toContain('tests/generated/login.spec.ts');
      expect(result.run.stopReason).toBe('end_turn');
      expect(await readFile(join(root, 'tests/generated/login.spec.ts'), 'utf8')).toBe(SPEC);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

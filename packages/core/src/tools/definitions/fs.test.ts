import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fsRead, fsWrite, fsList } from './fs';
import type { ToolContext } from '../types';

let root: string;
const ctx = (): ToolContext => ({ workspaceRoot: root }) as ToolContext;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'argus-fs-'));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('fs tools', () => {
  it('fs_write creates parent dirs and fs_read returns the content', async () => {
    const w = await fsWrite.handler({ path: 'tests/a.spec.ts', content: 'hello' }, ctx());
    expect(w.isError).toBeUndefined();
    expect(w.meta?.bytes).toBe(5);
    const r = await fsRead.handler({ path: 'tests/a.spec.ts' }, ctx());
    expect(r.content).toBe('hello');
  });

  it('fs_list lists entries, marking directories with a trailing slash', async () => {
    await mkdir(join(root, 'sub'));
    await writeFile(join(root, 'top.txt'), 'x');
    const res = await fsList.handler({}, ctx());
    expect(res.content.split('\n').sort()).toEqual(['sub/', 'top.txt']);
  });

  it('rejects path traversal outside the workspace', async () => {
    await expect(fsRead.handler({ path: '../escape.txt' }, ctx())).rejects.toThrow(
      /escapes the workspace/i,
    );
    await expect(
      fsWrite.handler({ path: '/etc/passwd', content: 'x' }, ctx()),
    ).rejects.toThrow(/escapes the workspace/i);
  });
});

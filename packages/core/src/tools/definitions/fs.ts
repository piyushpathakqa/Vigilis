import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { z } from 'zod';
import { defineTool, ToolError } from '../types';

/** Resolve `p` under `root`, rejecting anything that escapes the workspace. */
function resolveInWorkspace(root: string, p: string): string {
  const abs = resolve(root, p);
  const rel = relative(root, abs);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new ToolError(`Path escapes the workspace: ${p}`);
  }
  return abs;
}

export const fsRead = defineTool({
  name: 'fs_read',
  description: 'Read a UTF-8 text file within the workspace.',
  input: z.object({ path: z.string().describe('Path relative to the workspace root') }),
  handler: async ({ path }, ctx) => {
    const abs = resolveInWorkspace(ctx.workspaceRoot, path);
    const content = await readFile(abs, 'utf8');
    return { content, meta: { path, bytes: Buffer.byteLength(content) } };
  },
});

export const fsWrite = defineTool({
  name: 'fs_write',
  description: 'Write a UTF-8 text file within the workspace, creating parent directories.',
  input: z.object({
    path: z.string().describe('Path relative to the workspace root'),
    content: z.string().describe('File contents'),
  }),
  handler: async ({ path, content }, ctx) => {
    const abs = resolveInWorkspace(ctx.workspaceRoot, path);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, content, 'utf8');
    const bytes = Buffer.byteLength(content);
    return { content: `Wrote ${bytes} bytes to ${path}`, meta: { path, bytes } };
  },
});

export const fsList = defineTool({
  name: 'fs_list',
  description: 'List entries in a workspace directory (directories end with "/").',
  input: z.object({
    dir: z.string().optional().describe('Directory relative to the workspace root (default ".")'),
  }),
  handler: async ({ dir }, ctx) => {
    const abs = resolveInWorkspace(ctx.workspaceRoot, dir ?? '.');
    const entries = await readdir(abs, { withFileTypes: true });
    const names = entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
    return { content: names.join('\n'), meta: { dir: dir ?? '.', count: names.length } };
  },
});

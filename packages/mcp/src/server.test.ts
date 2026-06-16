import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { ToolContext } from '@argus/core';
import { createVigilisMcpServer } from './server';

// Minimal fake context — only the bits the exercised tool touches.
const fakeCtx = {
  workspaceRoot: '/tmp',
  browser: {
    navigate: async () => {},
    click: async () => {},
    type: async () => {},
    snapshot: async () => '<html></html>',
    query: async () => [],
    testids: async () => ['login-form', 'login-submit'],
    url: () => 'about:blank',
  },
  runner: {
    run: async () => ({ passed: 0, failed: 0, summary: '', artifactsDir: '' }),
  },
} as unknown as ToolContext;

async function connect() {
  const server = createVigilisMcpServer({ getContext: () => fakeCtx });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

describe('createVigilisMcpServer', () => {
  it('exposes the 10 registry tools', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      [
        'browser_click',
        'browser_navigate',
        'browser_snapshot',
        'browser_type',
        'dom_query',
        'dom_testids',
        'fs_list',
        'fs_read',
        'fs_write',
        'playwright_run',
      ].sort(),
    );
    await client.close();
  });

  it('routes a tool call through registry.execute against the context', async () => {
    const client = await connect();
    const res = (await client.callTool({ name: 'dom_testids', arguments: {} })) as {
      content: { type: string; text: string }[];
      isError?: boolean;
    };
    expect(res.isError).toBeFalsy();
    expect(res.content[0]?.text).toContain('login-submit');
    await client.close();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';

// Mock the optional SDK so the test runs without the treeship CLI/binary.
const action = vi.fn(async (_params: Record<string, unknown>) => ({
  artifactId: `art_${action.mock.calls.length}`,
}));
const decision = vi.fn(async (_params: Record<string, unknown>) => ({ artifactId: 'art_decision' }));
vi.mock('@treeship/sdk', () => ({
  Ship: { checkCli: async () => '0.12.0' },
  ship: () => ({ attest: { action, decision } }),
}));

// Capture `treeship session event` spawns without launching real processes.
const spawnArgs: string[][] = [];
vi.mock('node:child_process', () => ({
  spawn: (_cmd: string, args: string[]) => {
    spawnArgs.push(args);
    const child = new EventEmitter();
    queueMicrotask(() => child.emit('close', 0));
    return child;
  },
}));

import { createTreeshipObserver } from './treeship-observer';

describe('createTreeshipObserver', () => {
  it('attests each tool call (chained) and the model decision, then flushes', async () => {
    const obs = await createTreeshipObserver({ label: 'heal' });
    expect(obs).not.toBeNull();

    obs!.onToolCall!({ step: 1, name: 'fs_read', input: { path: 'a' } });
    obs!.onToolCall!({ step: 1, name: 'fs_write', input: { path: 'a' } });
    obs!.onModelResponse!({
      step: 1,
      stopReason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 5 } as never,
    });
    await obs!.flush();

    // tool calls recorded with the label prefix
    expect(action).toHaveBeenCalledTimes(2);
    expect(action.mock.calls[0]?.[0]).toMatchObject({ actor: 'agent://vigilis', action: 'heal.tool.fs_read', parentId: undefined });
    // second call chains to the first artifact
    expect(action.mock.calls[1]?.[0]).toMatchObject({ action: 'heal.tool.fs_write', parentId: 'art_1' });
    // the model decision is attested with token usage
    expect(decision).toHaveBeenCalledTimes(1);
    expect(decision.mock.calls[0]?.[0]).toMatchObject({ tokensIn: 10, tokensOut: 5 });
    expect(obs!.headId).toBe('art_decision');
  });

  it('emits a timeline event per action, mapped to the right side-effect type', async () => {
    spawnArgs.length = 0;
    const obs = await createTreeshipObserver({ label: 'heal' });

    obs!.onToolCall!({ step: 1, name: 'fs_read', input: { path: 'login.spec.ts' } });
    obs!.onToolCall!({ step: 1, name: 'browser_navigate', input: { url: 'http://localhost:3100' } });
    obs!.onToolCall!({ step: 1, name: 'fs_write', input: { path: 'login.spec.ts' } });
    obs!.onToolCall!({ step: 1, name: 'playwright_run', input: {} });
    obs!.onModelResponse!({
      step: 2,
      stopReason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 5 } as never,
    });
    await obs!.flush();

    // one `session event` per action, each linked to its signed artifact id
    expect(spawnArgs).toHaveLength(5);
    expect(spawnArgs.every((a) => a[0] === 'session' && a[1] === 'event')).toBe(true);
    expect(spawnArgs.every((a) => a.includes('--artifact-id'))).toBe(true);

    const typeOf = (a: string[]) => a[a.indexOf('--type') + 1];
    expect(typeOf(spawnArgs[0]!)).toBe('agent.read_file');
    expect(spawnArgs[0]).toContain('login.spec.ts');
    expect(typeOf(spawnArgs[1]!)).toBe('agent.connected_network');
    expect(spawnArgs[1]).toContain('http://localhost:3100');
    expect(typeOf(spawnArgs[2]!)).toBe('agent.wrote_file');
    expect(typeOf(spawnArgs[3]!)).toBe('agent.called_tool');
    expect(spawnArgs[3]).toContain('playwright_run');
    expect(typeOf(spawnArgs[4]!)).toBe('agent.decision');
  });

  it('returns null when the SDK/CLI is unavailable', async () => {
    vi.doMock('@treeship/sdk', () => ({
      Ship: { checkCli: async () => { throw new Error('treeship binary not found'); } },
      ship: () => ({ attest: { action, decision } }),
    }));
    vi.resetModules();
    const { createTreeshipObserver: create } = await import('./treeship-observer');
    expect(await create()).toBeNull();
  });
});

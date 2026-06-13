import { describe, it, expect, vi } from 'vitest';

// Mock the optional SDK so the test runs without the treeship CLI/binary.
const action = vi.fn(async (_params: Record<string, unknown>) => ({
  artifactId: `art_${action.mock.calls.length}`,
}));
const decision = vi.fn(async (_params: Record<string, unknown>) => ({ artifactId: 'art_decision' }));
vi.mock('@treeship/sdk', () => ({
  Ship: { checkCli: async () => '0.12.0' },
  ship: () => ({ attest: { action, decision } }),
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
    expect(action.mock.calls[0]?.[0]).toMatchObject({ actor: 'agent://argus', action: 'heal.tool.fs_read', parentId: undefined });
    // second call chains to the first artifact
    expect(action.mock.calls[1]?.[0]).toMatchObject({ action: 'heal.tool.fs_write', parentId: 'art_1' });
    // the model decision is attested with token usage
    expect(decision).toHaveBeenCalledTimes(1);
    expect(decision.mock.calls[0]?.[0]).toMatchObject({ tokensIn: 10, tokensOut: 5 });
    expect(obs!.headId).toBe('art_decision');
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

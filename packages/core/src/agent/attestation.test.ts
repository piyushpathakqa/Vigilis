import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAttestationObserver } from './attestation';

describe('createAttestationObserver', () => {
  it('falls back to the local observer when Treeship is unavailable', async () => {
    const outPath = join(mkdtempSync(join(tmpdir(), 'vigilis-sel-')), 'heal.json');
    const sel = await createAttestationObserver({
      label: 'heal',
      outPath,
      createTreeship: async () => null, // Treeship absent
    });
    expect(sel.kind).toBe('local');
    expect(sel.local).toBeDefined();
    expect(sel.local!.bundlePath).toBe(outPath);
    expect(typeof sel.observer.flush).toBe('function');
  });

  it('uses Treeship when its observer is available', async () => {
    const outPath = join(mkdtempSync(join(tmpdir(), 'vigilis-sel-')), 'heal.json');
    const fakeTree = {
      headId: undefined,
      onToolCall() {},
      onModelResponse() {},
      async flush() {},
    };
    const sel = await createAttestationObserver({
      label: 'heal',
      outPath,
      createTreeship: async () => fakeTree as any,
    });
    expect(sel.kind).toBe('treeship');
    expect(sel.treeship).toBe(fakeTree);
  });
});

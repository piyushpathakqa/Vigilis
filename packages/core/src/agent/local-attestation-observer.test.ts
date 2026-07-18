import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createLocalAttestationObserver,
  hashRecord,
  verifyLocalBundle,
  type AttestationBundle,
} from './local-attestation-observer';

function fixedClock() {
  let n = 0;
  return () => `2026-07-17T00:00:0${n++}.000Z`;
}

describe('createLocalAttestationObserver', () => {
  it('chains records in invocation order and writes a bundle on flush', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vigilis-attest-'));
    const outPath = join(dir, 'heal-login.json');
    const obs = createLocalAttestationObserver({ label: 'heal', outPath, now: fixedClock() });

    obs.onLoopStart?.({ system: 'sys', model: 'claude-opus-4-8' });
    obs.onToolCall?.({ step: 1, name: 'fs_read', input: { path: 'a.spec.ts' } });
    obs.onModelResponse?.({
      step: 1,
      stopReason: 'tool_use',
      usage: { input_tokens: 10, output_tokens: 5 } as any,
    });
    obs.onLoopEnd?.({ steps: 1, stopReason: 'end_turn' });
    await obs.flush();

    // 4 records, seq 0..3, each prevHash === previous record's hash
    expect(obs.records).toHaveLength(4);
    expect(obs.records[0]!.prevHash).toBeNull();
    for (let i = 1; i < obs.records.length; i++) {
      expect(obs.records[i]!.prevHash).toBe(obs.records[i - 1]!.hash);
      expect(obs.records[i]!.seq).toBe(i);
    }
    // headHash is the last record's hash
    expect(obs.headHash).toBe(obs.records[3]!.hash);

    // each hash equals the recomputed hash of its own fields (real chain)
    for (const rec of obs.records) {
      const { hash, ...rest } = rec;
      expect(hash).toBe(hashRecord(rest));
    }

    // bundle written and parseable
    const bundle = JSON.parse(readFileSync(outPath, 'utf8')) as AttestationBundle;
    expect(bundle.count).toBe(4);
    expect(bundle.signed).toBe(false);
    expect(bundle.chainIntact).toBe(true);
    expect(bundle.headHash).toBe(obs.headHash);
    expect(bundle.records).toHaveLength(4);
  });
});

describe('verifyLocalBundle', () => {
  function buildBundle(): AttestationBundle {
    const dir = mkdtempSync(join(tmpdir(), 'vigilis-verify-'));
    const obs = createLocalAttestationObserver({
      label: 'heal',
      outPath: join(dir, 'b.json'),
      now: fixedClock(),
    });
    obs.onLoopStart?.({ system: 'sys', model: 'm' });
    obs.onToolCall?.({ step: 1, name: 'fs_read', input: { path: 'a' } });
    obs.onToolCall?.({ step: 2, name: 'fs_write', input: { path: 'b' } });
    obs.onLoopEnd?.({ steps: 2, stopReason: 'end_turn' });
    return {
      version: 1,
      actor: 'agent://vigilis',
      label: 'heal',
      createdAt: '2026-07-17T00:00:09.000Z',
      count: obs.records.length,
      headHash: obs.headHash,
      signed: false,
      chainIntact: true,
      records: obs.records.map((r) => ({ ...r })),
    };
  }

  it('accepts an intact chain', () => {
    const v = verifyLocalBundle(buildBundle());
    expect(v).toEqual({ ok: true, count: 4 });
  });

  it('rejects a bundle whose middle record was tampered', () => {
    const bundle = buildBundle();
    (bundle.records[1]!.meta as any).input = { path: 'HACKED' };
    const v = verifyLocalBundle(bundle);
    expect(v.ok).toBe(false);
    expect(v.brokenAt).toBe(1);
  });
});

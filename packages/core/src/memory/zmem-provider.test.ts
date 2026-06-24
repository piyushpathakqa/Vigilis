import { describe, it, expect } from 'vitest';
import { ZMemProvider, resolveMemoryProvider } from './zmem-provider';
import { NoopMemoryProvider } from './types';
import type { Exec, ExecResult } from '../runtime/exec';

/** Build a fake Exec that returns canned responses per command. */
function makeExec(responses: Record<string, ExecResult>): Exec {
  return async (cmd, args, _opts) => {
    const key = [cmd, ...args].join(' ');
    // find first matching key (prefix match)
    const match = Object.keys(responses).find((k) => key.startsWith(k));
    if (match) return responses[match]!;
    return { stdout: '', stderr: 'not found', code: 1 };
  };
}

describe('ZMemProvider', () => {
  describe('recall', () => {
    it('parses valid JSON stdout into MemoryRecall[]', async () => {
      const recalls = [
        {
          verdict: 'dom-drift',
          rationale: 'testid changed from login-submit to submit-btn',
          suggestedSelector: '[data-testid="submit-btn"]',
          trust: 0.9,
        },
      ];
      const fakeExec = makeExec({
        'zmem recall': { stdout: JSON.stringify(recalls), stderr: '', code: 0 },
      });
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      const result = await provider.recall({
        specPath: 'tests/login.spec.ts',
        url: 'http://localhost:3100/login',
        errorText: 'locator not found',
      });
      expect(result).toHaveLength(1);
      expect(result[0]!.verdict).toBe('dom-drift');
      expect(result[0]!.rationale).toBe('testid changed from login-submit to submit-btn');
      expect(result[0]!.suggestedSelector).toBe('[data-testid="submit-btn"]');
      expect(result[0]!.trust).toBe(0.9);
      // authority must always default to false for recalled entries
      expect(result[0]!.authority).toBe(false);
    });

    it('returns [] on non-JSON stdout (zmem not installed or wrong output)', async () => {
      const fakeExec = makeExec({
        'zmem recall': { stdout: 'command not found: zmem', stderr: '', code: 127 },
      });
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      const result = await provider.recall({
        specPath: 'tests/login.spec.ts',
        url: 'http://localhost:3100',
      });
      expect(result).toEqual([]);
    });

    it('returns [] on empty stdout', async () => {
      const fakeExec = makeExec({
        'zmem recall': { stdout: '', stderr: '', code: 0 },
      });
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      const result = await provider.recall({ specPath: 'a.spec.ts', url: 'http://x' });
      expect(result).toEqual([]);
    });

    it('returns [] when exec throws', async () => {
      const throwingExec: Exec = async () => {
        throw new Error('ENOENT: zmem not found');
      };
      const provider = new ZMemProvider('/tmp/test', throwingExec);
      const result = await provider.recall({ specPath: 'a.spec.ts', url: 'http://x' });
      expect(result).toEqual([]);
    });

    it('returns [] on JSON that is not an array', async () => {
      const fakeExec = makeExec({
        'zmem recall': { stdout: JSON.stringify({ error: 'no results' }), stderr: '', code: 0 },
      });
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      const result = await provider.recall({ specPath: 'a.spec.ts', url: 'http://x' });
      expect(result).toEqual([]);
    });

    it('filters out non-object and invalid items from JSON array', async () => {
      const mixedArray = [
        null,
        42,
        'string',
        { verdict: 'invalid-verdict', rationale: 'bad' },
        { verdict: 'dom-drift', rationale: 'valid entry' },
      ];
      const fakeExec = makeExec({
        'zmem recall': { stdout: JSON.stringify(mixedArray), stderr: '', code: 0 },
      });
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      const result = await provider.recall({ specPath: 'a.spec.ts', url: 'http://x' });
      // Only the valid dom-drift entry should be returned
      expect(result).toHaveLength(1);
      expect(result[0]!.verdict).toBe('dom-drift');
      expect(result[0]!.rationale).toBe('valid entry');
    });
  });

  describe('record', () => {
    it('calls exec with the record argv and resolves', async () => {
      const calls: Array<{ cmd: string; args: string[] }> = [];
      const fakeExec: Exec = async (cmd, args) => {
        calls.push({ cmd, args });
        return { stdout: '{"ok":true}', stderr: '', code: 0 };
      };
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      await provider.record({
        specPath: 'tests/login.spec.ts',
        url: 'http://localhost:3100/login',
        verdict: 'dom-drift',
        rationale: 'testid changed',
        suggestedSelector: '[data-testid="submit-btn"]',
      });
      expect(calls).toHaveLength(1);
      expect(calls[0]!.cmd).toBe('zmem');
    });

    it('resolves even when exec throws', async () => {
      const throwingExec: Exec = async () => {
        throw new Error('ENOENT');
      };
      const provider = new ZMemProvider('/tmp/test', throwingExec);
      await expect(
        provider.record({
          specPath: 'a.spec.ts',
          url: 'http://x',
          verdict: 'real-bug',
          rationale: 'broken',
        }),
      ).resolves.toBeUndefined();
    });

    it('resolves even when zmem exits non-zero', async () => {
      const fakeExec = makeExec({
        'zmem remember': { stdout: '', stderr: 'zmem: error', code: 1 },
      });
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      await expect(
        provider.record({
          specPath: 'a.spec.ts',
          url: 'http://x',
          verdict: 'flake',
          rationale: 'transient',
        }),
      ).resolves.toBeUndefined();
    });
  });
});

describe('resolveMemoryProvider', () => {
  it('returns NoopMemoryProvider when mode is off', async () => {
    const fakeExec: Exec = async () => ({ stdout: '', stderr: '', code: 0 });
    const provider = await resolveMemoryProvider('/tmp', { mode: 'off', exec: fakeExec });
    expect(provider).toBeInstanceOf(NoopMemoryProvider);
  });

  it('returns ZMemProvider when mode is zmem', async () => {
    const fakeExec: Exec = async () => ({ stdout: '', stderr: '', code: 0 });
    const provider = await resolveMemoryProvider('/tmp', { mode: 'zmem', exec: fakeExec });
    expect(provider).toBeInstanceOf(ZMemProvider);
  });

  it('returns ZMemProvider when mode is auto and zmem is on PATH', async () => {
    const fakeExec = makeExec({
      'zmem --version': { stdout: 'zmem 0.1.0', stderr: '', code: 0 },
    });
    const provider = await resolveMemoryProvider('/tmp', { mode: 'auto', exec: fakeExec });
    expect(provider).toBeInstanceOf(ZMemProvider);
  });

  it('returns NoopMemoryProvider when mode is auto and zmem is not on PATH', async () => {
    const fakeExec: Exec = async () => ({ stdout: '', stderr: 'not found', code: 127 });
    const provider = await resolveMemoryProvider('/tmp', { mode: 'auto', exec: fakeExec });
    expect(provider).toBeInstanceOf(NoopMemoryProvider);
  });

  it('returns NoopMemoryProvider when mode is auto and exec throws', async () => {
    const throwingExec: Exec = async () => {
      throw new Error('ENOENT');
    };
    const provider = await resolveMemoryProvider('/tmp', { mode: 'auto', exec: throwingExec });
    expect(provider).toBeInstanceOf(NoopMemoryProvider);
  });

  it('defaults to auto mode when no opts provided — uses fake exec to confirm interface shape', async () => {
    // Use a fake exec that simulates zmem not being present, so the test is
    // environment-independent. The real-exec path is covered by the auto+PATH test above.
    const notFoundExec: Exec = async () => ({ stdout: '', stderr: 'not found', code: 127 });
    const provider = await resolveMemoryProvider('/tmp', { exec: notFoundExec });
    // With no zmem on PATH, auto mode returns NoopMemoryProvider
    expect(provider).toBeInstanceOf(NoopMemoryProvider);
    expect(typeof provider.recall).toBe('function');
    expect(typeof provider.record).toBe('function');
  });
});

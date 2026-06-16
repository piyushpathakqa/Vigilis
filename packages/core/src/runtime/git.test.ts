import { describe, it, expect } from 'vitest';
import { createHealPr, type GitExec } from './git';

describe('createHealPr', () => {
  it('runs the branch/commit/push/PR sequence and returns the PR url', async () => {
    const calls: Array<{ cmd: string; args: string[] }> = [];
    const exec: GitExec = async (cmd, args) => {
      calls.push({ cmd, args });
      const stdout = cmd === 'gh' ? 'https://github.com/o/r/pull/7\n' : '';
      return { stdout, stderr: '', code: 0 };
    };

    const result = await createHealPr({
      cwd: '/ws',
      branch: 'argus/heal-login-abc',
      files: ['tests/generated/login.spec.ts'],
      title: 'Vigilis: heal DOM drift',
      body: 'old → new',
      exec,
    });

    expect(calls.map((c) => `${c.cmd} ${c.args[0]}`)).toEqual([
      'git checkout',
      'git add',
      'git commit',
      'git push',
      'gh pr',
    ]);
    expect(calls[0]?.args).toEqual(['checkout', '-b', 'argus/heal-login-abc']);
    expect(calls[1]?.args).toEqual(['add', 'tests/generated/login.spec.ts']);
    expect(calls[3]?.args).toEqual(['push', '-u', 'origin', 'argus/heal-login-abc']);
    expect(calls[4]?.args).toContain('--head');
    expect(calls[4]?.args).toContain('argus/heal-login-abc');
    expect(result.url).toBe('https://github.com/o/r/pull/7');
    expect(result.branch).toBe('argus/heal-login-abc');
  });
});

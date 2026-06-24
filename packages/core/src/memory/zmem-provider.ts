import { defaultExec } from '../runtime/exec';
import type { Exec } from '../runtime/exec';
import type { MemoryProvider, MemoryRecall, MemoryRecordEntry } from './types';
import { NoopMemoryProvider } from './types';

const VALID_VERDICTS = new Set(['real-bug', 'dom-drift', 'flake']);

/**
 * MemoryProvider backed by the `zmem` CLI (Zerker's local-first verifiable
 * memory for AI agents). All errors are swallowed — a missing or broken `zmem`
 * binary must never break a triage/heal run.
 *
 * Shells out via the injected `Exec` (same pattern as the test runners /
 * Treeship observer) so tests can inject a fake without spawning real processes.
 */
export class ZMemProvider implements MemoryProvider {
  constructor(
    private readonly cwd: string,
    private readonly exec: Exec = defaultExec,
  ) {}

  async recall(query: { specPath: string; url: string; errorText?: string }): Promise<MemoryRecall[]> {
    try {
      const { stdout } = await this.exec('zmem', this.recallArgv(query), { cwd: this.cwd });
      return this.parseRecalls(stdout);
    } catch {
      return [];
    }
  }

  async record(entry: MemoryRecordEntry): Promise<void> {
    try {
      await this.exec('zmem', this.recordArgv(entry), { cwd: this.cwd });
      // Non-zero exit codes: exec (defaultExec) does NOT throw on non-zero; it
      // resolves with { code: N }. Swallowing errors here covers exec throws only.
      // If exec contract changes to throw on non-zero, this catch still handles it.
    } catch {
      // swallow — a broken zmem must never block a run
    }
  }

  // CONFIRM against `zmem --help` before shipping to production.
  // Reasonable guess: zmem recall --json --query <text> [--spec <path>] [--url <url>]
  private recallArgv(query: { specPath: string; url: string; errorText?: string }): string[] {
    const args = [
      'recall',
      '--json',
      '--query',
      [query.specPath, query.url, query.errorText].filter(Boolean).join(' '),
      '--spec',
      query.specPath,
      '--url',
      query.url,
    ];
    if (query.errorText) {
      args.push('--error', query.errorText);
    }
    return args;
  }

  // CONFIRM against `zmem --help` before shipping to production.
  // Reasonable guess: zmem remember --json --verdict <v> --rationale <r> [--selector <s>] --spec <path> --url <url>
  private recordArgv(entry: MemoryRecordEntry): string[] {
    const args = [
      'remember',
      '--json',
      '--spec',
      entry.specPath,
      '--url',
      entry.url,
      '--verdict',
      entry.verdict,
      '--rationale',
      entry.rationale,
    ];
    if (entry.suggestedSelector) {
      args.push('--selector', entry.suggestedSelector);
    }
    if (entry.receiptId) {
      args.push('--receipt-id', entry.receiptId);
    }
    return args;
  }

  /**
   * Parse `zmem recall --json` stdout into MemoryRecall[].
   * Tolerates non-JSON, empty, or non-array output → returns [].
   * Always sets `authority: false` on parsed entries (recalled memory is hint only).
   */
  private parseRecalls(stdout: string): MemoryRecall[] {
    const trimmed = stdout.trim();
    if (!trimmed) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return [];
    }
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is Record<string, unknown> =>
          item !== null && typeof item === 'object' && !Array.isArray(item) &&
          typeof item['verdict'] === 'string' && VALID_VERDICTS.has(item['verdict']),
      )
      .map((item) => ({
        verdict: item['verdict'] as MemoryRecall['verdict'],
        rationale: String(item['rationale'] ?? ''),
        suggestedSelector:
          typeof item['suggestedSelector'] === 'string' ? item['suggestedSelector'] : undefined,
        trust: typeof item['trust'] === 'number' ? item['trust'] : undefined,
        authority: false, // recalled memory is NEVER authoritative
        receiptId: typeof item['receiptId'] === 'string' ? item['receiptId'] : undefined,
      }));
  }
}

/**
 * Build the appropriate MemoryProvider for the given mode:
 * - 'off'  → NoopMemoryProvider
 * - 'zmem' → ZMemProvider (always, regardless of PATH)
 * - 'auto' → ZMemProvider if `zmem` resolves on PATH, else NoopMemoryProvider
 *
 * Best-effort detection for 'auto': if unsure, default to Noop so behavior
 * is unchanged when zmem is absent.
 */
export async function resolveMemoryProvider(
  cwd: string,
  opts: { mode?: 'off' | 'auto' | 'zmem'; exec?: Exec } = {},
): Promise<MemoryProvider> {
  const { mode = 'auto', exec = defaultExec } = opts;

  if (mode === 'off') return new NoopMemoryProvider();
  if (mode === 'zmem') return new ZMemProvider(cwd, exec);

  // 'auto': probe zmem by running `zmem --version`
  try {
    const result = await exec('zmem', ['--version'], { cwd });
    if (result.code === 0) return new ZMemProvider(cwd, exec);
  } catch {
    // zmem not on PATH or exec threw — fall through to Noop
  }
  return new NoopMemoryProvider();
}

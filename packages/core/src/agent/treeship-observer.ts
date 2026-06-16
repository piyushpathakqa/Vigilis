import { spawn } from 'node:child_process';
import type { AgentObserver } from './observer';

export interface TreeshipObserver extends AgentObserver {
  /** Await all queued attestations. Call after the loop completes. */
  flush(): Promise<void>;
  /** The artifact id at the head of the signed receipt chain (after flush). */
  readonly headId: string | undefined;
}

export interface TreeshipObserverOptions {
  /** Actor URI for the receipts. Default `agent://vigilis`. */
  actor?: string;
  /** Namespaces the recorded actions, e.g. `heal` → `heal.tool.fs_write`. */
  label?: string;
  /** Agent name attached to timeline events. Default `argus`. */
  agentName?: string;
}

/**
 * Best-effort `treeship session event` — appends a structured event to the
 * active session's log so the action shows up in the receipt **timeline**,
 * **side-effect ledger**, and **activity density chart** (signed `attest`
 * artifacts alone only populate the artifact list, not the timeline). Resolves
 * regardless of outcome so provenance never blocks or breaks the agent loop.
 */
function sessionEvent(args: string[]): Promise<void> {
  return new Promise((resolve) => {
    try {
      const child = spawn('treeship', ['session', 'event', ...args], { stdio: 'ignore' });
      child.on('error', () => resolve());
      child.on('close', () => resolve());
    } catch {
      resolve();
    }
  });
}

/**
 * Map a Vigilis tool call to the Treeship timeline event that best describes its
 * side effect, so the receipt reads as "wrote file / read file / hit network /
 * called tool" rather than an opaque blob. File and network targets are pulled
 * from the tool input when present.
 */
function toolEventArgs(name: string, input: unknown): string[] {
  const obj = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const path = typeof obj.path === 'string' ? obj.path : undefined;
  const url = typeof obj.url === 'string' ? obj.url : undefined;
  if (name === 'fs_write') {
    return ['--type', 'agent.wrote_file', ...(path ? ['--file', path] : ['--tool', name])];
  }
  if (name === 'fs_read' || name === 'fs_list') {
    return ['--type', 'agent.read_file', ...(path ? ['--file', path] : ['--tool', name])];
  }
  if (name === 'browser_navigate') {
    return ['--type', 'agent.connected_network', ...(url ? ['--destination', url] : ['--tool', name])];
  }
  return ['--type', 'agent.called_tool', '--tool', name];
}

/**
 * Optional, dynamically-loaded observer that emits Ed25519-signed Treeship
 * receipts for each tool call + model decision in the agent loop — a
 * tamper-evident, independently verifiable record of what the agent did.
 *
 * Each event is recorded twice, by design:
 *   1. `ship.attest.*` signs a tamper-evident artifact (the proof chain), and
 *   2. `treeship session event` appends a timeline entry referencing that
 *      artifact — this is what populates the receipt's timeline, side-effect
 *      ledger, and activity-density chart.
 *
 * Returns `null` when `@treeship/sdk` or the `treeship` CLI is unavailable, so
 * Vigilis never hard-depends on Treeship. Attestations are serialized into an
 * ordered chain (each links to the previous via `parentId`); the loop calls
 * observer methods synchronously, so call `flush()` afterward to drain the queue.
 */
export async function createTreeshipObserver(
  opts: TreeshipObserverOptions = {},
): Promise<TreeshipObserver | null> {
  let ship: import('@treeship/sdk').Ship;
  try {
    const mod = await import('@treeship/sdk');
    await mod.Ship.checkCli(); // throws if the `treeship` binary isn't on PATH
    ship = mod.ship();
  } catch (err) {
    console.warn(
      '[vigilis] Treeship provenance disabled:',
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }

  const actor = opts.actor ?? 'agent://vigilis';
  const agentName = opts.agentName ?? 'vigilis';
  const prefix = opts.label ? `${opts.label}.` : '';

  let chain: Promise<void> = Promise.resolve();
  let headId: string | undefined;

  // Serialize attestations so the receipt chain links in invocation order. Each
  // step signs an artifact, then appends a timeline event referencing it.
  const enqueue = (
    attest: (parentId?: string) => Promise<{ artifactId: string }>,
    event: (artifactId: string) => string[],
  ): void => {
    chain = chain.then(async () => {
      try {
        const { artifactId } = await attest(headId);
        headId = artifactId;
        await sessionEvent([
          ...event(artifactId),
          '--actor',
          actor,
          '--agent-name',
          agentName,
          '--artifact-id',
          artifactId,
        ]);
      } catch (err) {
        console.warn(
          '[vigilis] treeship attest failed:',
          err instanceof Error ? err.message : String(err),
        );
      }
    });
  };

  return {
    get headId() {
      return headId;
    },
    onToolCall(e) {
      enqueue(
        (parentId) =>
          ship.attest.action({
            actor,
            action: `${prefix}tool.${e.name}`,
            parentId,
            meta: { input: e.input },
          }),
        () => toolEventArgs(e.name, e.input),
      );
    },
    onModelResponse(e) {
      enqueue(
        (parentId) =>
          ship.attest.decision({
            actor,
            tokensIn: e.usage.input_tokens,
            tokensOut: e.usage.output_tokens,
            summary: `step ${e.step}: ${e.stopReason ?? 'tool_use'}`,
            parentId,
          }),
        () => [
          '--type',
          'agent.decision',
          '--meta',
          JSON.stringify({
            step: e.step,
            tokens_in: e.usage.input_tokens,
            tokens_out: e.usage.output_tokens,
            stop: e.stopReason,
          }),
        ],
      );
    },
    async flush() {
      await chain;
    },
  };
}

import type { AgentObserver } from './observer';

export interface TreeshipObserver extends AgentObserver {
  /** Await all queued attestations. Call after the loop completes. */
  flush(): Promise<void>;
  /** The artifact id at the head of the signed receipt chain (after flush). */
  readonly headId: string | undefined;
}

export interface TreeshipObserverOptions {
  /** Actor URI for the receipts. Default `agent://argus`. */
  actor?: string;
  /** Namespaces the recorded actions, e.g. `heal` → `heal.tool.fs_write`. */
  label?: string;
}

/**
 * Optional, dynamically-loaded observer that emits Ed25519-signed Treeship
 * receipts for each tool call + model decision in the agent loop — a
 * tamper-evident, independently verifiable record of what the agent did.
 *
 * Returns `null` when `@treeship/sdk` or the `treeship` CLI is unavailable, so
 * Argus never hard-depends on Treeship. Attestations are serialized into an
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
      '[argus] Treeship provenance disabled:',
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }

  const actor = opts.actor ?? 'agent://argus';
  const prefix = opts.label ? `${opts.label}.` : '';

  let chain: Promise<void> = Promise.resolve();
  let headId: string | undefined;

  // Serialize attestations so the receipt chain links in invocation order.
  const enqueue = (run: (parentId?: string) => Promise<{ artifactId: string }>): void => {
    chain = chain.then(async () => {
      try {
        const { artifactId } = await run(headId);
        headId = artifactId;
      } catch (err) {
        console.warn(
          '[argus] treeship attest failed:',
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
      enqueue((parentId) =>
        ship.attest.action({
          actor,
          action: `${prefix}tool.${e.name}`,
          parentId,
          meta: { input: e.input },
        }),
      );
    },
    onModelResponse(e) {
      enqueue((parentId) =>
        ship.attest.decision({
          actor,
          tokensIn: e.usage.input_tokens,
          tokensOut: e.usage.output_tokens,
          summary: `step ${e.step}: ${e.stopReason ?? 'tool_use'}`,
          parentId,
        }),
      );
    },
    async flush() {
      await chain;
    },
  };
}

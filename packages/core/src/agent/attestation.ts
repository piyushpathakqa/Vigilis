import type { AgentObserver } from './observer';
import { createTreeshipObserver, type TreeshipObserver } from './treeship-observer';
import {
  createLocalAttestationObserver,
  type LocalAttestationObserver,
} from './local-attestation-observer';

export type AttestationKind = 'treeship' | 'local';

export interface AttestationSelection {
  kind: AttestationKind;
  observer: AgentObserver & { flush(): Promise<void> };
  treeship?: TreeshipObserver;
  local?: LocalAttestationObserver;
}

export interface CreateAttestationOptions {
  label?: string;
  /** Where the local bundle is written when Treeship is unavailable. */
  outPath: string;
  /** Try Treeship first (default true). */
  preferTreeship?: boolean;
  /** Injectable for tests; defaults to the real Treeship observer factory. */
  createTreeship?: typeof createTreeshipObserver;
}

/**
 * Pick the attestation observer: the independent Treeship notary when its CLI is
 * present, otherwise a local hash-chained bundle so provenance still works with
 * zero secrets. Local bundles are unsigned; Treeship receipts are signed.
 */
export async function createAttestationObserver(
  opts: CreateAttestationOptions,
): Promise<AttestationSelection> {
  const makeTree = opts.createTreeship ?? createTreeshipObserver;
  if (opts.preferTreeship !== false) {
    const tree = await makeTree({ label: opts.label });
    if (tree) return { kind: 'treeship', observer: tree, treeship: tree };
  }
  const local = createLocalAttestationObserver({ label: opts.label, outPath: opts.outPath });
  return { kind: 'local', observer: local, local };
}

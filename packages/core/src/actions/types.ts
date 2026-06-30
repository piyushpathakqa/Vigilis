/**
 * Refusal-action contract (TRE-77).
 *
 * The optional "on refusal, do something" seam — Slack alert, Linear ticket —
 * mirroring the cloud-reporter open-core boundary (packages/core/src/cloud):
 *   - OPTIONAL: no-op when unconfigured.
 *   - NEVER-THROW: notify() must never throw; a broken Slack/Linear must never
 *     break a heal/triage run.
 *   - OSS-CLEAN: no third-party imports here; no paid-layer import. The agent/
 *     directory must not import this module — only the CLI / dispatcher may.
 */
import { createHash } from 'node:crypto';

/** Everything known about a single refusal, at the moment the gate is blocked. */
export interface RefusalPayload {
  specPath: string;
  url: string; // app under test
  rationale: string;
  expected?: string; // best-effort, when the failure exposes it
  actual?: string;
  confidence?: string; // 'low' | 'medium' | 'high'
  framework?: string;
  repo?: string; // git remote slug, best-effort
  receiptUrl?: string; // signed Treeship receipt, when sealed
  /** Filled by the dispatcher from the Linear result (if a ticket was filed). */
  ticketUrl?: string;
  timestamp: string; // ISO-8601
}

export interface RefusalActionResult {
  ok: boolean; // delivered (or no-op) without error
  created?: boolean; // Linear: a NEW ticket was filed (false = dedup hit)
  url?: string; // Linear: ticket url (new or existing)
  skippedReason?: string; // e.g. 'unconfigured'
}

/** Swappable refusal action. Implementations MUST never throw from notify(). */
export interface RefusalAction {
  readonly name: string;
  notify(payload: RefusalPayload): Promise<RefusalActionResult>;
}

/** Default no-op — used when nothing is configured. Zero behaviour change. */
export class NoopRefusalAction implements RefusalAction {
  readonly name = 'noop';
  async notify(payload: RefusalPayload): Promise<RefusalActionResult> {
    return { ok: true, skippedReason: 'unconfigured' };
  }
}

/**
 * Stable, content-addressed id for one refusal. Excludes timestamp/receiptUrl
 * so the same refusal on a CI re-run produces the same fingerprint (drives the
 * Linear search-then-create dedup).
 */
export function fingerprint(p: RefusalPayload): string {
  const basis = [p.repo ?? '', p.specPath, 'real-bug', p.expected ?? '', p.actual ?? '', p.rationale].join('\n');
  return createHash('sha256').update(basis).digest('hex').slice(0, 12);
}

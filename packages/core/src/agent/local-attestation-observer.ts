import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AgentObserver } from './observer';

export interface AttestationRecord {
  seq: number;
  timestamp: string;
  // Loop events use `loop_start | model_response | tool_call | tool_result |
  // loop_end`; other attesters (e.g. attest-run) use their own kinds. Kept open
  // so the attestation core is not QA-loop-specific.
  type: string;
  actor: string;
  action: string;
  meta: Record<string, unknown>;
  prevHash: string | null;
  hash: string;
}

/** A single event to be chained into an attestation record. */
export interface AttestationEntry {
  type: string;
  action: string;
  meta: Record<string, unknown>;
}

/** Shared context for stamping records: actor URI, action prefix, clock. */
export interface ChainContext {
  actor: string;
  prefix: string;
  now: () => string;
}

export interface AttestationBundle {
  version: 1;
  actor: string;
  label: string;
  createdAt: string;
  count: number;
  headHash: string | null;
  signed: false;
  chainIntact: true;
  records: AttestationRecord[];
}

export interface LocalAttestationObserverOptions {
  /** Namespaces recorded actions, e.g. `heal` → `heal.tool.fs_read`. */
  label?: string;
  /** Actor URI stamped on every record. Default `agent://vigilis`. */
  actor?: string;
  /** Where the bundle JSON is written on flush. */
  outPath: string;
  /** Injectable clock (tests). Default `() => new Date().toISOString()`. */
  now?: () => string;
}

export interface LocalAttestationObserver extends AgentObserver {
  flush(): Promise<void>;
  readonly headHash: string | null;
  readonly bundlePath: string;
  readonly records: readonly AttestationRecord[];
}

/** Deterministic JSON: object keys sorted recursively so hashing is stable. */
export function canonicalJson(value: unknown): string {
  const seen = new WeakSet();
  const norm = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v;
    if (seen.has(v as object)) return '[circular]';
    seen.add(v as object);
    if (Array.isArray(v)) return v.map(norm);
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(v as Record<string, unknown>).sort()) {
      out[key] = norm((v as Record<string, unknown>)[key]);
    }
    return out;
  };
  return JSON.stringify(norm(value));
}

export function hashRecord(rec: Omit<AttestationRecord, 'hash'>): string {
  return createHash('sha256').update(canonicalJson(rec)).digest('hex');
}

/** Stamp one entry into a hash-linked record (links to `prevHash`). */
export function makeRecord(
  seq: number,
  prevHash: string | null,
  entry: AttestationEntry,
  ctx: ChainContext,
): AttestationRecord {
  const base = {
    seq,
    timestamp: ctx.now(),
    type: entry.type,
    actor: ctx.actor,
    action: `${ctx.prefix}${entry.action}`,
    meta: entry.meta,
    prevHash,
  };
  return { ...base, hash: hashRecord(base) };
}

/** Chain a batch of entries into an ordered, hash-linked record list. */
export function chainEntries(entries: AttestationEntry[], ctx: ChainContext): AttestationRecord[] {
  const records: AttestationRecord[] = [];
  let prev: string | null = null;
  for (const entry of entries) {
    const rec = makeRecord(records.length, prev, entry, ctx);
    records.push(rec);
    prev = rec.hash;
  }
  return records;
}

/** Wrap chained records in a sealed (unsigned) bundle envelope. */
export function buildBundle(
  records: AttestationRecord[],
  meta: { actor: string; label: string; now: () => string },
): AttestationBundle {
  const last = records[records.length - 1];
  return {
    version: 1,
    actor: meta.actor,
    label: meta.label,
    createdAt: meta.now(),
    count: records.length,
    headHash: last ? last.hash : null,
    signed: false,
    chainIntact: true,
    records,
  };
}

/** Write a bundle to disk as pretty JSON, creating parent dirs. */
export function writeBundle(outPath: string, bundle: AttestationBundle): void {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(bundle, null, 2), 'utf8');
}

export interface BundleVerification {
  ok: boolean;
  count: number;
  /** Index of the first record whose hash or linkage does not verify. */
  brokenAt?: number;
}

/**
 * Re-walk the chain: each record's hash must equal the recomputed hash of its
 * own fields, and its prevHash must equal the previous record's hash. Any edit
 * to any record breaks it here — the property that makes the bundle auditable.
 */
export function verifyLocalBundle(bundle: AttestationBundle): BundleVerification {
  let prev: string | null = null;
  for (let i = 0; i < bundle.records.length; i++) {
    const rec = bundle.records[i];
    if (!rec) return { ok: false, count: bundle.records.length, brokenAt: i };
    const { hash, ...rest } = rec;
    if (rest.prevHash !== prev || hashRecord(rest) !== hash) {
      return { ok: false, count: bundle.records.length, brokenAt: i };
    }
    prev = hash;
  }
  return { ok: true, count: bundle.records.length };
}

export function createLocalAttestationObserver(
  opts: LocalAttestationObserverOptions,
): LocalAttestationObserver {
  const actor = opts.actor ?? 'agent://vigilis';
  const prefix = opts.label ? `${opts.label}.` : '';
  const now = opts.now ?? (() => new Date().toISOString());
  const label = opts.label ?? '';
  const ctx: ChainContext = { actor, prefix, now };
  const records: AttestationRecord[] = [];
  let headHash: string | null = null;

  const append = (type: string, action: string, meta: Record<string, unknown>): void => {
    const rec = makeRecord(records.length, headHash, { type, action, meta }, ctx);
    records.push(rec);
    headHash = rec.hash;
  };

  return {
    get headHash() {
      return headHash;
    },
    get bundlePath() {
      return opts.outPath;
    },
    get records() {
      return records;
    },
    onLoopStart(e) {
      append('loop_start', 'loop.start', { model: e.model });
    },
    onToolCall(e) {
      append('tool_call', `tool.${e.name}`, { step: e.step, input: e.input });
    },
    onToolResult(e) {
      append('tool_result', `tool.${e.name}.result`, {
        step: e.step,
        isError: e.result.isError,
      });
    },
    onModelResponse(e) {
      append('model_response', 'decision', {
        step: e.step,
        stop: e.stopReason,
        tokens_in: e.usage.input_tokens,
        tokens_out: e.usage.output_tokens,
      });
    },
    onLoopEnd(e) {
      append('loop_end', 'loop.end', { steps: e.steps, stop: e.stopReason });
    },
    async flush() {
      writeBundle(opts.outPath, buildBundle(records, { actor, label, now }));
    },
  };
}

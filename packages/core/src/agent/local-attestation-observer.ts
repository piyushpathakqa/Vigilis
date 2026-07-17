import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AgentObserver } from './observer';

export interface AttestationRecord {
  seq: number;
  timestamp: string;
  type: 'loop_start' | 'model_response' | 'tool_call' | 'tool_result' | 'loop_end';
  actor: string;
  action: string;
  meta: Record<string, unknown>;
  prevHash: string | null;
  hash: string;
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

export function createLocalAttestationObserver(
  opts: LocalAttestationObserverOptions,
): LocalAttestationObserver {
  const actor = opts.actor ?? 'agent://vigilis';
  const prefix = opts.label ? `${opts.label}.` : '';
  const now = opts.now ?? (() => new Date().toISOString());
  const label = opts.label ?? '';
  const records: AttestationRecord[] = [];
  let headHash: string | null = null;

  const append = (
    type: AttestationRecord['type'],
    action: string,
    meta: Record<string, unknown>,
  ): void => {
    const base = {
      seq: records.length,
      timestamp: now(),
      type,
      actor,
      action: `${prefix}${action}`,
      meta,
      prevHash: headHash,
    };
    const hash = hashRecord(base);
    const rec: AttestationRecord = { ...base, hash };
    records.push(rec);
    headHash = hash;
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
      const bundle: AttestationBundle = {
        version: 1,
        actor,
        label,
        createdAt: now(),
        count: records.length,
        headHash,
        signed: false,
        chainIntact: true,
        records,
      };
      mkdirSync(dirname(opts.outPath), { recursive: true });
      writeFileSync(opts.outPath, JSON.stringify(bundle, null, 2), 'utf8');
    },
  };
}

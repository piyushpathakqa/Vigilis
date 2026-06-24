/** Triage verdict values — the outcome of classifying a test failure. */
export type Verdict = 'real-bug' | 'dom-drift' | 'flake';

/**
 * A single prior governed memory recalled from the memory backend.
 * This is HINT ONLY — it is injected as prompt context and must never
 * directly branch decision logic.
 */
export interface MemoryRecall {
  verdict: Verdict;
  rationale: string;
  suggestedSelector?: string;
  /** Confidence value 0..1 from ZMem's trust model. */
  trust?: number;
  /**
   * Whether the memory backend has authorized this recall to influence the
   * decision. Always false for recalled data — the live DOM re-verification
   * and conservative classifier own the verdict.
   */
  authority?: boolean;
  /** ZMem/Treeship receipt ID for the remembered decision. */
  receiptId?: string;
}

/** An entry to propose recording in the memory backend after a verdict is reached. */
export interface MemoryRecordEntry {
  specPath: string;
  url: string;
  verdict: Verdict;
  rationale: string;
  suggestedSelector?: string;
  receiptId?: string;
}

/**
 * Swappable memory backend. Implementations must NEVER throw — all errors are
 * swallowed so a missing or broken backend never breaks a triage/heal run.
 */
export interface MemoryProvider {
  /**
   * Recall prior governed verdicts relevant to the failing spec/selector.
   * Returns empty array on any error or when no priors exist.
   * Result is HINT ONLY — inject as prompt context; never branch on it.
   */
  recall(query: {
    specPath: string;
    url: string;
    errorText?: string;
  }): Promise<MemoryRecall[]>;

  /**
   * Propose recording a new verdict in the memory backend.
   * The backend (ZMem) quarantines new entries per its own policy.
   * Resolves (no-op) on any error.
   */
  record(entry: MemoryRecordEntry): Promise<void>;
}

/**
 * Default no-op provider — recall always returns [], record is a no-op.
 * Used when no memory backend is configured; guarantees zero behavior change.
 */
export class NoopMemoryProvider implements MemoryProvider {
  async recall(_query: { specPath: string; url: string; errorText?: string }): Promise<MemoryRecall[]> {
    return [];
  }

  async record(_entry: MemoryRecordEntry): Promise<void> {
    // intentional no-op
  }
}

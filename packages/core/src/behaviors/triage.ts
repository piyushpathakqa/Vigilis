import { resolveModel } from '../index';
import { runAgentLoop, type AgentRunResult } from '../agent/loop';
import type { AnthropicLike } from '../agent/client';
import type { AgentObserver } from '../agent/observer';
import type { ToolContext } from '../tools/types';
import { createDefaultRegistry } from '../tools/definitions';
import { reportVerdict } from '../tools/definitions/report';

export interface Verdict {
  verdict: 'real-bug' | 'dom-drift' | 'flake';
  confidence: 'low' | 'medium' | 'high';
  rationale: string;
  suggestedSelector?: string;
}

export interface TriageOptions {
  client: AnthropicLike;
  specPath: string;
  url: string;
  errorText?: string;
  ctx: ToolContext;
  model?: string;
  maxSteps?: number;
  observer?: AgentObserver;
}

export interface TriageResult {
  verdict: Verdict | null;
  run: AgentRunResult;
}

const TRIAGE_SYSTEM = [
  'You are Argus triaging a FAILED Playwright test. Classify the failure as exactly one of:',
  '- dom-drift: the target element still exists but its locator/data-testid changed',
  '  (the spec\'s selector no longer matches; a different current selector does);',
  '- real-bug: the expected element or behaviour is genuinely missing or broken',
  '  (no equivalent selector exists; the user flow does not work);',
  '- flake: transient/non-deterministic (would pass on a re-run).',
  '',
  'Process:',
  '1. Read the failing spec with fs_read to see what it expected.',
  '2. Navigate to the live app and inspect it with dom_testids, dom_query, browser_snapshot.',
  '3. Compare the spec\'s expectations against what is actually live.',
  '4. Call report_verdict EXACTLY ONCE with your conclusion. For dom-drift, set',
  '   suggestedSelector to the correct current selector.',
  '',
  'Be conservative: only say dom-drift when a clear replacement selector exists. If the',
  'feature is actually broken or missing, it is a real-bug (which must block the gate).',
].join('\n');

const OPUS_TIER = /opus|sonnet-4-6|fable/;

/** Triage behavior: classify a failed test as real-bug / dom-drift / flake. */
export async function triage(opts: TriageOptions): Promise<TriageResult> {
  const {
    client,
    specPath,
    url,
    errorText,
    ctx,
    model = resolveModel('primary'),
    maxSteps = 20,
    observer,
  } = opts;

  const registry = createDefaultRegistry();
  registry.register(reportVerdict);

  let verdict: Verdict | null = null;
  const composed: AgentObserver = {
    ...observer,
    onToolCall: (e) => {
      observer?.onToolCall?.(e);
      if (e.name === 'report_verdict') verdict = e.input as Verdict;
    },
  };

  const prompt = [
    `A Playwright test failed. Spec: ${specPath}. App under test: ${url}.`,
    errorText ? `Failure: ${errorText}` : 'Failure message unavailable.',
    'Triage it and call report_verdict.',
  ].join('\n');

  const run = await runAgentLoop({
    client,
    system: TRIAGE_SYSTEM,
    prompt,
    registry,
    ctx,
    model,
    thinking: OPUS_TIER.test(model),
    maxSteps,
    observer: composed,
  });

  return { verdict, run };
}

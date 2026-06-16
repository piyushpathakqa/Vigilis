import { resolveModel } from '../index';
import { runAgentLoop, type AgentRunResult } from '../agent/loop';
import type { AnthropicLike } from '../agent/client';
import type { AgentObserver } from '../agent/observer';
import type { ToolContext } from '../tools/types';
import { createDefaultRegistry } from '../tools/definitions';

export interface HealOptions {
  client: AnthropicLike;
  specPath: string;
  url: string;
  suggestedSelector: string;
  ctx: ToolContext;
  model?: string;
  maxSteps?: number;
  observer?: AgentObserver;
}

export interface HealResult {
  verified: boolean;
  changedFiles: string[];
  run: AgentRunResult;
}

const OPUS_TIER = /opus|sonnet-4-6|fable/;

function healSystem(specPath: string, selector: string): string {
  return [
    'You are Vigilis, fixing a DOM-drift Playwright test failure (NOT a real bug).',
    `The spec at ${specPath} uses a stale locator that no longer matches the page.`,
    `The correct current selector is: ${selector}`,
    '',
    'Steps:',
    '1. Read the spec with fs_read.',
    '2. Replace ONLY the stale locator(s) with the correct selector. Do not change the test\'s',
    '   intent, assertions, or flow — locators only.',
    '3. Write the fixed spec back with fs_write to the same path.',
    '4. Run it with playwright_run to check it now passes; if not, inspect the DOM and adjust.',
    '',
    'Report briefly when done.',
  ].join('\n');
}

/**
 * Heal behavior: rewrite a drifted locator to the suggested selector, then
 * INDEPENDENTLY re-run the spec to confirm green. The caller opens a PR only when
 * `verified` is true. Heal must only ever be invoked on a `dom-drift` verdict.
 */
export async function heal(opts: HealOptions): Promise<HealResult> {
  const {
    client,
    specPath,
    url,
    suggestedSelector,
    ctx,
    model = resolveModel('primary'),
    maxSteps = 20,
    observer,
  } = opts;

  const registry = createDefaultRegistry();
  const changedFiles: string[] = [];
  const composed: AgentObserver = {
    ...observer,
    onToolResult: (e) => {
      observer?.onToolResult?.(e);
      if (e.name === 'fs_write' && !e.result.isError) {
        const p = e.result.meta?.path;
        if (typeof p === 'string') changedFiles.push(p);
      }
    },
  };

  const run = await runAgentLoop({
    client,
    system: healSystem(specPath, suggestedSelector),
    prompt: `Fix the drifted locator in ${specPath} (app: ${url}) to use ${suggestedSelector}, then verify it passes.`,
    registry,
    ctx,
    model,
    thinking: OPUS_TIER.test(model),
    maxSteps,
    observer: composed,
  });

  // Independent verification — do not trust the agent's claim.
  const verifyRun = await ctx.runner.run(specPath);
  const verified = changedFiles.includes(specPath) && verifyRun.failed === 0;

  return { verified, changedFiles, run };
}

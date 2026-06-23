import { resolveModel } from '../index';
import { runAgentLoop, type AgentRunResult } from '../agent/loop';
import type { AnthropicLike } from '../agent/client';
import type { AgentObserver } from '../agent/observer';
import type { ToolRegistry } from '../tools/registry';
import type { ToolContext } from '../tools/types';
import { PlaywrightAdapter } from '../framework/playwright-adapter';

const defaultAdapter = new PlaywrightAdapter();

/** @deprecated prefer ctx.adapter.specPathForUrl — kept for back-compat. */
export function specPathForUrl(url: string, outDir = 'tests/generated'): string {
  return defaultAdapter.specPathForUrl(url, outDir);
}

export interface GenerateOptions {
  client: AnthropicLike;
  url: string;
  registry: ToolRegistry;
  ctx: ToolContext;
  model?: string;
  outDir?: string;
  maxSteps?: number;
  observer?: AgentObserver;
}

export interface GenerateResult {
  specPath: string;
  writtenFiles: string[];
  run: AgentRunResult;
}

const GENERATE_SYSTEM_HEAD = [
  'You are Vigilis, a senior SDET. Your job is to write ONE runnable end-to-end test',
  'for the web app at the given URL.',
  '',
  'Process:',
  '1. Navigate to the URL and explore with browser_snapshot and dom_testids.',
  '2. If the app requires login, find the credentials shown on the page and log in.',
  '3. Exercise the primary user flow (e.g. log in, then add an item to the cart).',
  '4. Write exactly one spec file to the EXACT path you are given, using fs_write.',
  '',
].join('\n');

const OPUS_TIER = /opus|sonnet-4-6|fable/;

/** Generate behavior: drive the agent loop to write a runnable Playwright spec. */
export async function generate(opts: GenerateOptions): Promise<GenerateResult> {
  const {
    client,
    url,
    registry,
    ctx,
    model = resolveModel('primary'),
    outDir,
    maxSteps = 20,
    observer,
  } = opts;
  const specPath = ctx.adapter.specPathForUrl(url, outDir);
  const system = `${GENERATE_SYSTEM_HEAD}\n${ctx.adapter.generateGuidance()}\n\nKeep exploration focused to limit cost. After writing the file, briefly report what you wrote.`;
  const writtenFiles: string[] = [];

  const composed: AgentObserver = {
    ...observer,
    onToolResult: (e) => {
      observer?.onToolResult?.(e);
      if (e.name === 'fs_write' && !e.result.isError) {
        const p = e.result.meta?.path;
        if (typeof p === 'string') writtenFiles.push(p);
      }
    },
  };

  const run = await runAgentLoop({
    client,
    system,
    prompt: `Generate a ${ctx.adapter.name} test for the app at ${url}. Write the spec to exactly: ${specPath}`,
    registry,
    ctx,
    model,
    thinking: OPUS_TIER.test(model),
    maxSteps,
    observer: composed,
  });

  return { specPath, writtenFiles, run };
}

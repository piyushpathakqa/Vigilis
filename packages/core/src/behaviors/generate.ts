import { resolveModel } from '../index';
import { runAgentLoop, type AgentRunResult } from '../agent/loop';
import type { AnthropicLike } from '../agent/client';
import type { AgentObserver } from '../agent/observer';
import type { ToolRegistry } from '../tools/registry';
import type { ToolContext } from '../tools/types';

/** Map a URL to a deterministic spec path under `outDir`. */
export function specPathForUrl(url: string, outDir = 'tests/generated'): string {
  let pathname = '/';
  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = '/';
  }
  const slug =
    pathname
      .split('/')
      .filter(Boolean)
      .join('-')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '') || 'home';
  return `${outDir}/${slug}.spec.ts`;
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

const GENERATE_SYSTEM = [
  'You are Argus, a senior SDET. Your job is to write ONE runnable Playwright end-to-end test',
  'for the web app at the given URL.',
  '',
  'Process:',
  '1. Navigate to the URL and explore with browser_snapshot and dom_testids.',
  '2. If the app requires login, find the credentials shown on the page and log in.',
  '3. Exercise the primary user flow (e.g. log in, then add an item to the cart).',
  '4. Write exactly one spec file to the EXACT path you are given, using fs_write.',
  '',
  'The spec MUST:',
  "- import { test, expect } from '@playwright/test';",
  '- use getByTestId(...) locators (never brittle text or CSS-structure selectors);',
  '- use web-first assertions that auto-wait — expect(locator).toBeVisible(),',
  '  toHaveText(...), toHaveValue(...). NEVER use page.waitForTimeout or fixed sleeps;',
  '- prove a successful login by asserting an element that only appears AFTER login',
  '  (e.g. a post-login nav or cart testid) — do NOT assert on a URL regex;',
  '- include meaningful assertions on the primary flow (e.g. the cart count changes);',
  '- be one focused, deterministic test, self-contained and runnable with no manual edits;',
  "- baseURL is preconfigured, so use page.goto('/...') relative paths.",
  '',
  'Keep exploration focused to limit cost. After writing the file, briefly report what you wrote.',
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
  const specPath = specPathForUrl(url, outDir);
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
    system: GENERATE_SYSTEM,
    prompt: `Generate a Playwright test for the app at ${url}. Write the spec to exactly: ${specPath}`,
    registry,
    ctx,
    model,
    thinking: OPUS_TIER.test(model),
    maxSteps,
    observer: composed,
  });

  return { specPath, writtenFiles, run };
}

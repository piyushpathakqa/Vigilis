#!/usr/bin/env node
/**
 * @argus/cli — the `argus` command.
 *
 * M0 scaffold: wires up the command surface with placeholder actions. Real
 * behaviors land in M1–M3 (generate: TRE-33, triage: TRE-38, heal: TRE-39).
 */
import { readFile } from 'node:fs/promises';
import { Command } from 'commander';
import {
  ConsoleObserver,
  createAnthropicClient,
  createDefaultRegistry,
  createPlaywrightSession,
  extractFailures,
  generate,
  PlaywrightTestRunner,
  resolveModel,
  runAgentLoop,
  triage,
} from '@argus/core';

const program = new Command();

const PRICES: Record<string, { in: number; out: number }> = {
  'claude-opus-4-8': { in: 5, out: 25 },
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-haiku-4-5': { in: 1, out: 5 },
};

const SMOKE_SYSTEM =
  'You are exploring a web app to understand it. Use the browser and dom tools to ' +
  'navigate, snapshot the page, list its data-testid values, and try the primary flow ' +
  '(e.g. log in, then add an item to the cart). Report concisely what you found. ' +
  'Do not write any files.';

program
  .name('argus')
  .description('Agentic QA: author, generate, triage, and self-heal Playwright tests.')
  .version('0.0.0');

program
  .command('generate')
  .argument('<url>', 'URL of the app under test')
  .option('--model <id>', 'model id (default: primary/Opus)')
  .option('--run', 'run the generated spec after writing it')
  .option('--base-url <url>', 'base URL for running the spec (default: origin of <url>)')
  .option('--out <dir>', 'output directory for the spec', 'tests/generated')
  .option('--max-steps <n>', 'max agent steps', '20')
  .description(
    'Explore the app and write a runnable Playwright spec (needs ANTHROPIC_API_KEY + chromium)',
  )
  .action(
    async (
      url: string,
      opts: { model?: string; run?: boolean; baseUrl?: string; out: string; maxSteps: string },
    ) => {
      const model = opts.model ?? resolveModel('primary');
      const { session, close } = await createPlaywrightSession({ headless: true });
      const runner = new PlaywrightTestRunner({ cwd: process.cwd() });
      try {
        const result = await generate({
          client: createAnthropicClient(),
          url,
          registry: createDefaultRegistry(),
          ctx: { workspaceRoot: process.cwd(), browser: session, runner },
          model,
          outDir: opts.out,
          maxSteps: Number(opts.maxSteps),
          observer: new ConsoleObserver(),
        });

        console.log(
          '\n[argus] wrote: ' + (result.writtenFiles.join(', ') || '(no file written)'),
        );
        const price = PRICES[model];
        const cost = price
          ? `$${((result.run.usage.inputTokens / 1e6) * price.in + (result.run.usage.outputTokens / 1e6) * price.out).toFixed(4)}`
          : 'n/a';
        console.log(
          `[argus] ${result.run.steps} steps · ${result.run.usage.inputTokens} in / ${result.run.usage.outputTokens} out · ~${cost} (${model})`,
        );

        if (opts.run && result.writtenFiles.includes(result.specPath)) {
          // baseURL the generated spec runs against: explicit flag, else the
          // origin of the target URL — so `--run` works on any app.
          const baseUrl = opts.baseUrl ?? new URL(url).origin;
          process.env.ARGUS_BASE_URL = baseUrl;
          console.log(`\n[argus] running ${result.specPath} against ${baseUrl} …`);
          const tr = await runner.run(result.specPath);
          console.log(`[argus] ${tr.summary} (artifacts: ${tr.artifactsDir})`);
          if (tr.failed > 0) process.exitCode = 1;
        } else if (opts.run) {
          console.log('[argus] --run skipped: no spec file was written');
        }
      } finally {
        await close();
      }
    },
  );

program
  .command('author')
  .argument('<intent>', 'Plain-English description of what to test')
  .description('Compile an intent into a structured test plan')
  .action((intent: string) => {
    console.log(`[argus] author "${intent}" — not implemented yet (M1, TRE-?).`);
  });

program
  .command('triage')
  .argument('<url>', 'URL of the app under test')
  .option('--spec <path>', 'the failing spec file')
  .option('--error <text>', 'the Playwright failure message')
  .option('--report <path>', 'a Playwright JSON report to extract the first failure from')
  .option('--model <id>', 'model id (default: primary/Opus)')
  .description(
    'Classify a failed test: real-bug, DOM drift, or flake (needs ANTHROPIC_API_KEY + chromium)',
  )
  .action(
    async (
      url: string,
      opts: { spec?: string; error?: string; report?: string; model?: string },
    ) => {
      let specPath = opts.spec;
      let errorText = opts.error;
      if (opts.report) {
        const report = JSON.parse(await readFile(opts.report, 'utf8'));
        const failures = extractFailures(report);
        if (failures.length === 0) {
          console.log('[argus] no failures found in the report.');
          return;
        }
        specPath = failures[0]!.specPath;
        errorText = failures[0]!.error;
        console.log(`[argus] triaging: ${failures[0]!.title} (${specPath})`);
      }
      if (!specPath) {
        console.error('[argus] provide --spec <path> or --report <playwright.json>');
        process.exitCode = 1;
        return;
      }

      const model = opts.model ?? resolveModel('primary');
      const { session, close } = await createPlaywrightSession({ headless: true });
      const runner = new PlaywrightTestRunner({ cwd: process.cwd() });
      try {
        const result = await triage({
          client: createAnthropicClient(),
          specPath,
          url,
          errorText,
          ctx: { workspaceRoot: process.cwd(), browser: session, runner },
          model,
          observer: new ConsoleObserver(),
        });
        const v = result.verdict;
        if (!v) {
          console.log('\n[argus] no verdict produced.');
          process.exitCode = 1;
        } else {
          console.log(`\n[argus] verdict: ${v.verdict} (${v.confidence})`);
          console.log(`[argus] rationale: ${v.rationale}`);
          if (v.suggestedSelector) {
            console.log(`[argus] suggested selector: ${v.suggestedSelector}`);
          }
          // real-bug must block the gate; drift/flake are recoverable.
          if (v.verdict === 'real-bug') process.exitCode = 1;
        }
        const price = PRICES[model];
        const cost = price
          ? `$${((result.run.usage.inputTokens / 1e6) * price.in + (result.run.usage.outputTokens / 1e6) * price.out).toFixed(4)}`
          : 'n/a';
        console.log(
          `[argus] ${result.run.steps} steps · ${result.run.usage.inputTokens} in / ${result.run.usage.outputTokens} out · ~${cost} (${model})`,
        );
      } finally {
        await close();
      }
    },
  );

program
  .command('heal')
  .argument('<runDir>', 'Path to a triaged drift failure')
  .description('Rewrite the locator, verify green, and open a PR')
  .action((runDir: string) => {
    console.log(`[argus] heal ${runDir} — not implemented yet (M3, TRE-39).`);
  });

program
  .command('smoke')
  .argument('<url>', 'URL of the app under test (e.g. http://localhost:3100/login)')
  .option('--model <id>', 'model id (default: fast model)')
  .option('--headed', 'run with a visible browser')
  .option('--max-steps <n>', 'max agent steps', '8')
  .description(
    'Run the agent loop against a URL and print a step trace + cost (needs ANTHROPIC_API_KEY + chromium)',
  )
  .action(async (url: string, opts: { model?: string; headed?: boolean; maxSteps: string }) => {
    const model = opts.model ?? resolveModel('fast');
    const isOpusTier = /opus|sonnet-4-6|fable/.test(model);
    const { session, close } = await createPlaywrightSession({ headless: !opts.headed });
    try {
      const result = await runAgentLoop({
        client: createAnthropicClient(),
        system: SMOKE_SYSTEM,
        prompt: `Explore ${url} and report its pages, data-testids, and how the add-to-cart flow works.`,
        registry: createDefaultRegistry(),
        ctx: {
          workspaceRoot: process.cwd(),
          browser: session,
          runner: new PlaywrightTestRunner({ cwd: process.cwd() }),
        },
        model,
        thinking: isOpusTier, // adaptive thinking + effort only on Opus-tier; Haiku would 400
        maxSteps: Number(opts.maxSteps),
        observer: new ConsoleObserver(),
      });
      console.log('\n--- result ---\n' + result.finalText);
      const price = PRICES[model];
      const cost = price
        ? `$${((result.usage.inputTokens / 1e6) * price.in + (result.usage.outputTokens / 1e6) * price.out).toFixed(4)}`
        : 'n/a';
      console.log(
        `\n[argus] ${result.steps} steps · ${result.usage.inputTokens} in / ${result.usage.outputTokens} out tokens · ~${cost} (${model})`,
      );
    } finally {
      await close();
    }
  });

program.parse();

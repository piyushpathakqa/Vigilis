#!/usr/bin/env node
/**
 * @argus/cli — the `argus` command.
 *
 * M0 scaffold: wires up the command surface with placeholder actions. Real
 * behaviors land in M1–M3 (generate: TRE-33, triage: TRE-38, heal: TRE-39).
 */
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { Command } from 'commander';

// Load ./.env at startup so a key placed there — exactly as `vigilis init`
// instructs ("in .env or your shell") — is actually picked up at runtime, not
// just detected. Node 20.12+ built-in; shell env vars take precedence. Without
// this, users who put ANTHROPIC_API_KEY in .env still hit "key not set".
if (existsSync('.env')) {
  try {
    process.loadEnvFile('.env');
  } catch {
    // malformed .env — ignore and fall back to the shell environment.
  }
}
import {
  CONFIG_FILE,
  detectPlaywrightConfig,
  hasAnthropicKey,
  loadVigilisConfig,
  writeVigilisConfig,
} from './config';
import {
  type AttestationBundle,
  composeObservers,
  ConsoleObserver,
  createAnthropicClient,
  createAttestationObserver,
  createDefaultRegistry,
  createHealPr,
  createPlaywrightSession,
  extractFailures,
  type Framework,
  verifyLocalBundle,
  generate,
  heal,
  resolveAdapter,
  resolveCloudReporter,
  resolveRefusalDispatcher,
  resolveMemoryProvider,
  resolveModel,
  runAgentLoop,
  triage,
  type CloudReceipt,
} from '@argus/core';

const program = new Command();

const PRICES: Record<string, { in: number; out: number }> = {
  'claude-opus-4-8': { in: 5, out: 25 },
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-haiku-4-5': { in: 1, out: 5 },
};

/** Run a `treeship` CLI subcommand, ignoring failures (e.g. CLI not installed). */
function treeshipCli(args: string[]): Promise<void> {
  return new Promise((resolve) => {
    const child = spawn('treeship', args, { stdio: 'ignore' });
    child.on('error', () => resolve());
    child.on('close', () => resolve());
  });
}

/** Run a `treeship` subcommand and capture its stdout (empty string on any failure). */
function treeshipCapture(args: string[]): Promise<string> {
  return new Promise((resolve) => {
    let out = '';
    const child = spawn('treeship', args, { stdio: ['ignore', 'pipe', 'ignore'] });
    child.stdout?.on('data', (d: Buffer) => (out += d.toString()));
    child.on('error', () => resolve(''));
    child.on('close', () => resolve(out));
  });
}

/** Best-effort git remote slug `owner/name`; undefined on any failure (never throws). */
function repoSlug(): Promise<string | undefined> {
  return new Promise((resolve) => {
    let out = '';
    const child = spawn('git', ['remote', 'get-url', 'origin'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    child.stdout?.on('data', (d: Buffer) => (out += d.toString()));
    child.on('error', () => resolve(undefined));
    child.on('close', () => {
      const raw = out.trim();
      if (!raw) return resolve(undefined);
      // Match owner/name from https://host/owner/name(.git) or git@host:owner/name(.git)
      const m = raw.match(/[/:]([^/:]+\/[^/]+?)(?:\.git)?\/?$/);
      resolve(m?.[1]);
    });
  });
}

/** Publish the just-closed session to the hub and return its public receipt URL (or null). */
async function publishReceipt(): Promise<string | null> {
  const out = await treeshipCapture(['session', 'report', '--no-color']);
  return out.match(/https:\/\/treeship\.dev\/receipt\/\S+/)?.[0] ?? null;
}

const SMOKE_SYSTEM =
  'You are exploring a web app to understand it. Use the browser and dom tools to ' +
  'navigate, snapshot the page, list its data-testid values, and try the primary flow ' +
  '(e.g. log in, then add an item to the cart). Report concisely what you found. ' +
  'Do not write any files.';

program
  .name('vigilis')
  .description('Agentic QA: generate, triage, and self-heal Playwright, Cypress & Selenium tests.')
  .version('0.4.0');

program
  .command('init')
  .description('Scaffold vigilis.config.json so you can use Vigilis in your own Playwright, Cypress, or Selenium project')
  .option('--force', 'overwrite an existing vigilis.config.json')
  .action((opts: { force?: boolean }) => {
    const cwd = process.cwd();

    const pw = detectPlaywrightConfig(cwd);
    if (pw) {
      console.log(`[vigilis] detected Playwright project (${pw})`);
    } else {
      console.log(
        '[vigilis] no playwright.config.* found here. Vigilis works with Playwright, Cypress, or Selenium — ' +
          'run `npm init playwright@latest` first if you need a Playwright setup, or set --framework in your config.',
      );
    }

    const { written, path } = writeVigilisConfig(cwd, { force: opts.force });
    if (written) console.log(`[vigilis] wrote ${path}`);
    else
      console.log(
        `[vigilis] ${CONFIG_FILE} already exists — left untouched (use --force to overwrite).`,
      );

    console.log('\nNext steps:');
    let n = 1;
    if (!hasAnthropicKey(cwd)) {
      console.log(
        `  ${n++}. Set ANTHROPIC_API_KEY (in .env or your shell) — needed for generate/triage/heal.`,
      );
    }
    console.log(`  ${n++}. Edit ${CONFIG_FILE} (baseUrl, testDir, model) to match your app.`);
    console.log(`  ${n++}. vigilis generate <url>            # explore the app and write a spec`);
    console.log(
      `  ${n++}. vigilis heal <url> --spec <file>  # self-heal drift → verified PR + signed receipt`,
    );
  });

program
  .command('generate')
  .argument('<url>', 'URL of the app under test')
  .option('--model <id>', 'model id (default: primary/Opus)')
  .option('--run', 'run the generated spec after writing it')
  .option('--base-url <url>', 'base URL for running the spec (default: origin of <url>)')
  .option('--out <dir>', 'output directory for the spec (default: framework convention)')
  .option('--max-steps <n>', 'max agent steps', '20')
  .option(
    '--framework <name>',
    'test framework: playwright | cypress | selenium (default: auto-detect)',
  )
  .description(
    'Explore the app and write a runnable spec for your test framework (needs ANTHROPIC_API_KEY + chromium)',
  )
  .action(
    async (
      url: string,
      opts: {
        model?: string;
        run?: boolean;
        baseUrl?: string;
        out?: string;
        maxSteps: string;
        framework?: string;
      },
    ) => {
      const { config, found } = loadVigilisConfig(process.cwd());
      const model = opts.model ?? (found ? config.model : undefined) ?? resolveModel('primary');
      const adapter = await resolveAdapter(process.cwd(), opts.framework as Framework | undefined);
      const { session, close } = await createPlaywrightSession({ headless: true });
      const runner = adapter.createRunner({ cwd: process.cwd() });
      try {
        const result = await generate({
          client: createAnthropicClient(),
          url,
          registry: createDefaultRegistry(),
          ctx: { workspaceRoot: process.cwd(), browser: session, runner, adapter },
          model,
          outDir: opts.out,
          maxSteps: Number(opts.maxSteps),
          observer: new ConsoleObserver(),
        });

        console.log(
          '\n[vigilis] wrote: ' + (result.writtenFiles.join(', ') || '(no file written)'),
        );
        const price = PRICES[model];
        const cost = price
          ? `$${((result.run.usage.inputTokens / 1e6) * price.in + (result.run.usage.outputTokens / 1e6) * price.out).toFixed(4)}`
          : 'n/a';
        console.log(
          `[vigilis] ${result.run.steps} steps · ${result.run.usage.inputTokens} in / ${result.run.usage.outputTokens} out · ~${cost} (${model})`,
        );

        if (opts.run && result.writtenFiles.includes(result.specPath)) {
          // baseURL the generated spec runs against: explicit flag, else the
          // origin of the target URL — so `--run` works on any app.
          const baseUrl =
            opts.baseUrl ?? (found ? config.baseUrl : undefined) ?? new URL(url).origin;
          process.env.ARGUS_BASE_URL = baseUrl;
          console.log(`\n[vigilis] running ${result.specPath} against ${baseUrl} …`);
          const tr = await runner.run(result.specPath);
          console.log(`[vigilis] ${tr.summary} (artifacts: ${tr.artifactsDir})`);
          if (tr.failed > 0) process.exitCode = 1;
        } else if (opts.run) {
          console.log('[vigilis] --run skipped: no spec file was written');
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
    console.log(`[vigilis] author "${intent}" — not implemented yet (M1, TRE-?).`);
  });

program
  .command('triage')
  .argument('<url>', 'URL of the app under test')
  .option('--spec <path>', 'the failing spec file')
  .option('--error <text>', 'the Playwright failure message')
  .option('--report <path>', 'a Playwright JSON report to extract the first failure from')
  .option('--model <id>', 'model id (default: primary/Opus)')
  .option(
    '--framework <name>',
    'test framework: playwright | cypress | selenium (default: auto-detect)',
  )
  .option('--memory <mode>', 'memory backend: off | auto | zmem (default: auto)')
  .description(
    'Classify a failed test: real-bug, DOM drift, or flake (needs ANTHROPIC_API_KEY + chromium)',
  )
  .action(
    async (
      url: string,
      opts: { spec?: string; error?: string; report?: string; model?: string; framework?: string; memory?: string },
    ) => {
      let specPath = opts.spec;
      let errorText = opts.error;
      if (opts.report) {
        const report = JSON.parse(await readFile(opts.report, 'utf8'));
        const failures = extractFailures(report);
        if (failures.length === 0) {
          console.log('[vigilis] no failures found in the report.');
          return;
        }
        specPath = failures[0]!.specPath;
        errorText = failures[0]!.error;
        console.log(`[vigilis] triaging: ${failures[0]!.title} (${specPath})`);
      }
      if (!specPath) {
        console.error('[vigilis] provide --spec <path> or --report <playwright.json>');
        process.exitCode = 1;
        return;
      }

      const cfg = loadVigilisConfig(process.cwd());
      const model =
        opts.model ?? (cfg.found ? cfg.config.model : undefined) ?? resolveModel('primary');
      const memoryMode = (opts.memory ?? (cfg.found ? cfg.config.memory : undefined) ?? 'auto') as 'off' | 'auto' | 'zmem';
      const memoryProvider = await resolveMemoryProvider(process.cwd(), { mode: memoryMode });
      const adapter = await resolveAdapter(process.cwd(), opts.framework as Framework | undefined);
      const { session, close } = await createPlaywrightSession({ headless: true });
      const runner = adapter.createRunner({ cwd: process.cwd() });
      try {
        const result = await triage({
          client: createAnthropicClient(),
          specPath,
          url,
          errorText,
          ctx: { workspaceRoot: process.cwd(), browser: session, runner, adapter },
          model,
          observer: new ConsoleObserver(),
          memory: memoryProvider,
        });
        const v = result.verdict;
        if (!v) {
          console.log('\n[vigilis] no verdict produced.');
          process.exitCode = 1;
        } else {
          console.log(`\n[vigilis] verdict: ${v.verdict} (${v.confidence})`);
          console.log(`[vigilis] rationale: ${v.rationale}`);
          if (v.suggestedSelector) {
            console.log(`[vigilis] suggested selector: ${v.suggestedSelector}`);
          }
          // real-bug must block the gate; drift/flake are recoverable.
          if (v.verdict === 'real-bug') process.exitCode = 1;
        }
        const price = PRICES[model];
        const cost = price
          ? `$${((result.run.usage.inputTokens / 1e6) * price.in + (result.run.usage.outputTokens / 1e6) * price.out).toFixed(4)}`
          : 'n/a';
        console.log(
          `[vigilis] ${result.run.steps} steps · ${result.run.usage.inputTokens} in / ${result.run.usage.outputTokens} out · ~${cost} (${model})`,
        );
      } finally {
        await close();
      }
    },
  );

program
  .command('heal')
  .argument('<url>', 'URL of the app under test')
  .requiredOption('--spec <path>', 'the failing spec file')
  .option('--error <text>', 'the Playwright failure message')
  .option('--no-pr', 'leave the verified fix on a local branch; do not push/open a PR')
  .option('--no-receipt', 'skip the Treeship provenance receipt')
  .option('--no-publish', 'seal the receipt locally but do not upload it to the Treeship hub')
  .option('--model <id>', 'model id (default: primary/Opus)')
  .option(
    '--framework <name>',
    'test framework: playwright | cypress | selenium (default: auto-detect)',
  )
  .option('--memory <mode>', 'memory backend: off | auto | zmem (default: auto)')
  .description(
    'Triage a failure and, only for DOM drift, rewrite the locator, verify green, and open a PR',
  )
  .action(
    async (
      url: string,
      opts: {
        spec: string;
        error?: string;
        pr: boolean;
        receipt: boolean;
        publish: boolean;
        model?: string;
        framework?: string;
        memory?: string;
      },
    ) => {
      const cfg = loadVigilisConfig(process.cwd());
      const model =
        opts.model ?? (cfg.found ? cfg.config.model : undefined) ?? resolveModel('primary');
      const memoryMode = (opts.memory ?? (cfg.found ? cfg.config.memory : undefined) ?? 'auto') as 'off' | 'auto' | 'zmem';
      const memoryProvider = await resolveMemoryProvider(process.cwd(), { mode: memoryMode });
      const slug = (opts.spec.split('/').pop() ?? 'spec').replace(/\.spec\.ts$/, '');
      const adapter = await resolveAdapter(process.cwd(), opts.framework as Framework | undefined);
      const { session, close } = await createPlaywrightSession({ headless: true });
      const runner = adapter.createRunner({ cwd: process.cwd() });
      const ctx = { workspaceRoot: process.cwd(), browser: session, runner, adapter };

      // Provenance is ON by default: wrap the whole self-heal in one signed Treeship
      // session. A no-op if the `treeship` CLI isn't installed (the observer is null).
      // Opt out with --no-receipt.
      const attestation =
        opts.receipt === false
          ? null
          : await createAttestationObserver({
              label: 'heal',
              outPath: `.vigilis/attestation/heal-${slug}.json`,
            });
      if (attestation?.kind === 'treeship') {
        await treeshipCli(['session', 'start', '--name', `vigilis heal ${slug}`]);
      }
      const observer = composeObservers(new ConsoleObserver(), attestation?.observer);

      // Optional governance-cloud reporter: no-op unless VIGILIS_CLOUD_KEY is set.
      const reporter = resolveCloudReporter();
      // Captured across early returns so we can report exactly one receipt in finally.
      let cloudVerdict: { verdict: string; rationale?: string; suggestedSelector?: string; confidence?: string } | null = null;
      let cloudHealed = false;

      try {
        // 1. Triage — Heal only ever runs on dom-drift.
        const t = await triage({
          client: createAnthropicClient(),
          specPath: opts.spec,
          url,
          errorText: opts.error,
          ctx,
          model,
          observer,
          memory: memoryProvider,
        });
        const v = t.verdict;
        if (v) {
          cloudVerdict = {
            verdict: v.verdict,
            rationale: v.rationale,
            suggestedSelector: v.suggestedSelector,
            confidence: v.confidence,
          };
        }
        console.log(`\n[vigilis] verdict: ${v ? `${v.verdict} (${v.confidence})` : 'none'}`);
        if (v) console.log(`[vigilis] rationale: ${v.rationale}`);

        if (!v || v.verdict !== 'dom-drift' || !v.suggestedSelector) {
          if (v?.verdict === 'real-bug') {
            console.log('[vigilis] real bug — refusing to heal; the gate stays blocked.');
            process.exitCode = 1;
          } else {
            console.log('[vigilis] not a healable DOM drift; nothing to do.');
          }
          return;
        }

        // 2. Heal — rewrite the locator and verify green independently.
        console.log(`\n[vigilis] healing drift → ${v.suggestedSelector}`);
        const h = await heal({
          client: createAnthropicClient(),
          specPath: opts.spec,
          url,
          suggestedSelector: v.suggestedSelector,
          ctx,
          model,
          observer,
        });
        cloudHealed = h.verified === true;
        if (!h.verified || h.changedFiles.length === 0) {
          console.log('[vigilis] could not produce a verified green fix; no PR opened.');
          process.exitCode = 1;
          return;
        }
        console.log(`[vigilis] verified green · changed: ${h.changedFiles.join(', ')}`);

        // 3. Open the PR (unless --no-pr).
        const branch = `argus/heal-${slug}-${Date.now().toString(36)}`;
        if (opts.pr === false) {
          console.log(`[vigilis] --no-pr: fix is on disk. Open it with:`);
          console.log(`  git checkout -b ${branch} && git add ${h.changedFiles.join(' ')} && \\`);
          console.log(`  git commit -m "Vigilis: heal DOM drift" && gh pr create --fill`);
          return;
        }
        const title = `Vigilis: heal DOM drift in ${slug}`;
        const body = [
          `Vigilis triaged a failing Playwright test as **dom-drift** and self-healed it.`,
          ``,
          `- **Spec:** \`${opts.spec}\``,
          `- **New selector:** \`${v.suggestedSelector}\``,
          `- **Rationale:** ${v.rationale}`,
          ``,
          `The fix was verified green by re-running the spec before opening this PR.`,
        ].join('\n');
        const pr = await createHealPr({
          cwd: process.cwd(),
          branch,
          files: h.changedFiles,
          title,
          body,
        });
        console.log(`\n[vigilis] opened PR: ${pr.url}`);
      } finally {
        // Seal the provenance session (records every tool call + decision above).
        await attestation?.observer.flush();
        let receiptUrl: string | null = null;
        if (attestation?.kind === 'treeship') {
          await treeshipCli(['session', 'close']);
          receiptUrl = opts.publish === false ? null : await publishReceipt();
          if (receiptUrl) {
            console.log(`\n[vigilis] 🔏 provenance receipt: ${receiptUrl}`);
            console.log('[vigilis] public, no login, independently verifiable.');
          } else {
            console.log(
              '\n[vigilis] provenance receipt sealed — verify it with `treeship verify last`, ' +
                'or publish a shareable URL with `treeship session report` ' +
                '(needs `treeship hub attach` once).',
            );
          }
        } else if (attestation?.kind === 'local' && attestation.local) {
          const bundle = JSON.parse(
            readFileSync(attestation.local.bundlePath, 'utf8'),
          ) as AttestationBundle;
          const v = verifyLocalBundle(bundle);
          console.log(
            `\n[vigilis] 🔗 local attestation: ${v.count} artifacts, ${
              v.ok ? 'chain intact' : `CHAIN BROKEN at #${v.brokenAt}`
            } (unsigned)`,
          );
          console.log(`[vigilis] bundle: ${attestation.local.bundlePath}`);
          console.log(
            '[vigilis] verifiable + auditable — not a correctness guarantee. ' +
              'Configure Treeship for a signed, independently-notarized receipt.',
          );
        }

        // Optional best-effort governance-cloud report. No-op unless a key is
        // configured; report() never throws. Only report once we have a verdict.
        if (cloudVerdict) {
          const receipt: CloudReceipt = {
            specPath: opts.spec,
            url,
            verdict: cloudVerdict.verdict,
            rationale: cloudVerdict.rationale,
            suggestedSelector: cloudVerdict.suggestedSelector,
            healed: cloudHealed,
            framework: adapter.name,
            repo: await repoSlug(),
            receiptUrl: receiptUrl ?? undefined,
            timestamp: new Date().toISOString(),
          };
          await reporter.report(receipt);
        }

        // Optional refusal actions (Slack alert + Linear ticket). No-op unless
        // SLACK_WEBHOOK_URL / LINEAR_API_KEY+LINEAR_TEAM_ID are set; never throws.
        // Only on a refusal — the gate's most actionable event.
        if (cloudVerdict?.verdict === 'real-bug') {
          await resolveRefusalDispatcher().dispatch({
            specPath: opts.spec,
            url,
            rationale: cloudVerdict.rationale ?? '',
            confidence: cloudVerdict.confidence,
            framework: adapter.name,
            repo: await repoSlug(),
            receiptUrl: receiptUrl ?? undefined,
            timestamp: new Date().toISOString(),
          });
        }

        await close();
      }
    },
  );

program
  .command('smoke')
  .argument('<url>', 'URL of the app under test (e.g. http://localhost:3100/login)')
  .option('--model <id>', 'model id (default: fast model)')
  .option('--headed', 'run with a visible browser')
  .option('--max-steps <n>', 'max agent steps', '8')
  .option(
    '--framework <name>',
    'test framework: playwright | cypress | selenium (default: auto-detect)',
  )
  .description(
    'Run the agent loop against a URL and print a step trace + cost (needs ANTHROPIC_API_KEY + chromium)',
  )
  .action(
    async (
      url: string,
      opts: { model?: string; headed?: boolean; maxSteps: string; framework?: string },
    ) => {
      const model = opts.model ?? resolveModel('fast');
      const isOpusTier = /opus|sonnet-4-6|fable/.test(model);
      const adapter = await resolveAdapter(process.cwd(), opts.framework as Framework | undefined);
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
            runner: adapter.createRunner({ cwd: process.cwd() }),
            adapter,
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
          `\n[vigilis] ${result.steps} steps · ${result.usage.inputTokens} in / ${result.usage.outputTokens} out tokens · ~${cost} (${model})`,
        );
      } finally {
        await close();
      }
    },
  );

// Top-level catch: async command errors surface as a clean one-line message
// (with the underlying detail) and a non-zero exit — never a raw stack trace.
program.parseAsync().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\n[vigilis] ${msg}`);
  process.exit(1);
});

/**
 * vigilis.config.json — per-project defaults so a dev can drop Vigilis into their
 * own Playwright repo. Explicit CLI flags always override these values; the
 * config only supplies defaults, and only when the file is actually present.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface VigilisConfig {
  /** Base URL the app under test is served from. */
  baseUrl: string;
  /** Directory where Playwright specs live / are written. */
  testDir: string;
  /** Default model id for generate/triage/heal. */
  model: string;
  /** Whether `heal` opens a PR for a verified fix. */
  openPr: boolean;
  /** Whether a Treeship provenance receipt is produced. */
  receipt: boolean;
  /** Chosen framework; omit to auto-detect. */
  framework?: 'playwright' | 'cypress' | 'selenium';
}

export const CONFIG_FILE = 'vigilis.config.json';

export const DEFAULT_CONFIG: VigilisConfig = {
  baseUrl: 'http://localhost:3000',
  testDir: 'tests',
  model: 'claude-haiku-4-5',
  openPr: true,
  receipt: true,
};

const PLAYWRIGHT_CONFIGS = [
  'playwright.config.ts',
  'playwright.config.js',
  'playwright.config.mjs',
  'playwright.config.cjs',
];

/** Return the name of the Playwright config in `cwd`, or null if none is found. */
export function detectPlaywrightConfig(cwd = process.cwd()): string | null {
  return PLAYWRIGHT_CONFIGS.find((f) => existsSync(join(cwd, f))) ?? null;
}

/**
 * Load vigilis.config.json from `cwd`, merged over defaults. `found` is false when
 * the file is missing or unreadable — callers use it so config never silently
 * changes behavior unless the user actually created the file.
 */
export function loadVigilisConfig(cwd = process.cwd()): { config: VigilisConfig; found: boolean } {
  const path = join(cwd, CONFIG_FILE);
  if (!existsSync(path)) return { config: { ...DEFAULT_CONFIG }, found: false };
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<VigilisConfig>;
    return { config: { ...DEFAULT_CONFIG, ...parsed }, found: true };
  } catch {
    return { config: { ...DEFAULT_CONFIG }, found: false };
  }
}

/** Write vigilis.config.json. No-op (written:false) if it exists and `force` is not set. */
export function writeVigilisConfig(
  cwd = process.cwd(),
  opts: { force?: boolean } = {},
): { written: boolean; path: string } {
  const path = join(cwd, CONFIG_FILE);
  if (existsSync(path) && !opts.force) return { written: false, path };
  writeFileSync(path, JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n');
  return { written: true, path };
}

/** Best-effort check for an Anthropic key (env, or an ANTHROPIC_API_KEY line in .env). */
export function hasAnthropicKey(cwd = process.cwd()): boolean {
  if (process.env.ANTHROPIC_API_KEY) return true;
  const envPath = join(cwd, '.env');
  if (!existsSync(envPath)) return false;
  try {
    return /^\s*ANTHROPIC_API_KEY\s*=\s*\S/m.test(readFileSync(envPath, 'utf8'));
  } catch {
    return false;
  }
}

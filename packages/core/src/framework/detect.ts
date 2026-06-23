import { readFile as fsReadFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { FRAMEWORKS, type Framework } from './types';

export interface DetectFs {
  readFile(path: string): Promise<string>;
  exists(path: string): Promise<boolean>;
}

const nodeFs: DetectFs = {
  readFile: (p) => fsReadFile(p, 'utf8'),
  exists: async (p) => {
    try { await access(p); return true; } catch { return false; }
  },
};

interface Signature {
  deps: string[];
  configs: string[];
}

const SIGNATURES: Record<Framework, Signature> = {
  playwright: { deps: ['@playwright/test', 'playwright'], configs: ['playwright.config.ts', 'playwright.config.js', 'playwright.config.mjs'] },
  cypress: { deps: ['cypress'], configs: ['cypress.config.ts', 'cypress.config.js', 'cypress.json'] },
  selenium: { deps: ['selenium-webdriver'], configs: [] },
};

export interface FrameworkScore {
  framework: Framework;
  confidence: number;
}

/** Score each framework 0..1 from package.json deps + config-file presence. */
export async function detectFramework(cwd: string, fs: DetectFs = nodeFs): Promise<FrameworkScore[]> {
  let deps: Record<string, string> = {};
  try {
    const pkg = JSON.parse(await fs.readFile(join(cwd, 'package.json'))) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    deps = { ...pkg.dependencies, ...pkg.devDependencies };
  } catch {
    deps = {};
  }

  const scores: FrameworkScore[] = [];
  for (const framework of FRAMEWORKS) {
    const sig = SIGNATURES[framework];
    const hasDep = sig.deps.some((d) => d in deps);
    let hasConfig = false;
    for (const c of sig.configs) {
      if (await fs.exists(join(cwd, c))) {
        hasConfig = true;
        break;
      }
    }
    const confidence = (hasDep ? 0.6 : 0) + (hasConfig ? 0.4 : 0);
    if (confidence > 0) scores.push({ framework, confidence });
  }
  return scores.sort((a, b) => b.confidence - a.confidence);
}

/** Highest-confidence framework, or null if none detected. */
export function pickFramework(scores: FrameworkScore[]): Framework | null {
  return scores[0]?.framework ?? null;
}

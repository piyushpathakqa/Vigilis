import { createPlaywrightSession, resolveAdapter, type ToolContext } from '@argus/core';

export interface LazyContext {
  getContext: () => Promise<ToolContext>;
  close: () => Promise<void>;
}

/**
 * A tool context that launches chromium on first use (so merely starting the
 * server doesn't spawn a browser) and reuses it thereafter.
 */
export function createLazyContext(): LazyContext {
  let ctx: ToolContext | undefined;
  let close: (() => Promise<void>) | undefined;

  return {
    getContext: async () => {
      if (!ctx) {
        const handle = await createPlaywrightSession({ headless: true });
        close = handle.close;
        const adapter = await resolveAdapter(process.cwd());
        ctx = {
          workspaceRoot: process.cwd(),
          browser: handle.session,
          runner: adapter.createRunner({ cwd: process.cwd() }),
          adapter,
        };
      }
      return ctx;
    },
    close: async () => {
      if (close) await close();
    },
  };
}

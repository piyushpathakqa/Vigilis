import { ToolRegistry } from '../registry';
import { fsRead, fsWrite, fsList } from './fs';
import { browserNavigate, browserClick, browserType, browserSnapshot } from './browser';
import { domQuery, domTestids } from './dom';
import { testRun } from './test-run';
import { playwrightRun } from './playwright';
import { webSearch } from './web-search';

/** Every built-in tool, in a stable order. */
export const ALL_TOOLS = [
  fsRead,
  fsWrite,
  fsList,
  browserNavigate,
  browserClick,
  browserType,
  browserSnapshot,
  domQuery,
  domTestids,
  testRun,
  playwrightRun, // deprecated alias — remove next release
  webSearch,
];

/** A fresh registry with all built-in tools registered. */
export function createDefaultRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  for (const tool of ALL_TOOLS) {
    registry.register(tool);
  }
  return registry;
}

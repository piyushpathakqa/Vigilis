import { ToolRegistry } from '../registry';
import { fsRead, fsWrite, fsList } from './fs';
import { browserNavigate, browserClick, browserType, browserSnapshot } from './browser';
import { domQuery, domTestids } from './dom';
import { testRun } from './test-run';
import { playwrightRun } from './playwright';
import { createSearchTools } from './search';
import { resolveSearchProvider, type SearchProvider } from '../../search';

/** Local built-in tools, in a stable order. Search tools are resolved per registry. */
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
];

/** A fresh registry. Web lookup is lazy; pass search:false or VIGILIS_SEARCH=off to disable. */
export function createDefaultRegistry(
  opts: { search?: SearchProvider | false } = {},
): ToolRegistry {
  const registry = new ToolRegistry();
  for (const tool of ALL_TOOLS) {
    registry.register(tool);
  }
  const search = resolveSearchProvider(opts.search);
  if (search) {
    for (const tool of createSearchTools(search)) registry.register(tool);
  }
  return registry;
}

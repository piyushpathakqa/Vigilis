import { describe, it, expect } from 'vitest';
import { createDefaultRegistry } from './definitions';

const EXPECTED = [
  'fs_read',
  'fs_write',
  'fs_list',
  'browser_navigate',
  'browser_click',
  'browser_type',
  'browser_snapshot',
  'dom_query',
  'dom_testids',
  'playwright_run',
];

describe('createDefaultRegistry', () => {
  it('registers all 10 tools', () => {
    const r = createDefaultRegistry();
    expect(r.list().map((t) => t.name).sort()).toEqual([...EXPECTED].sort());
  });

  it('adapts every tool for Anthropic and MCP', () => {
    const r = createDefaultRegistry();
    expect(r.toAnthropic()).toHaveLength(10);
    expect(r.toMcp()).toHaveLength(10);
    for (const t of r.toAnthropic()) {
      expect(t.input_schema.type).toBe('object');
    }
  });
});

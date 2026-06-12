import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { ToolRegistry } from './registry';
import { defineTool } from './types';

const tool = defineTool({
  name: 'nav',
  description: 'Navigate',
  input: z.object({ url: z.string().describe('target URL'), wait: z.number().optional() }),
  handler: async () => ({ content: 'ok' }),
});

describe('registry adapters', () => {
  it('toAnthropic emits {name, description, input_schema} without $schema', () => {
    const r = new ToolRegistry();
    r.register(tool);
    const t = r.toAnthropic()[0]!;
    expect(t.name).toBe('nav');
    expect(t.description).toBe('Navigate');
    expect(t.input_schema.type).toBe('object');
    expect(Object.keys(t.input_schema.properties ?? {})).toEqual(['url', 'wait']);
    expect(t.input_schema.required).toEqual(['url']);
    expect('$schema' in t.input_schema).toBe(false);
  });

  it('toMcp exposes the Zod raw shape', () => {
    const r = new ToolRegistry();
    r.register(tool);
    const t = r.toMcp()[0]!;
    expect(t.name).toBe('nav');
    expect(Object.keys(t.inputSchema)).toEqual(['url', 'wait']);
  });
});

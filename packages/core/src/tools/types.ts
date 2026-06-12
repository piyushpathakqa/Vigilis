import type { z } from 'zod';

/** Thrown by tool handlers for a clean, user-facing error message. */
export class ToolError extends Error {
  override name = 'ToolError';
}

/** Runtime dependencies a tool handler may use. Injected by the caller. */
export interface ToolContext {
  /** Absolute directory that all fs_* tools are sandboxed to. */
  workspaceRoot: string;
  /** Live page/browser. Real impl injected by the agent loop (TRE-32); faked in tests. */
  browser: BrowserSession;
  /** Runs Playwright specs. Real impl injected by TRE-32; faked in tests. */
  runner: TestRunner;
}

/** Matched element returned by a DOM query. */
export interface DomMatch {
  tag: string;
  text: string;
  attributes: Record<string, string>;
}

/** The single seam for all browser + DOM tools. */
export interface BrowserSession {
  navigate(url: string): Promise<void>;
  click(selector: string): Promise<void>;
  type(selector: string, text: string): Promise<void>;
  /** Trimmed HTML / a11y summary of the current page, for the agent to "see" it. */
  snapshot(): Promise<string>;
  /** Matched elements for a selector. */
  query(selector: string): Promise<DomMatch[]>;
  /** All data-testid values currently present on the page. */
  testids(): Promise<string[]>;
  /** Current page URL. */
  url(): string;
}

/** Result of running Playwright specs. */
export interface TestRunResult {
  passed: number;
  failed: number;
  summary: string;
  /** Directory holding traces/screenshots/logs (fuel for Triage). */
  artifactsDir: string;
}

/** Runs Playwright specs and reports results + artifact location. */
export interface TestRunner {
  run(specPath?: string): Promise<TestRunResult>;
}

/** What a tool returns. Never throws out of the registry — errors come back here. */
export interface ToolResult {
  content: string;
  meta?: Record<string, unknown>;
  isError?: boolean;
}

/** A Zod object schema for a tool's input. */
export type ToolInputSchema = z.ZodObject<z.ZodRawShape>;

/** A single tool: identity, input schema, and a handler over the context. */
export interface ToolDefinition<S extends ToolInputSchema = ToolInputSchema> {
  name: string;
  description: string;
  input: S;
  handler: (input: z.infer<S>, ctx: ToolContext) => Promise<ToolResult>;
}

/** Identity helper that preserves input-type inference in the handler. */
export function defineTool<S extends ToolInputSchema>(def: ToolDefinition<S>): ToolDefinition {
  return def as unknown as ToolDefinition;
}

/** Anthropic Messages API tool param shape (structural — no SDK import). */
export interface AnthropicToolParam {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
    [k: string]: unknown;
  };
}

/** MCP tool registration payload (Zod raw shape; the MCP server consumes it in TRE-42). */
export interface McpToolParam {
  name: string;
  description: string;
  inputSchema: z.ZodRawShape;
}

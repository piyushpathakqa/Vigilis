import type Anthropic from '@anthropic-ai/sdk';
import type {
  BrowserSession,
  DomMatch,
  TestRunResult,
  TestRunner,
  ToolContext,
} from '../types';
import { PlaywrightAdapter } from '../../framework/playwright-adapter';
import type { AnthropicLike } from '../../agent/client';

/** Build a minimal valid Anthropic.Message for tests. Accepts request-shaped blocks
 *  (ContentBlockParam) so test literals don't need response-only fields like `citations`. */
export function makeMessage(
  content: Anthropic.ContentBlockParam[],
  stopReason: Anthropic.Message['stop_reason'],
): Anthropic.Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-4-8',
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: 10,
      output_tokens: 5,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    },
  } as unknown as Anthropic.Message;
}

/** Returns queued messages in order; records the request bodies it received. */
export class FakeAnthropicClient implements AnthropicLike {
  bodies: Anthropic.MessageCreateParamsNonStreaming[] = [];
  /** Message-array length captured at each call time (the live array is mutated in place). */
  messageCounts: number[] = [];
  constructor(private queue: Anthropic.Message[]) {}
  messages = {
    create: async (body: Anthropic.MessageCreateParamsNonStreaming) => {
      this.bodies.push(body);
      this.messageCounts.push(Array.isArray(body.messages) ? body.messages.length : 0);
      const next = this.queue.shift();
      if (!next) throw new Error('FakeAnthropicClient: queue exhausted');
      return next;
    },
  };
}

/** Records calls and returns canned data. For unit tests only. */
export class FakeBrowserSession implements BrowserSession {
  calls: string[] = [];
  current = 'about:blank';
  snapshotHtml = '<html></html>';
  queryResult: DomMatch[] = [];
  testidList: string[] = [];

  async navigate(url: string): Promise<void> {
    this.calls.push(`navigate:${url}`);
    this.current = url;
  }
  async click(selector: string): Promise<void> {
    this.calls.push(`click:${selector}`);
  }
  async type(selector: string, text: string): Promise<void> {
    this.calls.push(`type:${selector}:${text}`);
  }
  async snapshot(): Promise<string> {
    this.calls.push('snapshot');
    return this.snapshotHtml;
  }
  async query(selector: string): Promise<DomMatch[]> {
    this.calls.push(`query:${selector}`);
    return this.queryResult;
  }
  async testids(): Promise<string[]> {
    this.calls.push('testids');
    return this.testidList;
  }
  url(): string {
    return this.current;
  }
}

/** Returns a canned run result. For unit tests only. */
export class FakeTestRunner implements TestRunner {
  lastSpec: string | undefined;
  result: TestRunResult = { passed: 0, failed: 0, summary: 'no run', artifactsDir: '/tmp/none' };

  async run(specPath?: string): Promise<TestRunResult> {
    this.lastSpec = specPath;
    return this.result;
  }
}

/** Build a ToolContext wired to the given (or fresh) fakes. */
export function makeFakeCtx(over: Partial<ToolContext> = {}): ToolContext {
  return {
    workspaceRoot: over.workspaceRoot ?? '/tmp/argus-ws',
    browser: over.browser ?? new FakeBrowserSession(),
    runner: over.runner ?? new FakeTestRunner(),
    adapter: over.adapter ?? new PlaywrightAdapter(),
  };
}

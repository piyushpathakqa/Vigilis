import type {
  BrowserSession,
  DomMatch,
  TestRunResult,
  TestRunner,
  ToolContext,
} from '../types';

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
  };
}

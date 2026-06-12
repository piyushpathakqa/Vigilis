import { describe, it, expect } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { triage } from './triage';
import { FakeAnthropicClient, makeFakeCtx, makeMessage } from '../tools/testing/fakes';

describe('triage', () => {
  it('captures a structured verdict from the report_verdict tool call', async () => {
    const root = await mkdtemp(join(tmpdir(), 'argus-triage-'));
    try {
      await mkdir(join(root, 'tests/generated'), { recursive: true });
      await writeFile(join(root, 'tests/generated/login.spec.ts'), '// spec', 'utf8');

      const client = new FakeAnthropicClient([
        makeMessage(
          [{ type: 'tool_use', id: 't1', name: 'fs_read', input: { path: 'tests/generated/login.spec.ts' } }],
          'tool_use',
        ),
        makeMessage([{ type: 'tool_use', id: 't2', name: 'dom_testids', input: {} }], 'tool_use'),
        makeMessage(
          [
            {
              type: 'tool_use',
              id: 't3',
              name: 'report_verdict',
              input: {
                verdict: 'dom-drift',
                confidence: 'high',
                rationale: 'login-submit testid is now submit-btn',
                suggestedSelector: '[data-testid="submit-btn"]',
              },
            },
          ],
          'tool_use',
        ),
        makeMessage([{ type: 'text', text: 'Classified as dom-drift.' }], 'end_turn'),
      ]);

      const result = await triage({
        client,
        specPath: 'tests/generated/login.spec.ts',
        url: 'http://localhost:3100/login',
        errorText: 'locator [data-testid="login-submit"] not found',
        ctx: makeFakeCtx({ workspaceRoot: root }),
      });

      expect(result.verdict?.verdict).toBe('dom-drift');
      expect(result.verdict?.suggestedSelector).toBe('[data-testid="submit-btn"]');
      expect(result.run.stopReason).toBe('end_turn');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

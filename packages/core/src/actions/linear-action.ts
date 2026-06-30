import { fingerprint, type RefusalAction, type RefusalActionResult, type RefusalPayload } from './types';

const LINEAR_ENDPOINT = 'https://api.linear.app/graphql';
const LINEAR_TIMEOUT_MS = 8000;
const marker = (fp: string) => `vigilis-fingerprint: ${fp}`;

/** Issue title — prefixed so refusals are scannable in Linear. */
export function linearTitle(p: RefusalPayload): string {
  return `Refusal: ${p.specPath} — suspected real bug`;
}

/** Issue description — details + receipt link + the dedup marker (last line). */
export function linearBody(p: RefusalPayload, fp: string): string {
  return [
    'Vigilis **refused to heal** a failing test — triaged as a suspected real regression (behaviour change), not selector drift. The deploy gate was blocked.',
    '',
    `- **Spec:** \`${p.specPath}\``,
    p.repo ? `- **Repo:** ${p.repo}` : null,
    p.url ? `- **URL:** ${p.url}` : null,
    p.expected || p.actual ? `- **Assertion:** expected \`${p.expected ?? '?'}\`, got \`${p.actual ?? '?'}\`` : null,
    `- **Rationale:** ${p.rationale}`,
    p.receiptUrl ? `- **Signed receipt:** ${p.receiptUrl}` : null,
    '',
    '_Attestation is verifiable and auditable — it records what happened, not that the judgment is correct. Verify the receipt before acting._',
    '',
    marker(fp),
  ]
    .filter((l): l is string => l !== null)
    .join('\n');
}

/**
 * Files a Linear ticket for a refusal. Idempotent: searches for an OPEN issue
 * carrying the refusal fingerprint and skips creation if one exists (so CI
 * re-runs don't duplicate). Never throws — all errors resolve to { ok:false }.
 * `fetchFn` injected for tests. No new runtime dependency (global fetch).
 */
export class LinearRefusalAction implements RefusalAction {
  readonly name = 'linear';
  private readonly apiKey: string;
  private readonly teamId: string;
  private readonly projectId?: string;
  private readonly labelId?: string;
  private readonly fetchFn: typeof fetch;

  constructor(opts: { apiKey: string; teamId: string; projectId?: string; labelId?: string; fetchFn?: typeof fetch }) {
    this.apiKey = opts.apiKey;
    this.teamId = opts.teamId;
    this.projectId = opts.projectId;
    this.labelId = opts.labelId;
    this.fetchFn = opts.fetchFn ?? globalThis.fetch;
  }

  private async gql<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LINEAR_TIMEOUT_MS);
    try {
      const res = await this.fetchFn(LINEAR_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: this.apiKey },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { data?: T };
      return json.data ?? null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async notify(p: RefusalPayload): Promise<RefusalActionResult> {
    const fp = fingerprint(p);

    // 1. Dedup: is there already an OPEN ticket for this exact refusal?
    const found = await this.gql<{ issueSearch: { nodes: Array<{ url: string; state: { type: string } }> } }>(
      'query($q:String!){ issueSearch(query:$q){ nodes{ url state{ type } } } }',
      { q: marker(fp) },
    );
    // A failed search (network/timeout/non-2xx → null) means we cannot determine
    // idempotency. Do NOT fall through to create — that risks duplicate tickets.
    if (found === null) return { ok: false };
    const open = found.issueSearch?.nodes?.find(
      (n) => n.state.type !== 'completed' && n.state.type !== 'canceled' && n.state.type !== 'cancelled',
    );
    if (open) return { ok: true, created: false, url: open.url };

    // 2. Create.
    const input: Record<string, unknown> = {
      teamId: this.teamId,
      title: linearTitle(p),
      description: linearBody(p, fp),
    };
    if (this.projectId) input.projectId = this.projectId;
    if (this.labelId) input.labelIds = [this.labelId];

    const created = await this.gql<{ issueCreate: { success: boolean; issue: { url: string } | null } }>(
      'mutation($input:IssueCreateInput!){ issueCreate(input:$input){ success issue{ url } } }',
      { input },
    );
    if (created?.issueCreate?.success && created.issueCreate.issue) {
      return { ok: true, created: true, url: created.issueCreate.issue.url };
    }
    return { ok: false };
  }
}

import { describe, it, expect } from 'vitest';
import { LinearRefusalAction, linearTitle, linearBody } from './linear-action';
import { fingerprint, type RefusalPayload } from './types';

const p: RefusalPayload = {
  specPath: 'tests/checkout-total.spec.ts',
  url: 'https://acme.example/checkout',
  rationale: 'behaviour changed, not selector drift',
  expected: '$49.00',
  actual: '$0.00',
  repo: 'acme/web',
  receiptUrl: 'https://treeship.dev/receipt/ssn_8f31c0',
  timestamp: '2026-06-30T00:00:00.000Z',
};

/** A fake fetch that routes Linear GraphQL by the operation in the query string. */
function linearFetch(handlers: { search: () => unknown; create: () => unknown }) {
  const bodies: string[] = [];
  const fn = (async (_url: string | URL, init?: RequestInit) => {
    const body = String(init?.body ?? '');
    bodies.push(body);
    const data = body.includes('issueCreate') ? handlers.create() : handlers.search();
    return new Response(JSON.stringify({ data }), { status: 200 });
  }) as unknown as typeof fetch;
  return { fn, bodies };
}

describe('linearBody', () => {
  it('embeds the dedup marker and honest framing', () => {
    const b = linearBody(p, fingerprint(p));
    expect(b).toContain(`vigilis-fingerprint: ${fingerprint(p)}`);
    expect(b).toContain('refused to heal');
    expect(b).toContain('verifiable and auditable');
    expect(b).toContain('https://treeship.dev/receipt/ssn_8f31c0');
    expect(linearTitle(p)).toContain('Refusal:');
  });
});

describe('LinearRefusalAction.notify', () => {
  it('creates a ticket when no open match exists', async () => {
    const { fn, bodies } = linearFetch({
      search: () => ({ issueSearch: { nodes: [] } }),
      create: () => ({ issueCreate: { success: true, issue: { url: 'https://linear.app/x/issue/TRE-99' } } }),
    });
    const r = await new LinearRefusalAction({ apiKey: 'lin_k', teamId: 'team_1', fetchFn: fn }).notify(p);
    expect(r).toEqual({ ok: true, created: true, url: 'https://linear.app/x/issue/TRE-99' });
    expect(bodies).toHaveLength(2); // search then create
    expect(bodies[1]).toContain(`vigilis-fingerprint: ${fingerprint(p)}`);
  });

  it('skips creation when an OPEN ticket with the fingerprint exists (idempotent)', async () => {
    const { fn, bodies } = linearFetch({
      search: () => ({ issueSearch: { nodes: [{ url: 'https://linear.app/x/issue/TRE-50', state: { type: 'started' } }] } }),
      create: () => { throw new Error('must not create'); },
    });
    const r = await new LinearRefusalAction({ apiKey: 'lin_k', teamId: 'team_1', fetchFn: fn }).notify(p);
    expect(r).toEqual({ ok: true, created: false, url: 'https://linear.app/x/issue/TRE-50' });
    expect(bodies).toHaveLength(1); // search only
  });

  it('treats a completed/cancelled match as resolved and files a new ticket', async () => {
    const { fn } = linearFetch({
      search: () => ({ issueSearch: { nodes: [{ url: 'https://linear.app/x/issue/TRE-1', state: { type: 'completed' } }] } }),
      create: () => ({ issueCreate: { success: true, issue: { url: 'https://linear.app/x/issue/TRE-100' } } }),
    });
    const r = await new LinearRefusalAction({ apiKey: 'lin_k', teamId: 'team_1', fetchFn: fn }).notify(p);
    expect(r).toEqual({ ok: true, created: true, url: 'https://linear.app/x/issue/TRE-100' });
  });

  it('returns { ok:false } on a rejecting fetch (never throws)', async () => {
    const fn = (async () => { throw new Error('down'); }) as unknown as typeof fetch;
    const r = new LinearRefusalAction({ apiKey: 'lin_k', teamId: 'team_1', fetchFn: fn });
    await expect(r.notify(p)).resolves.toEqual({ ok: false });
  });

  it('returns { ok:false } when the dedup search fails — never falls through to create', async () => {
    const createdBodies: string[] = [];
    const fn = (async (_url: string | URL, init?: RequestInit) => {
      const body = String(init?.body ?? '');
      if (body.includes('issueCreate')) {
        createdBodies.push(body);
        return new Response(JSON.stringify({ data: { issueCreate: { success: true, issue: { url: 'https://linear.app/should-not-happen' } } } }), { status: 200 });
      }
      throw new Error('search down'); // the dedup search fails
    }) as unknown as typeof fetch;

    const r = await new LinearRefusalAction({ apiKey: 'lin_k', teamId: 'team_1', fetchFn: fn }).notify(p);
    expect(r).toEqual({ ok: false });
    expect(createdBodies).toHaveLength(0); // must NOT create on a failed search
  });
});

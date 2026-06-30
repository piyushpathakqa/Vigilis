import { describe, it, expect } from 'vitest';
import { NoopRefusalAction, fingerprint, type RefusalPayload } from './types';

const base: RefusalPayload = {
  specPath: 'tests/checkout-total.spec.ts',
  url: 'https://acme.example/checkout',
  rationale: 'expected $49.00, got $0.00; behaviour changed, not drift',
  expected: '$49.00',
  actual: '$0.00',
  repo: 'acme/web',
  timestamp: '2026-06-30T00:00:00.000Z',
};

describe('fingerprint', () => {
  it('is stable for the same refusal content', () => {
    expect(fingerprint(base)).toBe(fingerprint({ ...base }));
  });

  it('ignores timestamp and receiptUrl so CI re-runs dedupe', () => {
    const rerun = { ...base, timestamp: '2026-07-01T12:00:00.000Z', receiptUrl: 'https://t.dev/x' };
    expect(fingerprint(rerun)).toBe(fingerprint(base));
  });

  it('differs when spec or repo changes', () => {
    expect(fingerprint({ ...base, specPath: 'tests/login.spec.ts' })).not.toBe(fingerprint(base));
    expect(fingerprint({ ...base, repo: 'acme/checkout' })).not.toBe(fingerprint(base));
  });

  it('is a 12-char hex string', () => {
    expect(fingerprint(base)).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe('NoopRefusalAction', () => {
  it('returns ok with an unconfigured reason and does nothing', async () => {
    const r = await new NoopRefusalAction().notify(base);
    expect(r).toEqual({ ok: true, skippedReason: 'unconfigured' });
  });
});

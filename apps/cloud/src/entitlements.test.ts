import { describe, expect, it } from 'vitest';
import {
  PLANS,
  entitlementsForPlan,
  normalizePlan,
  isUnlimited,
  repoLimitExceeded,
} from './entitlements';

describe('entitlements (TRE-68)', () => {
  it('defaults unknown/empty/undefined plans to free', () => {
    expect(normalizePlan(undefined)).toBe('free');
    expect(normalizePlan(null)).toBe('free');
    expect(normalizePlan('')).toBe('free');
    expect(normalizePlan('bogus')).toBe('free');
    expect(normalizePlan('team')).toBe('team');
    expect(normalizePlan('enterprise')).toBe('enterprise');
  });

  it('free is the most restrictive tier', () => {
    const free = entitlementsForPlan('free');
    expect(free.repoLimit).toBe(1);
    expect(free.retentionDays).toBe(14);
    expect(free.exportEnabled).toBe(false);
    expect(free.sharedMemory).toBe(false);
    expect(free.sso).toBe(false);
  });

  it('team unlocks export, shared memory and a 1-year window', () => {
    const team = entitlementsForPlan('team');
    expect(team.repoLimit).toBe(5);
    expect(team.retentionDays).toBe(365);
    expect(team.exportEnabled).toBe(true);
    expect(team.sharedMemory).toBe(true);
    expect(team.sso).toBe(false);
  });

  it('enterprise is unlimited and SSO-enabled', () => {
    const ent = entitlementsForPlan('enterprise');
    expect(isUnlimited(ent.repoLimit)).toBe(true);
    expect(isUnlimited(ent.retentionDays)).toBe(true);
    expect(ent.sso).toBe(true);
  });

  it('per-repo add-ons widen Team’s repo limit but never an unlimited plan', () => {
    expect(entitlementsForPlan('team', 3).repoLimit).toBe(8);
    expect(entitlementsForPlan('team', 0).repoLimit).toBe(5);
    // add-ons are ignored on the unlimited enterprise plan
    expect(entitlementsForPlan('enterprise', 5).repoLimit).toBeNull();
  });

  it('repoLimitExceeded respects the limit and treats unlimited as never-exceeded', () => {
    expect(repoLimitExceeded(2, PLANS.free)).toBe(true); // 2 > 1
    expect(repoLimitExceeded(1, PLANS.free)).toBe(false); // 1 == 1
    expect(repoLimitExceeded(5, PLANS.team)).toBe(false); // 5 == 5
    expect(repoLimitExceeded(6, PLANS.team)).toBe(true); // 6 > 5
    expect(repoLimitExceeded(9999, PLANS.enterprise)).toBe(false); // unlimited
  });
});

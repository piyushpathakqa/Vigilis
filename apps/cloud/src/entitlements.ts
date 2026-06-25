/**
 * Entitlements / plan-gating (TRE-68).
 *
 * The single source of truth for what each plan may do. The dashboard, ingest,
 * export, and retention all read entitlements from here — no plan limits are
 * hard-coded anywhere else. Stripe (TRE-67) only ever writes `org.plan`; this
 * module maps that plan string to concrete limits, so billing stays decoupled
 * from enforcement.
 *
 * Pure module: no DB, no I/O — fully unit-testable. Org-aware helpers
 * (getEntitlements, distinctReposForOrg, applyPlan, prune) live in db.ts.
 */

export type Plan = 'free' | 'team' | 'enterprise';

export interface Entitlements {
  plan: Plan;
  label: string;
  /** Max distinct protected repos. null = unlimited. */
  repoLimit: number | null;
  /** Days of receipt history retained. null = unlimited. */
  retentionDays: number | null;
  /** Compliance export (CSV/JSON) allowed. */
  exportEnabled: boolean;
  /** Shared team memory (ZMem cloud) + review console. */
  sharedMemory: boolean;
  /** Approval gates / policy. */
  approvalGates: boolean;
  /** SSO, RBAC, private deploy (enterprise). */
  sso: boolean;
}

/**
 * Plan → entitlements. Mirrors docs/PRICING.md. `null` means unlimited.
 * Team's repoLimit is the included base (5); per-repo add-ons raise the
 * effective limit at billing time (see entitlementsForOrg's extraRepos).
 */
export const PLANS: Record<Plan, Entitlements> = {
  free: {
    plan: 'free',
    label: 'Free',
    repoLimit: 1,
    retentionDays: 14,
    exportEnabled: false,
    sharedMemory: false,
    approvalGates: false,
    sso: false,
  },
  team: {
    plan: 'team',
    label: 'Team',
    repoLimit: 5,
    retentionDays: 365,
    exportEnabled: true,
    sharedMemory: true,
    approvalGates: true,
    sso: false,
  },
  enterprise: {
    plan: 'enterprise',
    label: 'Enterprise',
    repoLimit: null,
    retentionDays: null,
    exportEnabled: true,
    sharedMemory: true,
    approvalGates: true,
    sso: true,
  },
};

/** Narrow an arbitrary string to a known Plan, defaulting unknown/empty to 'free'. */
export function normalizePlan(plan?: string | null): Plan {
  return plan === 'team' || plan === 'enterprise' ? plan : 'free';
}

/**
 * Resolve entitlements for a plan, optionally widening the repo limit by a
 * number of purchased per-repo add-ons (Team's "$25/extra repo"). Add-ons on
 * an unlimited plan are a no-op.
 */
export function entitlementsForPlan(plan?: string | null, extraRepos = 0): Entitlements {
  const base = PLANS[normalizePlan(plan)];
  if (base.repoLimit === null || extraRepos <= 0) return base;
  return { ...base, repoLimit: base.repoLimit + extraRepos };
}

/** Is `null` (i.e. unlimited)? Reads clearer than scattered `=== null` checks. */
export function isUnlimited(limit: number | null): limit is null {
  return limit === null;
}

/** True when an org's distinct-repo count exceeds its plan's repo limit. */
export function repoLimitExceeded(distinctRepos: number, ent: Entitlements): boolean {
  return ent.repoLimit !== null && distinctRepos > ent.repoLimit;
}

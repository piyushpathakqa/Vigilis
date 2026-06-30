'use server';

/**
 * Dev-only demo controls (TRE-60). Both actions are HARD no-ops unless
 * `devBypassEnabled()` (i.e. no GitHub creds configured) — they never run on a
 * real GitHub-auth deployment, so they cannot touch the product billing path.
 */
import { revalidatePath } from 'next/cache';
import { auth, devBypassEnabled } from '@/auth';
import { applyPlan } from '@/db';
import { seedDemo } from '@/demo-seed';
import type { Plan } from '@/entitlements';

/** Switch the signed-in org's plan (demo affordance; Stripe is TRE-67). */
export async function setPlanAction(plan: Plan): Promise<void> {
  if (!devBypassEnabled()) return;
  const session = await auth();
  if (!session?.orgId) return;
  applyPlan(session.orgId, plan);
  revalidatePath('/');
}

/** Re-seed / reset the signed-in org to the Acme Inc demo story. */
export async function seedDemoAction(): Promise<void> {
  if (!devBypassEnabled()) return;
  const session = await auth();
  if (!session?.orgId) return;
  seedDemo(session.orgId);
  revalidatePath('/');
}

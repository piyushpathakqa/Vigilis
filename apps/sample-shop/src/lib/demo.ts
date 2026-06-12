/**
 * Demo toggles for the Argus self-healing showcase (TRE-40). Both default OFF, so
 * normal runs and the CI QA gate are unchanged.
 *
 * - NEXT_PUBLIC_ARGUS_DEMO_DRIFT=1 — the login submit button's data-testid drifts
 *   from `login-submit` to `submit-btn`. The element still exists under a new
 *   testid, so a spec using the old one fails → Argus triages "dom-drift" and heals.
 * - NEXT_PUBLIC_ARGUS_DEMO_BUG=1 — the login server action rejects even valid
 *   credentials, genuinely breaking the flow → Argus triages "real-bug" and refuses
 *   to heal (the gate stays blocked).
 */
export const DEMO_DRIFT = process.env.NEXT_PUBLIC_ARGUS_DEMO_DRIFT === '1';
export const DEMO_BUG = process.env.NEXT_PUBLIC_ARGUS_DEMO_BUG === '1';

/** The login submit button's testid — drifts under DEMO_DRIFT. */
export const SUBMIT_TESTID = DEMO_DRIFT ? 'submit-btn' : 'login-submit';

'use client';

import { useActionState } from 'react';
import { DEMO_PASSWORD, DEMO_USERNAME } from '@/lib/auth';
import { SUBMIT_TESTID } from '@/lib/demo';
import { login, type LoginState } from './actions';

const initialState: LoginState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <main className="container" style={{ maxWidth: 380 }}>
      <h1>Sign in</h1>
      <p className="muted" style={{ marginTop: -8, marginBottom: 20 }}>
        Demo credentials: <code data-testid="demo-hint">{DEMO_USERNAME}</code> /{' '}
        <code>{DEMO_PASSWORD}</code>
      </p>

      <form action={formAction} className="card" data-testid="login-form">
        {state.error && (
          <p className="error" data-testid="login-error">
            {state.error}
          </p>
        )}

        <div className="field">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            data-testid="login-username"
            defaultValue=""
          />
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            data-testid="login-password"
            defaultValue=""
          />
        </div>

        <button type="submit" disabled={pending} data-testid={SUBMIT_TESTID}>
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}

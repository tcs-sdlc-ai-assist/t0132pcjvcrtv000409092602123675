import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';

interface LoginPageProps {
  redirectTo?: string;
}

export default function LoginPage({ redirectTo = '/dashboard' }: LoginPageProps): React.JSX.Element {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter both your email address and password.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      navigate(redirectTo, { replace: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section aria-labelledby="login-title" className="login-panel">
        <p className="eyebrow">Meridian Care</p>
        <h1 id="login-title">Secure access</h1>
        <p className="intro">Sign in to continue to your authorized care coordination workspace.</p>
        <form noValidate onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email address</label>
            <input
              aria-describedby={error ? 'login-error' : undefined}
              aria-invalid={Boolean(error)}
              aria-required="true"
              autoComplete="email"
              id="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              aria-describedby={error ? 'login-error' : undefined}
              aria-invalid={Boolean(error)}
              aria-required="true"
              autoComplete="current-password"
              id="password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </div>
          {error && (
            <p className="form-error" id="login-error" role="alert">
              {error}
            </p>
          )}
          <button disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <aside aria-label="Demonstration credentials" className="credential-hint">
          <strong>Demonstration access</strong>
          <span>coordinator@example.com / CareDemo1!</span>
          <span>supervisor@example.com / CareDemo1!</span>
          <span>auditor@example.com / CareDemo1!</span>
        </aside>
      </section>
    </main>
  );
}

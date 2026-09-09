import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';

interface LoginPageProps {
  redirectTo?: string;
}

export default function LoginPage({ redirectTo = '/confirmed' }: LoginPageProps): React.JSX.Element {
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
      <section className="login-panel" aria-labelledby="login-title">
        <p className="eyebrow">Meridian Care</p>
        <h1 id="login-title">Secure access</h1>
        <p className="intro">Sign in to continue to your authorized care coordination workspace.</p>
        <form noValidate onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email address</label>
            <input id="email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} aria-required="true" aria-invalid={Boolean(error)} aria-describedby={error ? 'login-error' : undefined} />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} aria-required="true" aria-invalid={Boolean(error)} aria-describedby={error ? 'login-error' : undefined} />
          </div>
          {error && <p id="login-error" className="form-error" role="alert">{error}</p>}
          <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <aside className="credential-hint" aria-label="Demonstration credentials">
          <strong>Demonstration access</strong>
          <span>coordinator@example.com / CareDemo1!</span>
          <span>supervisor@example.com / CareDemo1!</span>
          <span>auditor@example.com / CareDemo1!</span>
        </aside>
      </section>
    </main>
  );
}

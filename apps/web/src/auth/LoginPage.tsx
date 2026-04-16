import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLogin } from './useAuth.js';
import { ApiError } from '../api.js';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useLogin();
  const nav = useNavigate();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await login.mutateAsync({ email, password });
      nav('/projects');
    } catch {}
  }

  const errorMsg =
    login.error instanceof ApiError && login.error.status === 401
      ? 'Invalid email or password'
      : login.error
        ? 'Something went wrong'
        : null;

  return (
    <div className="page" style={{ maxWidth: 400 }}>
      <h1 style={{ marginTop: 32 }}>Sign in</h1>
      <form className="card" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="primary" type="submit" disabled={login.isPending}>
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </button>
        {errorMsg && <div className="error">{errorMsg}</div>}
      </form>
      <p style={{ marginTop: 16, color: 'var(--fg-dim)' }}>
        No account? <Link to="/register">Create one</Link>
      </p>
    </div>
  );
}

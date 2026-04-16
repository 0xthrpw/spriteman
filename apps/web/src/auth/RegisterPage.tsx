import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useRegister } from './useAuth.js';
import { ApiError } from '../api.js';

export function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const register = useRegister();
  const nav = useNavigate();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await register.mutateAsync({ email, password });
      nav('/projects');
    } catch {}
  }

  const errorMsg =
    register.error instanceof ApiError && register.error.status === 409
      ? 'That email is already registered'
      : register.error
        ? 'Something went wrong'
        : null;

  return (
    <div className="page" style={{ maxWidth: 400 }}>
      <h1 style={{ marginTop: 32 }}>Create account</h1>
      <form className="card" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">Password (min 8 characters)</label>
          <input id="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="primary" type="submit" disabled={register.isPending}>
          {register.isPending ? 'Creating…' : 'Create account'}
        </button>
        {errorMsg && <div className="error">{errorMsg}</div>}
      </form>
      <p style={{ marginTop: 16, color: 'var(--fg-dim)' }}>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
}

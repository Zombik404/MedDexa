'use client';
import { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="login">
      <form
        className="card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
          setBusy(false);
          if (!res.ok) return setError((await res.json()).message ?? 'Login failed');
          const next = new URLSearchParams(window.location.search).get('next');
          window.location.href = next && next.startsWith('/') ? next : '/';
        }}
      >
        <div className="row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mark.svg" width={40} height={40} alt="MedDexa" />
          <div>
            <h2 style={{ margin: 0 }}>MedDexa Admin</h2>
            <p className="muted small">Staff access only. All actions are audited.</p>
          </div>
        </div>
        <label className="field">
          Email
          <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field">
          Password
          <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error ? <p className="error" role="alert">{error}</p> : null}
        <button className="btn" disabled={busy} type="submit">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

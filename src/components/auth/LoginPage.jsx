// Single page with a Login / Sign-up tab toggle so the user never bounces
// between two routes. Sign-up additionally requires an invite code that has
// to match INVITE_CODE on the server.

import { useState } from 'react';
import { apiLogin, apiSignup } from '../../api/auth.js';
import { Logo, Spinner } from '../Icons.jsx';

export function LoginPage({ onAuthed }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await apiLogin({ username, password });
      } else {
        await apiSignup({ username, password, inviteCode });
      }
      await onAuthed?.();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const switchTo = (m) => {
    setMode(m);
    setError(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm fade-in">
        <div className="flex items-center justify-center gap-3 mb-8">
          <Logo size={32} />
          <span className="text-2xl font-semibold tracking-tight">zen</span>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-1 mb-5 bg-[#0d0d10]/60 border border-zen-border rounded-lg p-1">
            <TabBtn active={mode === 'login'}  onClick={() => switchTo('login')}>Log in</TabBtn>
            <TabBtn active={mode === 'signup'} onClick={() => switchTo('signup')}>Sign up</TabBtn>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-zen-muted">Username</label>
              <input
                type="text"
                autoComplete="username"
                required
                minLength={3}
                maxLength={32}
                pattern="[a-zA-Z0-9_]+"
                title="Letters, digits, and underscore only."
                disabled={busy}
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="3–32 chars, letters/digits/_"
                className="input mt-1"
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-zen-muted">Password</label>
              <input
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                minLength={8}
                disabled={busy}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? '8+ characters' : 'Your password'}
                className="input mt-1"
              />
            </div>

            {mode === 'signup' && (
              <div>
                <label className="text-xs uppercase tracking-wider text-zen-muted">Invite code</label>
                <input
                  type="text"
                  required
                  disabled={busy}
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value)}
                  placeholder="Required for new accounts"
                  className="input mt-1"
                />
              </div>
            )}

            {error && (
              <div className="text-xs text-zen-red border border-zen-red/30 bg-zen-red/5 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy || !username || !password || (mode === 'signup' && !inviteCode)}
              className="w-full btn-primary justify-center"
            >
              {busy
                ? <><Spinner size={14} /> {mode === 'login' ? 'Signing in…' : 'Creating account…'}</>
                : mode === 'login' ? 'Log in' : 'Create account'}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-3 py-1.5 rounded-md text-sm transition
        ${active
          ? 'bg-zen-panel text-zen-text shadow-[0_0_0_1px_rgb(var(--zen-accent-rgb)/0.4)]'
          : 'text-zen-muted hover:text-zen-text hover:bg-zen-panel/50'}`}
    >
      {children}
    </button>
  );
}

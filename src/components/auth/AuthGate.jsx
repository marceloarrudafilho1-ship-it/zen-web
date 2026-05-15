// Wraps the rest of the app: while we're checking the session, shows a quiet
// loading state. Unauthenticated users see the login / signup page. Once
// authenticated, the wrapped <App/> renders normally with a logout affordance
// passed through via the AuthContext.

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiLogout, apiWhoAmI } from '../../api/auth.js';
import { LoginPage } from './LoginPage.jsx';
import { Logo } from '../Icons.jsx';

const AuthContext = createContext({ user: null, logout: () => {} });
export const useAuth = () => useContext(AuthContext);

export function AuthGate({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const u = await apiWhoAmI();
      setUser(u);
    } catch (err) {
      console.warn('whoami failed:', err);
      setUser(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const logout = useCallback(async () => {
    try { await apiLogout(); } catch {}
    setUser(null);
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zen-muted text-sm gap-3">
        <Logo size={20} /> Checking session…
      </div>
    );
  }

  if (!user) {
    return <LoginPage onAuthed={refresh} />;
  }

  return (
    <AuthContext.Provider value={{ user, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore } from '../api/client';
import { TERMS_VERSION } from '../legal/company';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!tokenStore.get());

  useEffect(() => {
    if (!tokenStore.get()) return;
    api.get('/auth/me').then((r) => setUser(r.user)).catch(() => tokenStore.clear()).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener('bf:unauthorized', onUnauthorized);
    return () => window.removeEventListener('bf:unauthorized', onUnauthorized);
  }, []);

  // The sign-in page only calls this after the Terms box is ticked; the server checks it again.
  const login = useCallback(async (email, password) => {
    const r = await api.post('/auth/login', { email, password, accept_terms: true, terms_version: TERMS_VERSION });
    tokenStore.set(r.token);
    setUser(r.user);
  }, []);

  // Creates the account and signs the person in. The Terms checkbox on the page is enforced again by the server.
  const register = useCallback(async (data) => {
    const r = await api.post('/auth/register', { ...data, accept_terms: true, terms_version: TERMS_VERSION });
    tokenStore.set(r.token);
    setUser(r.user);
  }, []);

  // Used after a social sign-in: the API redirects back with a token
  const loginWithToken = useCallback(async (token) => {
    tokenStore.set(token);
    try { const r = await api.get('/auth/me'); setUser(r.user); } catch (e) { tokenStore.clear(); throw e; }
  }, []);

  const logout = useCallback(() => { tokenStore.clear(); setUser(null); }, []);

  const value = useMemo(() => ({ user, loading, login, register, loginWithToken, logout, isAdmin: user?.role === 'administrator' }), [user, loading, login, register, loginWithToken, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

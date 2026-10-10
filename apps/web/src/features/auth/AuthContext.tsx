import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { get, post, setAccessToken } from '../../services/api';
import type { SafeUser } from '../../types';

interface AuthState {
  user: SafeUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshMe = useCallback(async () => {
    try {
      const data = await get<{ user: SafeUser }>('/auth/me');
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const data = await post<{ user: SafeUser; accessToken: string }>('/auth/login', { email, password });
      setAccessToken(data.accessToken);
      setUser(data.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed.');
      throw e;
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    setError(null);
    try {
      await post('/auth/register', { name, email, password });
      await login(email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed.');
      throw e;
    }
  }, [login]);

  const logout = useCallback(async () => {
    try {
      await post('/auth/logout', {});
    } catch {
      // ignore — clear client state regardless
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, error, login, register, logout, refreshMe }),
    [user, loading, error, login, register, logout, refreshMe],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}

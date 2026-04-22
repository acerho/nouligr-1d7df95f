import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { api, getToken, setToken, ApiError } from '@/lib/api';

export interface AuthUser {
  id: string;
  email: string;
  role: 'admin' | 'staff' | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ error: Error | null }>;
  changeEmail: (newEmail: string, currentPassword: string) => Promise<{ error: Error | null }>;
  requestPasswordReset: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await api<{ user: AuthUser }>('/api/auth.php', { query: { action: 'me' } });
      setUser(data.user);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signIn = async (email: string, password: string) => {
    try {
      const data = await api<{ access_token: string; user: AuthUser }>(
        '/api/auth.php',
        { method: 'POST', query: { action: 'login' }, body: { email, password } }
      );
      setToken(data.access_token);
      setUser(data.user);
      return { error: null };
    } catch (e) {
      const err = e as ApiError;
      return { error: new Error(err.message || 'Login failed') };
    }
  };

  const signOut = async () => {
    setToken(null);
    setUser(null);
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      await api('/api/auth.php', {
        method: 'POST',
        query: { action: 'change-password' },
        body: { current_password: currentPassword, new_password: newPassword },
      });
      return { error: null };
    } catch (e) {
      return { error: new Error((e as ApiError).message || 'Password change failed') };
    }
  };

  const changeEmail = async (newEmail: string, currentPassword: string) => {
    try {
      const data = await api<{ access_token?: string; user?: AuthUser }>('/api/auth.php', {
        method: 'POST',
        query: { action: 'change-email' },
        body: { new_email: newEmail, current_password: currentPassword },
      });
      if (data.access_token) setToken(data.access_token);
      if (data.user) setUser(data.user);
      return { error: null };
    } catch (e) {
      return { error: new Error((e as ApiError).message || 'Email change failed') };
    }
  };

  const requestPasswordReset = async (email: string) => {
    try {
      await api('/api/auth.php', {
        method: 'POST',
        query: { action: 'forgot-password' },
        body: { email },
      });
      return { error: null };
    } catch (e) {
      return { error: new Error((e as ApiError).message || 'Reset request failed') };
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, signIn, signOut, changePassword, changeEmail, requestPasswordReset }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

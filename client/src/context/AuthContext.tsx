import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { authApi, setAccessToken, setRefreshToken, onSessionExpired, invalidateClientCache } from '../lib/api';
import type { AdminProfile } from '../types';

interface AuthContextType {
  admin: AdminProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const profile = await authApi.getProfile();
    setAdmin(profile);
  }, []);

  // React to definitive session expiry raised by the API layer (expired/revoked refresh
  // token). Dropping `admin` here is what keeps React Router and the API layer in sync:
  // without it the router still believed the user was signed in and bounced '/login'
  // straight back to '/', producing an endless redirect loop (flicker + blank window).
  useEffect(() => {
    const unsubscribe = onSessionExpired(() => {
      setAdmin(null);
      setAccessToken(null);
      setRefreshToken(null);
      invalidateClientCache();
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Try to restore session on mount
  useEffect(() => {
    let isCancelled = false;

    const initAuth = async () => {
      try {
        // 1. Try to restore session using stored access token
        await refreshProfile();
      } catch {
        try {
          // 2. Fallback to refreshing token via cookie
          await authApi.refresh();
          if (isCancelled) return;
          await refreshProfile();
        } catch {
          // Not authenticated
          if (isCancelled) return;
          setAdmin(null);
          setAccessToken(null);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      isCancelled = true;
    };
  }, [refreshProfile]);

  const login = async (username: string, password: string, rememberMe: boolean = false) => {
    await authApi.login(username, password, rememberMe);
    await refreshProfile();
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      setAdmin(null);
      setAccessToken(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        admin,
        isAuthenticated: !!admin,
        isLoading,
        login,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

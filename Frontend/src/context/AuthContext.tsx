import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../types/User';
import { authService } from '../services/authService';
import { decodeJwtToken } from '../utils/jwtUtils';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string, loginType?: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  hasRole: (role: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const initAuth = async () => {
      const storedUser = authService.getStoredUser();
      if (storedUser && authService.isAuthenticated()) {
        try {
          const currentUser = await authService.getCurrentUser();
          setUser(currentUser);
        } catch (error: any) {
          // Only clear auth if it's a 401 from /auth/me (token invalid)
          // Otherwise, keep the stored user and let the app continue
          if (error.response?.status === 401 && error.config?.url?.includes('/auth/me')) {
            authService.logout();
            setUser(null);
          } else {
            // For other errors, keep the stored user
            setUser(storedUser);
          }
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  // Automatic token expiration check
  useEffect(() => {
    if (!user) {
      return;
    }

    const checkTokenExpiration = async () => {
      const token = authService.getToken();
      if (!token) return;

      const payload = decodeJwtToken(token);
      if (!payload?.exp) return;

      const expiresAt = payload.exp * 1000;
      const now = Date.now();
      const remaining = expiresAt - now;

      if (remaining <= 0) {
        // Token expired — try to refresh before logging out
        const newToken = await authService.refreshAccessToken();
        if (newToken) {
          console.log('[Token Check] Access token refreshed successfully');
        } else {
          console.log('[Token Check] Refresh failed, logging out');
          authService.logout();
          setUser(null);
          if (window.location.pathname !== '/login') {
            navigate('/login');
          }
        }
      } else if (remaining < 5 * 60 * 1000) {
        // Token expires in less than 5 minutes — proactively refresh
        const newToken = await authService.refreshAccessToken();
        if (newToken) {
          console.log('[Token Check] Proactive token refresh succeeded');
        }
      }
    };

    // Check immediately
    void checkTokenExpiration();

    // Check every 60 seconds (proactive refresh kicks in at 5 min before expiry)
    const interval = setInterval(() => { void checkTokenExpiration(); }, 60_000);

    return () => clearInterval(interval);
  }, [user, navigate]);

  const login = async (username: string, password: string, loginType?: string) => {
    const response = await authService.login({ username, password, loginType });
    setUser(response.user);
  };

  const logout = () => {
    void authService.logout();
    setUser(null);
  };

  const hasRole = (role: string): boolean => {
    return user?.roles.includes(role) || false;
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};


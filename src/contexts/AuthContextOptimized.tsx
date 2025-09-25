'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { logger } from '@/utils/logger';

interface User {
  id: number;
  email: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('access_token');
      logger.log('[Auth] checkAuth - token:', token ? 'exists' : 'not found');
      if (!token) {
        logger.log('[Auth] checkAuth - No token, setting user to null');
        setUser(null);
        setIsLoading(false);
        return;
      }

      // タイムアウト設定（3秒）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/v1/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        if (response.ok) {
          const userData = await response.json();
          logger.log('[Auth] checkAuth - Authentication successful:', userData);
          setUser(userData);
        } else {
          logger.log('[Auth] checkAuth - Authentication failed, status:', response.status);
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          setUser(null);
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
          logger.warn('Auth check timed out');
        } else {
          logger.error('Auth check failed:', error);
        }
        // タイムアウトやエラー時は、トークンがあればユーザーデータを仮設定
        if (token) {
          const cachedUser = localStorage.getItem('user');
          if (cachedUser) {
            try {
              setUser(JSON.parse(cachedUser));
            } catch {
              setUser(null);
            }
          }
        }
      }
    } catch (error) {
      logger.error('Auth check failed:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    const data = await response.json();
    logger.log('[Auth] login - Success, received data:', data);
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    localStorage.setItem('user', JSON.stringify(data.user)); // ユーザー情報もキャッシュ
    logger.log('[Auth] login - Saved token to localStorage:', data.access_token);
    setUser(data.user);

    // 状態更新を確実に反映させるため、ページをリロード
    window.location.href = '/';
  };

  const logout = async () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
    router.push('/login');
  };

  useEffect(() => {
    // 初期ロード時のユーザー情報取得を最適化
    const initAuth = async () => {
      logger.log('[Auth] initAuth - Starting initialization');
      const token = localStorage.getItem('access_token');
      logger.log('[Auth] initAuth - Token from localStorage:', token ? 'exists' : 'not found');
      if (!token) {
        logger.log('[Auth] initAuth - No token found, setting isLoading to false');
        setIsLoading(false);
        return;
      }

      // まずキャッシュされたユーザー情報を使用
      const cachedUser = localStorage.getItem('user');
      if (cachedUser) {
        try {
          setUser(JSON.parse(cachedUser));
          setIsLoading(false);
          // バックグラウンドで認証チェック
          checkAuth();
        } catch {
          await checkAuth();
        }
      } else {
        await checkAuth();
      }
    };

    initAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, checkAuth }}>
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
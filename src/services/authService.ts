import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { logger } from '@/utils/logger';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: number;
    email: string;
    name: string;
  };
}

interface RefreshResponse {
  access_token: string;
  refresh_token: string;
}

interface User {
  id: number;
  email: string;
  name: string;
}

class AuthService {
  private isRefreshing = false;
  private refreshPromise: Promise<RefreshResponse> | null = null;

  constructor() {
    this.setupInterceptors();
  }

  private setupInterceptors() {
    // リクエストインターセプター: アクセストークンをヘッダーに追加
    axios.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = this.getAccessToken();
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // レスポンスインターセプター: 401エラー時にトークンをリフレッシュ
    axios.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        if (!originalRequest) {
          return Promise.reject(error);
        }

        // 401エラーかつリトライでない場合
        if (error.response?.status === 401 && !originalRequest._retry) {
          // リフレッシュエンドポイント自体の401は処理しない
          if (originalRequest.url?.includes('/auth/refresh')) {
            this.clearAuthData();
            window.location.href = '/login';
            return Promise.reject(error);
          }

          originalRequest._retry = true;

          try {
            // トークンリフレッシュ処理
            if (!this.isRefreshing) {
              this.isRefreshing = true;
              this.refreshPromise = this.refreshToken();
            }

            // リフレッシュ完了を待つ
            await this.refreshPromise;

            // 新しいトークンで元のリクエストをリトライ
            const newToken = this.getAccessToken();
            if (newToken && originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }

            return axios(originalRequest);
          } catch (refreshError) {
            // リフレッシュ失敗時はログイン画面へ
            this.clearAuthData();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
            this.refreshPromise = null;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      const response = await axios.post<LoginResponse>(
        `${API_BASE_URL}/api/v1/auth/login`,
        { email, password }
      );

      const { access_token, refresh_token, user } = response.data;

      // トークンを保存
      this.setTokens(access_token, refresh_token);
      this.setUser(user);

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      throw error;
    }
  }

  async signup(email: string, password: string, name: string): Promise<LoginResponse> {
    try {
      const response = await axios.post<LoginResponse>(
        `${API_BASE_URL}/api/v1/auth/signup`,
        { email, password, name }
      );

      const { access_token, refresh_token, user } = response.data;

      // トークンを保存
      this.setTokens(access_token, refresh_token);
      this.setUser(user);

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data?.errors) {
        throw new Error(error.response.data.errors.join(', '));
      }
      throw error;
    }
  }

  async refreshToken(): Promise<RefreshResponse> {
    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await axios.post<RefreshResponse>(
        `${API_BASE_URL}/api/v1/auth/refresh`,
        { refresh_token: refreshToken }
      );

      const { access_token, refresh_token: new_refresh_token } = response.data;

      // 新しいトークンを保存
      this.setTokens(access_token, new_refresh_token);

      return response.data;
    } catch (error) {
      // トークン再利用検知やその他のエラー
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        if (error.response.data.error === 'Token reuse detected') {
          // セキュリティブリーチの可能性: 全てのトークンをクリア
          this.clearAuthData();
        }
        throw new Error(error.response.data.error);
      }
      this.clearAuthData();
      throw error;
    }
  }

  async logout(): Promise<void> {
    const token = this.getAccessToken();

    try {
      if (token) {
        await axios.post(
          `${API_BASE_URL}/api/v1/auth/logout`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );
      }
    } catch (error) {
      // ログアウトエラーは無視（トークンが既に無効な場合など）
      logger.error('Logout error:', error);
    } finally {
      // ローカルストレージをクリア
      this.clearAuthData();
    }
  }

  async getCurrentUser(): Promise<User> {
    const token = this.getAccessToken();

    if (!token) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await axios.get<User>(
        `${API_BASE_URL}/api/v1/auth/me`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      throw error;
    }
  }

  // ヘルパーメソッド
  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  getTokens(): { accessToken: string | null; refreshToken: string | null } {
    return {
      accessToken: this.getAccessToken(),
      refreshToken: this.getRefreshToken()
    };
  }

  getUser(): User | null {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  // 認証済みリクエストのヘルパー（他のサービスで使用）
  async makeAuthenticatedRequest<T = unknown>(url: string, options?: Record<string, unknown>): Promise<T> {
    const response = await axios<T>(url, options);
    return response.data;
  }

  // プライベートメソッド
  private getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('access_token');
  }

  private getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('refresh_token');
  }

  private setTokens(accessToken: string, refreshToken: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
  }

  private setUser(user: User): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('user', JSON.stringify(user));
  }

  clearAuthData(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
  }
}

export const authService = new AuthService();
export default authService;
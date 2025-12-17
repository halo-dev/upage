/*
 * 用户认证Hook
 */
import { useCallback, useEffect, useState } from 'react';
import { useFetcher, useRouteLoaderData } from 'react-router';

export interface UserInfo {
  sub?: string;
  name?: string;
  // 用户登录名，如果未启用用户名登录则可能为空
  username?: string;
  picture?: string;
  // 用户邮箱，可能为空
  email?: string;
  // 用户手机号，可能为空
  phone_number?: string;
  [key: string]: any;
}

interface AuthUserResponse {
  isAuthenticated: boolean;
  claims?: UserInfo;
}

/**
 * useAuth Hook - 获取和管理用户认证状态
 *
 * 优先使用根加载器数据，然后再进行客户端API请求
 */
export function useAuth() {
  // 尝试从根加载器获取数据
  const rootData = useRouteLoaderData<{ auth?: { isAuthenticated: boolean; userInfo: UserInfo | null } }>('root');

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(rootData?.auth?.isAuthenticated || false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(rootData?.auth?.userInfo || null);
  const [isLoading, setIsLoading] = useState<boolean>(!rootData?.auth);

  const fetcher = useFetcher<AuthUserResponse>();

  useEffect(() => {
    if (!rootData?.auth && fetcher.state === 'idle' && !fetcher.data) {
      fetcher.load('/api/auth/user');
    }
  }, [fetcher, rootData]);

  // 当获取数据后更新认证状态
  useEffect(() => {
    if (fetcher.data) {
      setIsAuthenticated(fetcher.data.isAuthenticated);
      setUserInfo(fetcher.data.isAuthenticated ? fetcher.data.claims || null : null);
      setIsLoading(false);
    }
  }, [fetcher.data]);

  // 登录
  const signIn = useCallback((callbackUrl = '/api/auth/callback') => {
    window.location.href = `/api/auth/sign-in?redirectTo=${encodeURIComponent(callbackUrl)}`;
  }, []);

  // 登出
  const signOut = useCallback(() => {
    window.location.href = '/api/auth/sign-out';
  }, []);

  // 刷新用户信息
  const refreshUserInfo = useCallback(() => {
    setIsLoading(true);
    fetcher.load('/api/auth/user');
  }, [fetcher]);

  return {
    isAuthenticated,
    isLoading,
    userInfo,
    signIn,
    signOut,
    refreshUserInfo,
  };
}

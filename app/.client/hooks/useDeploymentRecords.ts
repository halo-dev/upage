import { useRevalidator } from '@remix-run/react';
import { useCallback, useState } from 'react';
import type { DeploymentPlatform } from '~/types/deployment';
import { DeploymentPlatformEnum } from '~/types/deployment';
import { useAuth } from './useAuth';

export interface DeploymentRecord {
  id: string;
  userId: string;
  chatId: string;
  platform: string;
  deploymentId: string;
  url: string;
  status: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  chat?: {
    id: string;
    description: string | null;
  };
}

export interface DeploymentStats {
  totalSites: number;
  totalDays: number;
  totalVisits: number;
  totalBytes?: number;
  lastAccess?: string | null;
  sitesByPlatform?: Record<string, number>;
}

const platformEndpoints: Record<string, string> = {
  [DeploymentPlatformEnum._1PANEL]: '/api/1panel',
  [DeploymentPlatformEnum.NETLIFY]: '/api/netlify',
  [DeploymentPlatformEnum.VERCEL]: '/api/vercel',
};
function getPlatformEndpoint(platform: string, action: string): string {
  const baseEndpoint = platformEndpoints[platform];
  if (!baseEndpoint) {
    throw new Error(`不支持的平台: ${platform}`);
  }
  return `${baseEndpoint}/${action}`;
}

export function useDeploymentRecords() {
  const { revalidate } = useRevalidator();
  const { userInfo, isAuthenticated } = useAuth();
  const [deploymentRecords, setDeploymentRecords] = useState<Record<string, DeploymentRecord[]>>({});
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingPlatforms, setLoadingPlatforms] = useState<Record<string, boolean>>({});
  const [stats, setStats] = useState<DeploymentStats>({
    totalSites: 0,
    totalDays: 30,
    totalVisits: 0,
    sitesByPlatform: {},
  });

  const loadPlatformRecords = useCallback(
    async ({ offset = 0, limit = 10, platform }: { offset?: number; limit?: number; platform: DeploymentPlatform }) => {
      if (!isAuthenticated || !userInfo?.sub) {
        return;
      }

      if (platform) {
        setLoadingPlatforms((prev) => ({ ...prev, [platform]: true }));
      }

      try {
        const response = await fetch(`/api/deployments?offset=${offset}&limit=${limit}&platform=${platform}`);
        if (!response.ok) {
          throw new Error('Failed to fetch deployment records');
        }

        const responseData = await response.json();
        if (!responseData.success) {
          return;
        }

        const { deployments } = responseData.data;

        setDeploymentRecords((prev) => ({
          ...prev,
          [platform]: offset === 0 ? deployments : [...(prev[platform] || []), ...deployments],
        }));

        setTotals((prev) => ({
          ...prev,
          [platform]: offset === 0 ? deployments.length : prev[platform] + deployments.length,
        }));
      } catch (error) {
        console.error('Error loading deployment records:', error);
      } finally {
        if (platform) {
          setLoadingPlatforms((prev) => ({ ...prev, [platform]: false }));
        }
      }
    },
    [isAuthenticated, userInfo],
  );

  const loadStats = useCallback(async () => {
    if (!isAuthenticated || !userInfo?.sub) {
      return;
    }

    setIsLoading(true);
    try {
      setStats({
        totalSites: 0,
        totalDays: 30,
        totalVisits: 0,
        sitesByPlatform: {},
      });

      const response = await fetch('/api/deployments/stats');
      if (response.ok) {
        const responseData = await response.json();
        if (!responseData.success) {
          return;
        }
        const data = responseData.data;

        setStats((prev) => ({
          ...prev,
          totalSites: data.totalSites || 0,
          totalDays: data.totalDays || 30,
          totalVisits: data.totalVisits || 0,
          totalBytes: data.totalBytes || 0,
          lastAccess: data.lastAccess || null,
          sitesByPlatform: data.sitesByPlatform || {},
        }));

        if (data.sitesByPlatform) {
          setTotals((prev) => ({
            ...prev,
            ...data.sitesByPlatform,
          }));
        }
      }
    } catch (error) {
      console.error('Error loading deployment stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, userInfo]);

  const refreshDeploymentRecords = useCallback(() => {
    loadStats();
    for (const platform of Object.values(DeploymentPlatformEnum)) {
      loadPlatformRecords({ platform });
    }
  }, [loadStats, loadPlatformRecords]);

  const toggleAccess = useCallback(
    async (id: string, platform: string) => {
      try {
        const endpoint = getPlatformEndpoint(platform, 'toggle-access');
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || '操作失败');
        }

        const responseData = await response.json();
        if (!responseData.success) {
          throw new Error(responseData.message || '操作失败');
        }

        return responseData.data;
      } catch (error) {
        console.error('切换访问状态失败:', error);
        throw error;
      }
    },
    [isAuthenticated, userInfo],
  );

  const deletePage = useCallback(async (id: string, platform: string) => {
    try {
      const endpoint = getPlatformEndpoint(platform, 'delete');
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '删除失败');
      }

      const responseData = await response.json();
      if (!responseData.success) {
        throw new Error(responseData.message || '删除失败');
      }

      revalidate();
      return responseData.data;
    } catch (error) {
      console.error('删除部署失败:', error);
      throw error;
    }
  }, []);

  return {
    deploymentRecords,
    totals,
    stats,
    isLoading,
    loadingPlatforms,
    loadPlatformRecords,
    refreshDeploymentRecords,
    isPlatformLoading: (platform: string) => loadingPlatforms[platform] || false,
    toggleAccess,
    deletePage,
  };
}

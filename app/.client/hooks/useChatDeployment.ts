import type { Deployment } from '@prisma/client';
import { useRouteLoaderData } from '@remix-run/react';
import { useCallback, useMemo } from 'react';
import type { DeploymentPlatform } from '~/types/deployment';

/**
 * 获取 Chat 路由中的部署记录
 */
export function useChatDeployment() {
  const chatRouteData = useRouteLoaderData<{ deployments?: Deployment[] }>('routes/_layout.chat.$id');
  const deployments = useMemo(() => {
    if (chatRouteData?.deployments) {
      return chatRouteData.deployments;
    }
    return [];
  }, [chatRouteData]);

  const getDeploymentByPlatform = useCallback(
    (platform: DeploymentPlatform) => {
      return deployments?.find((deployment) => deployment.platform === platform) as Deployment | undefined;
    },
    [deployments],
  );

  return {
    getDeploymentByPlatform,
  };
}

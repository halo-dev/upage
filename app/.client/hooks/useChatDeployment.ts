import type { Route } from '.react-router/types/app/routes/+types/chat';
import type { Deployment } from '@prisma/client';
import { useCallback, useMemo } from 'react';
import { useRouteLoaderData } from 'react-router';
import type { DeploymentPlatform } from '~/types/deployment';

/**
 * 获取 Chat 路由中的部署记录
 */
export function useChatDeployment() {
  const chatRouteData = useRouteLoaderData<Route.ComponentProps['loaderData']>('chat');
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

import type { Deployment } from '@prisma/client';
import { useLoaderData } from '@remix-run/react';
import type { DeploymentPlatform } from '~/types/deployment';

/**
 * 仅支持 Chat 路由中的部署记录
 */
export function useChatDeployment() {
  const { deployments } = useLoaderData<{ deployments?: Deployment[] }>();

  const getDeploymentByPlatform = (platform: DeploymentPlatform) => {
    return deployments?.find((deployment) => deployment.platform === platform);
  };

  return {
    getDeploymentByPlatform,
  };
}

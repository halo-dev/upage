export enum DeploymentPlatformEnum {
  _1PANEL = '1panel',
  NETLIFY = 'netlify',
  VERCEL = 'vercel',
  GITHUB = 'github',
}

export type DeploymentPlatform = (typeof DeploymentPlatformEnum)[keyof typeof DeploymentPlatformEnum];

export enum DeploymentStatusEnum {
  SUCCESS = 'success',
  PENDING = 'pending',
  DEPLOYING = 'deploying',
  DEPLOYED = 'deployed',
  FAILED = 'failed',
  INACTIVE = 'inactive',
}

export type DeploymentStatus = (typeof DeploymentStatusEnum)[keyof typeof DeploymentStatusEnum];

// 按平台分类的部署统计数据
export interface DeploymentStatsByPlatform {
  totalSites: number;
  sitesByPlatform: Record<string, number>;
  totalDays?: number;
  totalVisits?: number;
  availableVisits?: number;
  totalBytes?: number;
  lastAccess?: string | null;
}

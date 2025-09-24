import type { ApiResponse } from './global';

export interface _1PanelResponse<T> {
  code: number;
  data: T;
  message: string;
}

export interface _1PanelPaginationResponse<T> {
  items: T[];
  total: number;
}

export interface _1PanelWebsiteDomain {
  createdAt: string;
  domain: string;
  id: number;
  port: number;
  ssl: boolean;
  updatedAt: string;
  websiteId: number;
}

export interface _1PanelWebsite {
  IPV6: boolean;
  accessLog: boolean;
  accessLogPath: string;
  alias: string;
  appInstallId: number;
  appName: string;
  createdAt: string;
  dbID: number;
  dbType: string;
  defaultServer: boolean;
  domains: _1PanelWebsiteDomain[];
  errorLog: boolean;
  errorLogPath: string;
  expireDate: string;
  favorite: boolean;
  ftpId: number;
  group: string;
  httpConfig: string;
  id: number;
  parentWebsiteID: number;
  primaryDomain: string;
  protocol: string;
  proxy: string;
  proxyType: string;
  remark: string;
  rewrite: string;
  runtimeID: number;
  runtimeName: string;
  runtimeType: string;
  siteDir: string;
  sitePath: string;
  status: string;
  type: string;
  updatedAt: string;
  user: string;
  webSiteGroupId: number;
}

export interface _1PanelStats {
  websites: _1PanelWebsite[];
  totalWebsites: number;
  lastUpdated: string;
}

export interface _1PanelWebsiteInfo {
  id: number;
  domain: string;
  sitePath: string;
  url: string;
  chatId: string;
  alias: string;
}

export type _1PanelDeployResponse = ApiResponse<{
  deploy?: {
    id: number;
    domain: string;
    url: string;
  };
}>;

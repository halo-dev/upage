import crypto from 'crypto';
import type { _1PanelPaginationResponse, _1PanelResponse, _1PanelWebsite } from '~/types/1panel';
import { isBinaryString } from '~/utils/file-utils';
import { generateUUID } from '~/utils/uuid';
import { request } from '../../.server/utils/fetch';

export interface _1PanelBaseParams {
  serverUrl: string;
  apiKey: string;
  version?: 'v2';
}

export interface CreateWebsiteParams extends _1PanelBaseParams {
  alias: string;
  primaryDomain?: string;
  proxyProtocol?: string;
  isSSL?: boolean;
}

export interface GetWebsiteParams extends _1PanelBaseParams {
  siteId: number;
}

export interface UploadFileContent {
  path: string;
  data: string;
  fileName: string;
}

export interface UploadFileParams extends _1PanelBaseParams {
  path: string;
  data: string;
  fileName: string;
}

export interface UploadFilesParams extends _1PanelBaseParams {
  files: UploadFileContent[];
}

export interface DeleteWebsiteParams extends _1PanelBaseParams {
  siteId: number;
}

export interface ToggleAccessParams extends _1PanelBaseParams {
  siteId: number;
  operate: 'start' | 'stop';
}

function get1PanelHost(serverUrl: string, version = 'v2') {
  return `${serverUrl.replace(/\/$/, '')}/api/${version}`;
}

export async function getWebsiteList(
  serverUrl: string,
  apiKey: string,
  version = 'v2',
): Promise<_1PanelResponse<_1PanelWebsite[]>> {
  const response = await request(`${get1PanelHost(serverUrl, version)}/websites/list`, {
    method: 'GET',
    headers: {
      ...getAuthHeaders(apiKey),
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch website list: ${response.statusText}`);
  }
  return (await response.json()) as _1PanelResponse<_1PanelWebsite[]>;
}

export async function createWebsite(params: CreateWebsiteParams) {
  const { serverUrl, apiKey, version = 'v2', alias, primaryDomain, proxyProtocol, isSSL } = params;
  const domain = primaryDomain || `${alias}.upage.ai`;
  const response = await request(`${get1PanelHost(serverUrl, version)}/websites`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(apiKey),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      IPV6: false,
      alias,
      appType: 'installed',
      domains: [
        {
          domain,
          port: 80,
          ssl: isSSL || false,
        },
      ],
      appinstall: {
        appId: 0,
        name: '',
        appDetailId: 0,
        params: {},
        version: '',
        appkey: '',
        advanced: false,
        cpuQuota: 0,
        memoryLimit: 0,
        memoryUnit: 'MB',
        containerName: '',
        allowPort: false,
      },
      createDb: false,
      enableFtp: false,
      enableSSL: false,
      ftpPassword: '',
      ftpUser: '',
      otherDomains: '',
      primaryDomain: domain || '',
      proxy: '',
      proxyAddress: '',
      proxyProtocol: proxyProtocol || 'http://',
      proxyType: 'tcp',
      remark: '',
      runtimeType: 'php',
      port: 9000,
      siteDir: '',
      taskID: generateUUID(),
      type: 'static',
      webSiteGroupId: 1,
    }),
  });

  if (!response.ok) {
    return {
      code: response.status,
      data: {
        message: response.statusText,
      },
    };
  }

  return {
    code: response.status,
    data: {
      domain: domain,
    },
  };
}

export async function getWebsite(params: GetWebsiteParams) {
  const { serverUrl, apiKey, version = 'v2', siteId } = params;
  const response = await request(`${get1PanelHost(serverUrl, version)}/websites/${siteId}`, {
    method: 'GET',
    headers: {
      ...getAuthHeaders(apiKey),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get website: ${response.statusText}`);
  }

  return response.json() as Promise<_1PanelResponse<_1PanelWebsite>>;
}

export async function getWebsiteByPrimaryDomain(
  serverUrl: string,
  apiKey: string,
  primaryDomain: string,
  version = 'v2',
) {
  const response = await request(`${get1PanelHost(serverUrl, version)}/websites/search`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(apiKey),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: primaryDomain,
      order: 'descending',
      orderBy: 'favorite',
      page: 1,
      pageSize: 10,
      type: '',
      websiteGroupId: 0,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get website by primary domain: ${response.statusText}`);
  }

  return response.json() as Promise<_1PanelResponse<_1PanelPaginationResponse<_1PanelWebsite>>>;
}

export async function uploadFiles(params: UploadFilesParams) {
  const { serverUrl, apiKey, version = 'v2', files } = params;
  try {
    for (const file of files) {
      await uploadSingleContent({
        serverUrl,
        apiKey,
        version,
        path: file.path,
        data: file.data,
        fileName: file.fileName,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Upload files failed: ${errorMessage}`);
  }
}

export async function uploadSingleContent(params: UploadFileParams) {
  const { serverUrl, apiKey, version = 'v2', path, data, fileName } = params;
  try {
    const formData = new FormData();
    const fileContent = isBinaryString(data) ? Buffer.from(data, 'binary') : data;
    const fileBlob = new Blob([fileContent], { type: 'application/octet-stream' });
    const file = new File([fileBlob], fileName, { type: 'application/octet-stream' });

    formData.append('file', file);
    formData.append('path', path);
    formData.append('overwrite', 'True');

    const response = await request(`${get1PanelHost(serverUrl, version)}/files/upload`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(apiKey),
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed with status: ${response.status} ${response.statusText}`);
    }

    const result = (await response.json()) as _1PanelResponse<{ message: string }>;
    if (result.code !== 200) {
      throw new Error(`Upload failed with status: ${result.data?.message || 'Unknown error'}`);
    }
    return result.data;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Upload file failed: ${path} - ${errorMessage}`);
  }
}

export async function deleteWebsite(params: DeleteWebsiteParams) {
  const { serverUrl, apiKey, version = 'v2', siteId } = params;
  const deleteResponse = await request(`${get1PanelHost(serverUrl, version)}/websites/del`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(apiKey),
    },
    body: JSON.stringify({
      deleteApp: false,
      deleteBackup: false,
      forceDelete: false,
      id: siteId,
    }),
  });

  if (!deleteResponse.ok) {
    throw new Error(`Failed to delete website: ${deleteResponse.statusText}`);
  }
  return true;
}

export async function toggleAccessWebsite(params: ToggleAccessParams) {
  const { serverUrl, apiKey, version = 'v2', siteId, operate } = params;
  const response = await request(`${get1PanelHost(serverUrl, version)}/websites/operate`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(apiKey),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: siteId,
      operate,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to toggle access: ${response.statusText}`);
  }

  const result = (await response.json()) as _1PanelResponse<{ message: string }>;
  if (result.code !== 200) {
    throw new Error(`Failed to toggle access: ${result.data?.message || 'Unknown error'}`);
  }

  return true;
}

function getAuthHeaders(apiKey: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const content = `1panel${apiKey}${timestamp}`;
  const token = crypto.createHash('md5').update(content).digest('hex');

  return {
    '1Panel-Token': token,
    '1Panel-Timestamp': timestamp,
    'Accept-Language': 'zh',
  };
}

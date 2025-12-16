import type { RestEndpointMethodTypes } from '@octokit/rest';

/**
 * GitHub 认证请求体
 */
export interface GitHubAuthRequest {
  token: string;
  tokenType: 'classic' | 'fine-grained';
}

/**
 * GitHub 认证响应
 */
export interface GitHubAuthResponse {
  user: RestEndpointMethodTypes['users']['getAuthenticated']['response']['data'];
  isConnect: boolean;
}

/**
 * GitHub 仓库列表响应项
 */
export interface GitHubRepoItem {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  private: boolean;
  stargazers_count: number;
  forks_count: number;
  default_branch: string;
  updated_at: string | null;
  language: string | null;
}

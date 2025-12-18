import { index, layout, prefix, type RouteConfig, route } from '@react-router/dev/routes';

/**
 * 路由配置文件
 */
export default [
  // ============================================
  // 页面路由
  // ============================================
  layout('routes/layout.tsx', [
    // 首页
    index('routes/home.tsx'),
    // 聊天详情页
    route('chat/:id', 'routes/chat.tsx'),
  ]),

  // ============================================
  // API 资源路由
  // ============================================

  ...prefix('api', [
    // 1Panel 相关
    ...prefix('1panel', [
      route('deploy', 'routes/api/1panel/deploy.ts'),
      route('websites', 'routes/api/1panel/websites.ts'),
      route('stats', 'routes/api/1panel/stats.ts'),
      route('auth', 'routes/api/1panel/auth.ts'),
      route('toggle-access', 'routes/api/1panel/toggle-access.ts'),
      route('delete', 'routes/api/1panel/delete.ts'),
    ]),
    // 用户认证相关
    ...prefix('auth', [route('user', 'routes/api/auth/user.ts'), route(':action', 'routes/api/auth/logto.ts')]),
    // 聊天相关
    ...prefix('chat', [
      index('routes/api/chat/index.ts'),
      route('list', 'routes/api/chat/list.ts'),
      route('update', 'routes/api/chat/update.ts'),
      route('delete', 'routes/api/chat/delete.ts'),
      route('fork', 'routes/api/chat/fork.ts'),
    ]),
    // 部署记录相关
    ...prefix('deployments', [
      index('routes/api/deployments/index.ts'),
      route('get-by-chat', 'routes/api/deployments/get-by-chat.ts'),
      route('stats', 'routes/api/deployments/stats.ts'),
    ]),
    // AI 提示词增强
    route('enhancer', 'routes/api/enhancer/index.ts'),
    // GitHub 相关
    ...prefix('github', [
      route('auth', 'routes/api/github/auth.ts'),
      route('disconnect', 'routes/api/github/disconnect.ts'),
      route('push', 'routes/api/github/push.ts'),
      route('stats', 'routes/api/github/stats.ts'),
      route('repos', 'routes/api/github/repos.ts'),
    ]),
    // 健康检查
    route('health', 'routes/api/health.ts'),
    // Netlify 相关
    ...prefix('netlify', [
      route('auth', 'routes/api/netlify/auth.ts'),
      route('delete', 'routes/api/netlify/delete.ts'),
      route('deploy', 'routes/api/netlify/deploy.ts'),
      route('stats', 'routes/api/netlify/stats.ts'),
      route('toggle-access', 'routes/api/netlify/toggle-access.ts'),
      route('actions/:deployId/:action', 'routes/api/netlify/actions.ts'),

      ...prefix('sites/:siteId', [
        index('routes/api/netlify/sites/index.ts'),
        route('cache', 'routes/api/netlify/sites/cache.ts'),
      ]),
    ]),
    // 项目相关
    ...prefix('project', [
      index('routes/api/project/index.ts'),
      route('export', 'routes/api/project/export.ts'),
      route('files', 'routes/api/project/files.ts'),
    ]),
    // 文件上传相关
    ...prefix('upload', [route('asset', 'routes/api/upload/asset.ts')]),
    // Vercel
    ...prefix('vercel', [
      route('auth', 'routes/api/vercel/auth.ts'),
      route('toggle-access', 'routes/api/vercel/toggle-access.ts'),
      route('delete', 'routes/api/vercel/delete.ts'),
      route('deploy', 'routes/api/vercel/deploy.ts'),
      route('stats', 'routes/api/vercel/stats.ts'),
    ]),
    // 用户设置相关
    route('user/settings', 'routes/api/user-settings.ts'),
  ]),

  // 用户资源文件访问
  route('assets/users/*', 'routes/assets/users.ts'),
] satisfies RouteConfig;

import { index, layout, type RouteConfig, route } from '@react-router/dev/routes';

/**
 * 路由配置文件
 * 从 Remix v2 文件系统路由迁移到 React Router v7 配置化路由
 */
export default [
  // ============================================
  // 页面路由 (使用 pathless layout)
  // ============================================
  layout('routes/_layout.tsx', [
    // 首页
    index('routes/_layout._index.tsx'),
    // 聊天详情页
    route('chat/:id', 'routes/_layout.chat.$id.tsx'),
  ]),

  // ============================================
  // API 资源路由
  // ============================================

  // 1Panel 部署相关
  route('api/1panel/:action', 'routes/api.1panel.$action/route.tsx'),

  // 用户认证相关
  route('api/auth/:action', 'routes/api.auth.$action/route.tsx'),

  // 聊天相关
  route('api/chat', 'routes/api.chat/route.tsx'),
  route('api/chat/:action', 'routes/api.chat.$action/route.tsx'),

  // 部署记录相关
  route('api/deployments', 'routes/api.deployments/route.tsx'),
  route('api/deployments/:action', 'routes/api.deployments.$action/route.tsx'),

  // AI 增强相关
  route('api/enhancer', 'routes/api.enhancer/route.tsx'),

  // GitHub 相关
  route('api/github/:action', 'routes/api.github.$action/route.tsx'),

  // 健康检查
  route('api/health', 'routes/api.health/route.tsx'),

  // Netlify 部署相关
  route('api/netlify/:action', 'routes/api.netlify.$action/route.tsx'),
  route('api/netlify/deploys/:deployId/:action', 'routes/api.netlify.deploys.$deployId.$action.ts'),
  route('api/netlify/sites/:siteId', 'routes/api.netlify.sites.$siteId.ts'),
  route('api/netlify/sites/:siteId/cache', 'routes/api.netlify.sites.$siteId.cache.ts'),

  // 项目相关
  route('api/project', 'routes/api.project/route.tsx'),
  route('api/project/:action', 'routes/api.project.$action/route.tsx'),

  // 文件上传相关
  route('api/upload/:action', 'routes/api.upload.$action/route.tsx'),

  // 用户设置相关
  route('api/user/settings', 'routes/api.user.settings.ts'),

  // Vercel 部署相关
  route('api/vercel/:action', 'routes/api.vercel.$action/route.tsx'),

  // 资源文件访问 (splat 路由)
  route('assets/:action/*', 'routes/assets.$action.$/route.tsx'),
] satisfies RouteConfig;

import { data, type LoaderFunctionArgs } from 'react-router';
import { getUser } from '~/.server/service/auth';

/**
 * 用户信息API端点
 * 返回用户认证状态和用户信息
 */
export async function userLoader({ request }: LoaderFunctionArgs) {
  // 使用服务端 getUser 函数获取用户上下文
  const userContext = await getUser(request);

  return data({
    isAuthenticated: userContext.isAuthenticated,
    claims: userContext.isAuthenticated ? userContext.userInfo : null,
  });
}

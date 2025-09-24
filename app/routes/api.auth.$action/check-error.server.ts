import type { LoaderFunctionArgs } from '@remix-run/node';
import { data } from '@remix-run/node';
import { getAuthError } from '~/lib/.server/auth';

/**
 * 检查认证错误信息的路由
 *
 * 从会话中读取认证错误信息，并在响应中返回
 * 同时会清除错误信息，确保它只显示一次
 */
export async function checkErrorLoader({ request }: LoaderFunctionArgs) {
  const { errorMessage, headers } = await getAuthError(request);

  return data(
    {
      errorMessage,
    },
    {
      headers,
    },
  );
}

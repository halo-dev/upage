import { data, type LoaderFunctionArgs, redirect } from '@remix-run/node';
import { getUser, requireAuth } from '~/lib/.server/auth';
import { getUserChatById } from '~/lib/.server/chat';
import { getChatDeployments } from '~/lib/.server/deployment';
import { default as IndexRoute } from './_index';

export async function loader(args: LoaderFunctionArgs) {
  // 添加权限验证
  const authResult = await requireAuth(args.request);

  // 如果返回的是Response对象，说明验证失败并已重定向
  if (authResult instanceof Response) {
    return authResult;
  }

  // 获取当前用户 id
  const authContext = await getUser(args.request);
  const userId = authContext.userInfo?.sub as string;

  const { id } = args.params;
  if (!id || !userId) {
    return redirect('/');
  }
  const chat = await getUserChatById(id, userId);
  if (!chat) {
    return redirect('/');
  }

  const url = new URL(args.request.url);
  const rewindTo = url.searchParams.get('rewindTo') || '';
  if (rewindTo) {
    chat.messages = chat.messages.slice(0, chat.messages.findIndex((message) => message.id === rewindTo) + 1);
  }

  const deployments = await getChatDeployments(id);
  return data({
    id: args.params.id,
    chat,
    user: authResult.userInfo,
    deployments,
  });
}

export default IndexRoute;

import { type ActionFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/.server/service/auth';
import { errorResponse } from '~/.server/utils/api-response';
import { chatAction } from './chat.server';
import { mockChat } from './mock-chat.server';

export async function action(args: ActionFunctionArgs) {
  const authResult = await requireAuth(args.request, { isApi: true });

  if (authResult instanceof Response) {
    return authResult;
  }

  const userId = authResult.userInfo?.sub;
  if (!userId) {
    return errorResponse(401, '用户未登录');
  }

  const useMock = false;
  if (useMock) {
    return mockChat(args, 'mock_stream_text_1.txt');
  }

  return chatAction({ ...args, userId });
}

import type { UIMessage } from 'ai';
import { type ActionFunctionArgs } from 'react-router';
import { streamEnhancer } from '~/.server/llm/stream-enhancer';
import { getModel, MINOR_MODEL } from '~/.server/modules/constants';
import { requireAuth } from '~/.server/service/auth';
import { errorResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';

export async function action(args: ActionFunctionArgs) {
  const authResult = await requireAuth(args.request, { isApi: true });

  if (authResult instanceof Response) {
    return authResult;
  }

  const userId = authResult.userInfo?.sub as string;
  if (!userId) {
    return errorResponse(401, '用户未登录');
  }

  return enhancerAction({ ...args, userId });
}

const logger = createScopedLogger('api.enhancher');

export type EnhancerActionArgs = ActionFunctionArgs & {
  userId: string;
};

async function enhancerAction({ request, userId }: EnhancerActionArgs) {
  const { messages } = await request.json<{
    messages: UIMessage[];
  }>();

  logger.info(`用户 ${userId} => 增强提示：${messages}`);
  return streamEnhancer({
    messages,
    model: getModel(MINOR_MODEL),
  });
}

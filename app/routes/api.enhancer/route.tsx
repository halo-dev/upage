import { type ActionFunctionArgs } from '@remix-run/node';
import type { UIMessage } from 'ai';
import { requireAuth } from '~/lib/.server/auth';
import { streamEnhancer } from '~/lib/.server/llm/stream-enhancer';
import { createScopedLogger } from '~/lib/.server/logger';
import { errorResponse } from '~/utils/api-response';
import { getModel, MINOR_MODEL } from '~/utils/constants';

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

  logger.info(`User ${userId} => Enhancing prompt: ${messages}`);
  return streamEnhancer({
    messages,
    model: getModel(MINOR_MODEL),
  });
}

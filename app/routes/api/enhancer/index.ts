import type { UIMessage } from 'ai';
import { type ActionFunctionArgs } from 'react-router';
import { streamEnhancer } from '~/.server/llm/stream-enhancer';
import { getModel, MINOR_MODEL } from '~/.server/modules/constants';
import { requireAuth } from '~/.server/service/auth';
import { errorResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';

const logger = createScopedLogger('api.enhancher');

export async function action({ request }: ActionFunctionArgs) {
  const authResult = await requireAuth(request, { isApi: true });

  if (authResult instanceof Response) {
    return authResult;
  }

  const userId = authResult.userInfo?.sub as string;
  if (!userId) {
    return errorResponse(401, '用户未登录');
  }

  const { messages } = await request.json<{
    messages: UIMessage[];
  }>();

  logger.info(`用户 ${userId} => 增强提示：${JSON.stringify(messages)}`);
  return streamEnhancer({
    messages,
    model: getModel(MINOR_MODEL),
  });
}

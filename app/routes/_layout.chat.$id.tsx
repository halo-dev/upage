import type { UserInfoResponse } from '@logto/node';
import type { Deployment } from '@prisma/client';
import { data, type LoaderFunctionArgs, redirect } from '@remix-run/node';
import { Chat } from '~/.client/components/chat/Chat';
import { getUser, requireAuth } from '~/.server/service/auth';
import { getUserChatById } from '~/.server/service/chat';
import { getChatDeployments } from '~/.server/service/deployment';
import { getAssetsByPageId } from '~/.server/service/page-asset';
import { migratePageV1ToV2 } from '~/.server/service/page-v2';
import type { ChatWithMessages } from '~/types/chat';

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
  const deployments = await getChatDeployments(id);
  let resultData: {
    id?: string;
    user?: UserInfoResponse;
    deployments?: Deployment[];
    chat?: ChatWithMessages;
  } = {
    id: args.params.id,
    user: authResult.userInfo,
    deployments,
    chat: undefined,
  };

  const chat = await getUserChatById(id, userId);

  if (!chat) {
    return data(resultData);
  }

  // 处理 Page V1 到 PageV2 的迁移
  for (const message of chat.messages) {
    if (message.page && message.page.pages) {
      try {
        const migratedPages = await migratePageV1ToV2(message.id, message.page.pages, userId);
        const pagesV2WithAssets = await Promise.all(
          migratedPages.map(async (page) => {
            try {
              const assets = await getAssetsByPageId(page.id);
              return {
                ...page,
                assets,
              };
            } catch (error) {
              console.error(`获取页面 ${page.id} 的资源失败:`, error);
              return {
                ...page,
                assets: [],
              };
            }
          }),
        );

        message.pagesV2 = pagesV2WithAssets;
      } catch (error) {
        console.error(`迁移消息 ${message.id} 的 Page V1 失败:`, error);
      }
    }
  }

  resultData = {
    ...resultData,
    chat: chat as unknown as ChatWithMessages,
  };

  const url = new URL(args.request.url);
  const rewindTo = url.searchParams.get('rewindTo') || '';
  if (rewindTo) {
    chat.messages = chat.messages.slice(0, chat.messages.findIndex((message) => message.id === rewindTo) + 1);
  }

  return data(resultData);
}

export default function Templates() {
  return <Chat />;
}

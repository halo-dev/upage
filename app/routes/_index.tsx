import { data, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node';
import { Chat } from '~/components/chat/Chat.client';
import { Header } from '~/components/header/Header';
import { getUser } from '~/lib/.server/auth';
import { getUserUsageStats } from '~/lib/.server/chatUsage';

export const meta: MetaFunction = () => {
  return [{ title: 'UPage' }, { name: 'description', content: 'Talk with UPage, an AI assistant from Lxware' }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const userContext = await getUser(request);
  const userChatUsage = await getUserUsageStats(userContext?.userInfo?.sub as string);

  return data({
    auth: {
      isAuthenticated: userContext?.isAuthenticated,
      userInfo: userContext?.isAuthenticated ? userContext.userInfo : null,
    },
    chatUsage: userChatUsage,
  });
}
/**
 * Landing page component for UPage
 * Note: Settings functionality should ONLY be accessed through the sidebar menu.
 * Do not add settings button/panel to this landing page as it was intentionally removed
 * to keep the UI clean and consistent with the design system.
 */
export default function Index() {
  return (
    <div className="flex flex-col size-full bg-upage-elements-background-depth-1">
      <Header />
      <Chat />
    </div>
  );
}

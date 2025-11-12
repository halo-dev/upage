import { data, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node';
import { Home } from '~/.client/components/Home';
import { getUser } from '~/.server/service/auth';
import { getUserUsageStats } from '~/.server/service/chat-usage';

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
    <div className="relative flex flex-col size-full">
      <section className="relative flex-1 flex items-center flex-col">
        <Home className="w-full" />
      </section>
    </div>
  );
}

import { useStore } from '@nanostores/react';
import type { LinksFunction, LoaderFunctionArgs } from '@remix-run/node';
import { data } from '@remix-run/node';
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
  useRouteLoaderData,
} from '@remix-run/react';
import tailwindReset from '@unocss/reset/tailwind-compat.css?url';
import { useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ClientOnly } from 'remix-utils/client-only';
import { Toaster } from 'sonner';
import { getUser } from './lib/.server/auth';
import { getUserUsageStats } from './lib/.server/chatUsage';
import {
  get1PanelConnectionSettings,
  getNetlifyConnectionSettings,
  getVercelConnectionSettings,
} from './lib/.server/connectionSettings';
import { logStore } from './lib/stores/logs';
import { themeStore } from './lib/stores/theme';
import globalStyles from './styles/index.scss?url';
import { stripIndents } from './utils/strip-indent';

import 'virtual:uno.css';
import type { ComponentType } from 'react';
import { useState } from 'react';

// 定义连接设置类型
export interface ConnectionSettings {
  _1PanelConnection: boolean;
  netlifyConnection: boolean;
  vercelConnection: boolean;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const userContext = await getUser(request);
  const userChatUsage = await getUserUsageStats(userContext.userInfo?.sub as string);

  const userId = userContext?.userInfo?.sub as string;
  let connectionSettings: ConnectionSettings = {
    _1PanelConnection: false,
    netlifyConnection: false,
    vercelConnection: false,
  };

  if (userId) {
    // 获取用户连接设置
    const [_1PanelSettings, netlifySettings, vercelSettings] = await Promise.all([
      get1PanelConnectionSettings(userId),
      getNetlifyConnectionSettings(userId),
      getVercelConnectionSettings(userId),
    ]);

    connectionSettings = {
      _1PanelConnection: !!_1PanelSettings,
      netlifyConnection: !!netlifySettings,
      vercelConnection: !!vercelSettings,
    };
  }

  return data({
    auth: {
      isAuthenticated: userContext.isAuthenticated,
      userInfo: userContext.isAuthenticated ? userContext.userInfo : null,
    },
    chatUsage: userChatUsage,
    ENV: {
      OPERATING_ENV: process.env.OPERATING_ENV || '',
      MAX_UPLOAD_SIZE_MB: parseInt(process.env.MAX_UPLOAD_SIZE_MB || '5'),
    },
    connectionSettings,
  });
}

export const links: LinksFunction = () => [
  {
    rel: 'icon',
    href: '/favicon.svg',
    type: 'image/svg+xml',
  },
  { rel: 'stylesheet', href: tailwindReset },
  { rel: 'stylesheet', href: globalStyles },
  {
    rel: 'preconnect',
    href: 'https://fonts.googleapis.com',
  },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  },
];

const inlineThemeCode = stripIndents`
  setTutorialKitTheme();

  function setTutorialKitTheme() {
    let theme = localStorage.getItem('upage_theme');

    if (!theme) {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    document.querySelector('html')?.setAttribute('data-theme', theme);
  }
`;

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<{
    ENV: { OPERATING_ENV: string; MAX_UPLOAD_SIZE_MB: number };
  }>('root');
  const theme = useStore(themeStore);

  useEffect(() => {
    document.querySelector('html')?.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <html data-theme={theme}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <script dangerouslySetInnerHTML={{ __html: inlineThemeCode }} />
      </head>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.ENV = ${JSON.stringify(data?.ENV || {})}`,
          }}
        />
        <ClientOnly>{() => <DndProvider backend={HTML5Backend}>{children}</DndProvider>}</ClientOnly>
        <ClientOnly>{() => <LazyAuthErrorToast />}</ClientOnly>
        <ScrollRestoration />
        <Scripts />
        <Toaster
          theme={theme}
          position="top-right"
          toastOptions={{
            closeButton: true,
          }}
          icons={{
            success: <div className="i-lucide:check size-5 text-green-500" />,
            info: <div className="i-lucide:info size-5 text-blue-500" />,
            warning: <div className="i-lucide:alert-triangle size-5 text-yellow-500" />,
            error: <div className="i-lucide:info size-5 text-red-500" />,
          }}
        />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const theme = useStore(themeStore);

  console.error(error);

  return (
    <html data-theme={theme}>
      <head>
        <title>出错了！</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
          <div className="max-w-md">
            <h1 className="text-2xl font-bold mb-4">发生错误</h1>
            {isRouteErrorResponse(error) ? (
              <>
                <p className="mb-2">状态: {error.status}</p>
                <p className="mb-4">{error.data}</p>
              </>
            ) : error instanceof Error ? (
              <p className="mb-4">{error.message}</p>
            ) : (
              <p className="mb-4">发生了未知错误</p>
            )}
            <a href="/" className="text-blue-500 hover:underline">
              返回首页
            </a>
          </div>
        </div>
        <Scripts />
        <Toaster
          theme={theme}
          position="top-right"
          toastOptions={{
            closeButton: true,
          }}
          icons={{
            success: <div className="i-lucide:check size-5 text-green-500" />,
            info: <div className="i-lucide:info size-5 text-blue-500" />,
            warning: <div className="i-lucide:alert-triangle size-5 text-yellow-500" />,
            error: <div className="i-lucide:info size-5 text-red-500" />,
          }}
        />
      </body>
    </html>
  );
}

export default function App() {
  const theme = useStore(themeStore);

  useEffect(() => {
    logStore.logSystem('Application initialized', {
      theme,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });
  }, []);

  return <Outlet />;
}

const LazyAuthErrorToast = () => {
  const [AuthErrorToast, setAuthErrorToast] = useState<ComponentType | null>(null);

  useEffect(() => {
    import('./components/AuthErrorToast.client').then((module) => {
      setAuthErrorToast(() => module.AuthErrorToast);
    });
  }, []);

  return AuthErrorToast ? <AuthErrorToast /> : null;
};

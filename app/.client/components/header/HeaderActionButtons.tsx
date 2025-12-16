import { useStore } from '@nanostores/react';
import { useFetcher } from '@remix-run/react';
import classNames from 'classnames';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { toast } from 'sonner';
import { NetlifyDeploymentLink } from '~/.client/components/chat/NetlifyDeploymentLink.client';
import useViewport from '~/.client/hooks';
import { useChatDeployment } from '~/.client/hooks/useChatDeployment';
import { setLocalStorage } from '~/.client/persistence';
import { aiState, setShowChat } from '~/.client/stores/ai-state';
import { webBuilderStore } from '~/.client/stores/web-builder';
import type { _1PanelDeployResponse } from '~/types/1panel';
import { DeploymentPlatformEnum } from '~/types/deployment';
import type { ApiResponse } from '~/types/global';
import { _1PanelDeploymentLink } from '../chat/_1PanelDeploymentLink.client';
import { VercelDeploymentLink } from '../chat/VercelDeploymentLink.client';
import { UPageIndex } from '../upage/Index';
import { DeployTo1PanelDialog } from './DeployTo1PanelDialog';
import { DeployToNetlifyDialog } from './DeployToNetlifyDialog';
import { DeployToVercelDialog } from './DeployToVercelDialog';

interface HeaderActionButtonsProps {}

export function HeaderActionButtons({}: HeaderActionButtonsProps) {
  const { getDeploymentByPlatform } = useChatDeployment();

  const showWorkbench = useStore(webBuilderStore.showWorkbench);
  const { showChat, chatId, isStreaming } = useStore(aiState);
  const [deployingTo, setDeployingTo] = useState<'netlify' | 'vercel' | '1panel' | null>(null);
  const isSmallViewport = useViewport(1024);
  const canHideChat = showWorkbench || !showChat;
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const netlifyFetcher = useFetcher<ApiResponse>();
  const vercelFetcher = useFetcher<ApiResponse>();
  const panelFetcher = useFetcher<_1PanelDeployResponse>();

  const isDeploying = useMemo(() => {
    return netlifyFetcher.state !== 'idle' || vercelFetcher.state !== 'idle' || panelFetcher.state !== 'idle';
  }, [netlifyFetcher.state, vercelFetcher.state, panelFetcher.state]);

  const [showNetlifyDialog, setShowNetlifyDialog] = useState(false);
  const [showVercelDialog, setShowVercelDialog] = useState(false);
  const [show1PanelDialog, setShow1PanelDialog] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const deploy = url.searchParams.get('deploy');
    switch (deploy) {
      case DeploymentPlatformEnum.NETLIFY:
        setShowNetlifyDialog(true);
        break;
      case DeploymentPlatformEnum.VERCEL:
        setShowVercelDialog(true);
        break;
      case DeploymentPlatformEnum._1PANEL:
        setShow1PanelDialog(true);
        break;
    }
    const recommend = url.searchParams.get('recommend');
    if (recommend) {
      setLocalStorage('recommend', recommend || '');
    }
    if (deploy || recommend) {
      url.searchParams.delete('deploy');
      url.searchParams.delete('recommend');
      window.history.replaceState({}, '', url);
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (netlifyFetcher.state === 'idle' && netlifyFetcher.data) {
      const { data, success, message } = netlifyFetcher.data;

      if (success && data?.deploy && data?.site) {
        if (data.site) {
          localStorage.setItem(`netlify-site-${chatId!}`, data.site?.id);
        }

        toast.success(
          <div>
            部署成功!{' '}
            <a href={data.deploy.url} target="_blank" rel="noopener noreferrer" className="underline">
              查看站点
            </a>
          </div>,
        );

        setShowNetlifyDialog(false);
      } else {
        console.error('Invalid deploy response:', data);
        toast.error(message || 'Invalid deployment response');
      }

      setDeployingTo(null);
    }
  }, [netlifyFetcher.state, netlifyFetcher.data, chatId]);

  useEffect(() => {
    if (vercelFetcher.state === 'idle' && vercelFetcher.data) {
      const { data, success, message } = vercelFetcher.data;

      if (success && data?.deploy && data?.project) {
        if (data.project) {
          localStorage.setItem(`vercel-project-${chatId!}`, data.project.id);
        }

        toast.success(
          <div>
            部署到 Vercel 成功!{' '}
            <a href={data.deploy.url} target="_blank" rel="noopener noreferrer" className="underline">
              查看站点
            </a>
          </div>,
        );

        setShowVercelDialog(false);
      } else {
        console.error('Invalid deploy response:', data);
        toast.error(message || 'Invalid deployment response');
      }

      setDeployingTo(null);
    }
  }, [vercelFetcher.state, vercelFetcher.data, chatId]);

  useEffect(() => {
    if (panelFetcher.state === 'idle' && panelFetcher.data) {
      const data = panelFetcher.data as _1PanelDeployResponse;

      const { deploy } = data.data || {};
      if (data.success && deploy) {
        localStorage.setItem(`1panel-project-${chatId!}`, deploy.id.toString());

        toast.success(
          <div>
            部署到 1Panel 成功!{' '}
            <a href={deploy.url} target="_blank" rel="noopener noreferrer" className="underline">
              查看站点
            </a>
          </div>,
        );

        setShow1PanelDialog(false);
      } else {
        console.error('Invalid deploy response:', data);
        toast.error(data.message || 'Invalid deployment response');
      }

      setDeployingTo(null);
    }
  }, [panelFetcher.state, panelFetcher.data, chatId]);

  function getUPageAttachHtml(): string {
    // 生成 UPage 附加的 HTML
    return renderToStaticMarkup(<UPageIndex />);
  }

  const handleNetlifyDeploy = useCallback(async () => {
    if (!chatId) {
      toast.error('没有找到活动聊天');
      return;
    }

    const currentMessageId = webBuilderStore.chatStore.currentMessageId.get();
    if (!currentMessageId) {
      toast.error('没有找到当前消息');
      return;
    }

    try {
      setDeployingTo('netlify');

      const uPageHtml = getUPageAttachHtml();
      const existingSiteId = localStorage.getItem(`netlify-site-${chatId}`);

      netlifyFetcher.submit(
        {
          siteId: existingSiteId || '',
          messageId: currentMessageId,
          chatId: chatId!,
          attach: {
            uPageHtml,
          },
        } as any,
        {
          method: 'POST',
          action: '/api/netlify/deploy',
          encType: 'application/json',
        },
      );
    } catch (error) {
      console.error('Deploy error:', error);
      toast.error(error instanceof Error ? error.message : '部署失败');
      setDeployingTo(null);
    }
  }, [chatId, netlifyFetcher]);

  const handleVercelDeploy = useCallback(async () => {
    if (!chatId) {
      toast.error('没有找到活动聊天');
      return;
    }

    const currentMessageId = webBuilderStore.chatStore.currentMessageId.get();
    if (!currentMessageId) {
      toast.error('没有找到当前消息');
      return;
    }

    try {
      setDeployingTo('vercel');

      const uPageHtml = getUPageAttachHtml();
      const existingProjectId = localStorage.getItem(`vercel-project-${chatId}`);

      vercelFetcher.submit(
        {
          projectId: existingProjectId || '',
          messageId: currentMessageId,
          chatId: chatId!,
          attach: {
            uPageHtml,
          },
        } as any,
        {
          method: 'POST',
          action: '/api/vercel/deploy',
          encType: 'application/json',
        },
      );
    } catch (error) {
      console.error('Vercel deploy error:', error);
      toast.error(error instanceof Error ? error.message : 'Vercel 部署失败');
      setDeployingTo(null);
    }
  }, [chatId, vercelFetcher]);

  const handle1PanelDeploy = useCallback(
    async (options?: { customDomain?: string; siteId?: number; protocol?: string }) => {
      if (!chatId) {
        toast.error('没有找到活动聊天');
        return;
      }

      const currentMessageId = webBuilderStore.chatStore.currentMessageId.get();
      if (!currentMessageId) {
        toast.error('没有找到当前消息');
        return;
      }

      try {
        setDeployingTo('1panel');

        const uPageHtml = getUPageAttachHtml();
        const existingWebsiteId = localStorage.getItem(`1panel-project-${chatId}`);

        panelFetcher.submit(
          {
            websiteId: options?.siteId || existingWebsiteId || '',
            websiteDomain: options?.customDomain || '',
            protocol: options?.protocol || 'http',
            messageId: currentMessageId,
            chatId: chatId!,
            attach: {
              uPageHtml,
            },
          } as any,
          {
            method: 'POST',
            action: '/api/1panel/deploy',
            encType: 'application/json',
          },
        );
      } catch (error) {
        console.error('1Panel deploy error:', error);
        toast.error(error instanceof Error ? error.message : '1Panel 部署失败');
        setDeployingTo(null);
      }
    },
    [chatId, panelFetcher],
  );

  return (
    <div className="flex">
      <div className="relative" ref={dropdownRef}>
        <div className="flex border border-upage-elements-borderColor rounded-md overflow-hidden mr-2 text-sm">
          <Button
            active
            disabled={isDeploying || isStreaming}
            onClick={() => {
              if (isDeploying || isStreaming) {
                return;
              }
              setShow1PanelDialog(true);
            }}
            className="px-4 hover:bg-upage-elements-item-backgroundActive flex items-center gap-2"
          >
            <div className="i-mingcute:rocket-line size-4" />
            {isDeploying ? `部署至 ${deployingTo} 中...` : '部署'}
          </Button>
          <div className="w-[1px] bg-upage-elements-borderColor" />
          <Button
            active
            disabled={isDeploying || isStreaming}
            onClick={() => {
              if (isDeploying || isStreaming) {
                return;
              }
              setIsDropdownOpen(!isDropdownOpen);
            }}
          >
            <div
              className={classNames('i-ph:caret-down size-4 transition-transform', isDropdownOpen ? 'rotate-180' : '')}
            />
          </Button>
        </div>

        {isDropdownOpen && (
          <div className="absolute right-2 flex flex-col gap-1 z-50 p-1 mt-1 min-w-[14rem] bg-upage-elements-background-depth-2 rounded-md shadow-lg bg-upage-elements-backgroundDefault border border-upage-elements-borderColor">
            <Button
              onClick={() => {
                setShow1PanelDialog(true);
                setIsDropdownOpen(false);
              }}
              disabled={isDeploying}
              className="flex items-center w-full px-4 py-2 text-sm text-upage-elements-textPrimary gap-3 rounded-md group relative"
            >
              <img src="/icons/1panel.png" alt="1Panel" className="size-5" />
              <span>部署到 1Panel</span>
              <_1PanelDeploymentLink deployment={getDeploymentByPlatform(DeploymentPlatformEnum._1PANEL)} />
            </Button>
            <Button
              onClick={() => {
                setShowNetlifyDialog(true);
                setIsDropdownOpen(false);
              }}
              disabled={isDeploying}
              className="flex items-center w-full px-4 py-2 text-sm text-upage-elements-textPrimary gap-3 rounded-md group relative"
            >
              <div className="i-simple-icons:netlify size-5 bg-#00C7B7"></div>
              <span>部署到 Netlify</span>
              <NetlifyDeploymentLink deployment={getDeploymentByPlatform(DeploymentPlatformEnum.NETLIFY)} />
            </Button>
            <Button
              onClick={() => {
                setShowVercelDialog(true);
                setIsDropdownOpen(false);
              }}
              disabled={isDeploying}
              className="flex items-center w-full px-4 py-2 text-sm text-upage-elements-textPrimary gap-3 rounded-md group relative"
            >
              <div className="i-skill-icons:vercel-light size-5"></div>
              <span>部署到 Vercel</span>
              <VercelDeploymentLink deployment={getDeploymentByPlatform(DeploymentPlatformEnum.VERCEL)} />
            </Button>
          </div>
        )}
      </div>
      <div className="flex border border-upage-elements-borderColor rounded-md overflow-hidden mr-2">
        <Button
          active={showChat}
          disabled={!canHideChat || isSmallViewport}
          onClick={() => {
            if (canHideChat) {
              setShowChat(!showChat);
            }
          }}
        >
          <div className="i-mingcute:chat-2-line text-sm" />
        </Button>
        <div className="w-[1px] bg-upage-elements-borderColor" />
        <Button
          active={showWorkbench}
          onClick={() => {
            if (showWorkbench && !showChat) {
              setShowChat(true);
            }

            webBuilderStore.showWorkbench.set(!showWorkbench);
          }}
        >
          <div className="i-mingcute:code-line" />
        </Button>
      </div>
      <DeployToNetlifyDialog
        isOpen={showNetlifyDialog}
        deploying={isDeploying}
        deployment={getDeploymentByPlatform(DeploymentPlatformEnum.NETLIFY)}
        onClose={() => setShowNetlifyDialog(false)}
        onDeploy={handleNetlifyDeploy}
      />
      <DeployToVercelDialog
        isOpen={showVercelDialog}
        deploying={isDeploying}
        deployment={getDeploymentByPlatform(DeploymentPlatformEnum.VERCEL)}
        onClose={() => setShowVercelDialog(false)}
        onDeploy={handleVercelDeploy}
      />
      <DeployTo1PanelDialog
        isOpen={show1PanelDialog}
        deploying={isDeploying}
        deployment={getDeploymentByPlatform(DeploymentPlatformEnum._1PANEL)}
        onClose={() => setShow1PanelDialog(false)}
        onDeploy={handle1PanelDeploy}
      />
    </div>
  );
}

interface ButtonProps {
  active?: boolean;
  disabled?: boolean;
  children?: any;
  onClick?: VoidFunction;
  className?: string;
}

function Button({ active = false, disabled = false, children, onClick, className }: ButtonProps) {
  return (
    <button
      className={classNames(
        'flex items-center p-1.5',
        {
          'bg-upage-elements-item-backgroundDefault hover:bg-upage-elements-item-backgroundAccent text-upage-elements-textPrimary hover:text-upage-elements-item-contentAccent':
            !active,
          'bg-upage-elements-item-backgroundAccent text-upage-elements-item-contentAccent': active && !disabled,
          'bg-upage-elements-item-backgroundAccent text-upage-elements-item-contentAccent cursor-not-allowed':
            active && disabled,
          'bg-upage-elements-item-backgroundDefault text-alpha-gray-20 dark:text-alpha-white-20 cursor-not-allowed':
            !active && disabled,
        },
        className,
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

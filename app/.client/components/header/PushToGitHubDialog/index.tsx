import { useStore } from '@nanostores/react';
import { useFetcher, useRouteLoaderData } from '@remix-run/react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { aiState } from '~/.client/stores/ai-state';
import { githubConnection, updateGitHubConnection } from '~/.client/stores/github';
import { webBuilderStore } from '~/.client/stores/web-builder';
import { logger } from '~/.client/utils/logger';
import type { ConnectionSettings } from '~/root';
import type { ApiResponse } from '~/types/global';
import { DialogContainer } from './DialogContainer';
import { GitHubConnectionView } from './GitHubConnectionView';
import { PushConfigForm } from './PushConfigForm';
import { PushSuccessView } from './PushSuccessView';

interface PushToGitHubDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PushToGitHubDialog({ isOpen, onClose }: PushToGitHubDialogProps) {
  const rootData = useRouteLoaderData<{ connectionSettings?: ConnectionSettings }>('root');
  const isGitHubConfigured = rootData?.connectionSettings?.githubConnection || false;
  const connection = useStore(githubConnection);
  const { chatId } = useStore(aiState);

  const githubFetcher = useFetcher<ApiResponse>();

  const [repoName, setRepoName] = useState('');
  const [commitMessage, setCommitMessage] = useState('Initial commit');
  const [isPrivate, setIsPrivate] = useState(false);
  const [showInputForm, setShowInputForm] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [createdRepoUrl, setCreatedRepoUrl] = useState('');
  const [pushedFiles, setPushedFiles] = useState<{ path: string; size: number }[]>([]);

  const isLoading = useMemo(() => {
    return githubFetcher.state !== 'idle';
  }, [githubFetcher.state]);

  useEffect(() => {
    updateGitHubConnection({
      isConnect: rootData?.connectionSettings?.githubConnection,
    });
  }, [rootData]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    if (connection.isConnect) {
      loadGitHubConnection();
    }
  }, [isOpen, isGitHubConfigured]);

  useEffect(() => {
    if (githubFetcher.state === 'idle' && githubFetcher.data) {
      const { data, success, message } = githubFetcher.data;
      if (success && data?.repo) {
        const repoUrl = data.repo.html_url;
        setCreatedRepoUrl(repoUrl);

        webBuilderStore
          .getProjectFilesAsMap({
            inline: false,
          })
          .then((files) => {
            const filesList = Object.entries(files).map(([path, content]) => ({
              path,
              size: new TextEncoder().encode(content).length,
            }));
            setPushedFiles(filesList);
            setShowSuccessDialog(true);
            setShowInputForm(false);
          });
      } else {
        console.error('Invalid push response:', data);
        toast.error(message || '推送失败，请检查仓库名称并重试。');
      }
    }
  }, [githubFetcher.state, githubFetcher.data]);

  const loadGitHubConnection = () => {
    if (!connection.isConnect) {
      return;
    }
  };

  const handlePushButtonClick = () => {
    if (!connection.isConnect) {
      toast.error('请先连接 GitHub');
      return;
    }
    setShowInputForm(true);
  };

  const validateForm = () => {
    if (!repoName.trim()) {
      toast.error('仓库名称不能为空');
      return false;
    }

    const repoNameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!repoNameRegex.test(repoName)) {
      toast.error('仓库名称只能包含字母、数字、连字符和下划线');
      return false;
    }

    if (!commitMessage.trim()) {
      toast.error('提交信息不能为空');
      return false;
    }

    return true;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const files = await webBuilderStore.getProjectFilesAsMap({
        inline: false,
      });

      if (!files || Object.keys(files).length === 0) {
        toast.error('没有文件需要推送');
        return;
      }

      githubFetcher.submit(
        {
          repoName,
          commitMessage,
          files,
          isPrivate,
          chatId,
        } as any,
        {
          method: 'POST',
          action: '/api/github/push',
          encType: 'application/json',
        },
      );
    } catch (error) {
      logger.error('Error preparing GitHub push:', error);
      toast.error('准备推送失败，请重试。');
    }
  };

  const handleClose = () => {
    setRepoName('');
    setCommitMessage('Initial commit');
    setIsPrivate(false);
    setShowInputForm(false);
    setShowSuccessDialog(false);
    setCreatedRepoUrl('');
    onClose();
  };

  const handleCancelForm = () => {
    setShowInputForm(false);
  };

  if (showInputForm) {
    return (
      <DialogContainer
        isOpen={isOpen}
        onClose={handleClose}
        title="配置推送信息"
        icon={<div className="i-ph:git-branch size-5 text-purple-500" />}
        width="md:w-[600px]"
      >
        <PushConfigForm
          repoName={repoName}
          setRepoName={setRepoName}
          commitMessage={commitMessage}
          setCommitMessage={setCommitMessage}
          isPrivate={isPrivate}
          setIsPrivate={setIsPrivate}
          isLoading={isLoading}
          onSubmit={handleFormSubmit}
          onCancel={handleCancelForm}
        />
      </DialogContainer>
    );
  }

  if (showSuccessDialog) {
    return (
      <DialogContainer
        isOpen={isOpen}
        onClose={handleClose}
        title=""
        icon={<div className="hidden" />}
        width="md:w-[600px]"
        showCloseButton={false}
      >
        <PushSuccessView repoUrl={createdRepoUrl} pushedFiles={pushedFiles} onClose={handleClose} />
      </DialogContainer>
    );
  }

  return (
    <DialogContainer
      isOpen={isOpen}
      onClose={handleClose}
      title={connection.isConnect ? 'GitHub 连接信息' : '连接 GitHub 账户'}
      icon={<div className="i-ph:github-logo size-5 text-purple-500" />}
    >
      <GitHubConnectionView isConnected={connection.isConnect} onPushClick={handlePushButtonClick} />
    </DialogContainer>
  );
}

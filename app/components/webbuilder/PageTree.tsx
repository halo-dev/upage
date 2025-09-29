import { useStore } from '@nanostores/react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import classNames from 'classnames';
import { type Change, diffLines } from 'diff';
import { memo, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/Button';
import { ConfirmationDialog, Dialog, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import type { PageMap } from '~/lib/stores/pages';
import { webBuilderStore } from '~/lib/stores/web-builder';
import { createScopedLogger, renderLogger } from '~/utils/logger';

const logger = createScopedLogger('PageTree');

interface PageNode {
  id: string;
  name: string;
  title: string;
}

interface Props {
  pages?: PageMap;
  selectedPage?: string;
  onPageSelect?: (pageName: string) => void;
  unsavedPages?: Set<string>;
  className?: string;
}

export const PageTree = memo(({ pages = {}, onPageSelect, selectedPage, className, unsavedPages }: Props) => {
  renderLogger.trace('PageTree');

  const pageList = useMemo(() => {
    return buildPageList(pages);
  }, [pages]);

  return (
    <div
      className={classNames(
        'text-sm rounded-md border border-upage-elements-borderColor',
        className,
        'overflow-y-auto modern-scrollbar',
      )}
    >
      <div className="p-2 border-b border-upage-elements-borderColor bg-upage-elements-background-depth-1">
        <h3 className="font-medium text-upage-elements-textPrimary">页面列表</h3>
      </div>
      <div className="p-1">
        {pageList.map((page) => (
          <Page
            key={page.id}
            selected={selectedPage === page.name}
            page={page}
            unsavedChanges={unsavedPages instanceof Set && unsavedPages.has(page.name)}
            onClick={() => {
              onPageSelect?.(page.name);
            }}
          />
        ))}
      </div>
    </div>
  );
});

export default PageTree;

function ContextMenuItem({ onSelect, children }: { onSelect?: () => void; children: ReactNode }) {
  return (
    <ContextMenu.Item
      onSelect={onSelect}
      className="flex items-center w-full px-3 py-2 outline-0 text-sm cursor-pointer rounded-md transition-colors duration-200 hover:bg-upage-elements-item-backgroundActive hover:text-upage-elements-item-contentActive"
    >
      {children}
    </ContextMenu.Item>
  );
}

function PageContextMenu({ pageName, children }: { pageName: string; children: ReactNode }) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleCreatePage = async (pageName: string, pageTitle: string) => {
    setIsLoading(true);
    try {
      const success = await webBuilderStore.createPage(pageName, pageTitle);

      if (success) {
        toast.success('页面创建成功');
      } else {
        toast.error('页面创建失败');
      }
    } catch (error) {
      toast.error('页面创建失败');
      logger.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      const success = await webBuilderStore.deletePage(pageName);

      if (success) {
        toast.success(`页面删除成功`);
        setIsDeleteDialogOpen(false);
      } else {
        toast.error(`页面删除失败`);
      }
    } catch (error) {
      toast.error(`页面删除失败`);
      logger.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <ContextMenu.Root>
        <ContextMenu.Trigger>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={classNames('relative', {
              'bg-upage-elements-background-depth-2 border border-dashed border-upage-elements-item-contentAccent rounded-md':
                isDragging,
            })}
          >
            {children}
          </div>
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content
            style={{ zIndex: 998 }}
            className="min-w-56 p-1 border border-upage-elements-borderColor rounded-md z-context-menu bg-upage-elements-background-depth-1 dark:bg-upage-elements-background-depth-2 data-[state=open]:animate-in animate-duration-100 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-98 shadow-lg"
          >
            <ContextMenu.Group className="mb-1">
              <ContextMenuItem onSelect={() => setIsCreateDialogOpen(true)}>
                <div className="flex items-center gap-2 text-upage-elements-textPrimary">
                  <div className="i-ph:file-plus text-green-500" />
                  新建页面
                </div>
              </ContextMenuItem>
            </ContextMenu.Group>

            <ContextMenu.Separator className="h-px bg-upage-elements-borderColor my-1" />

            <ContextMenu.Group className="mt-1">
              <ContextMenuItem onSelect={() => setIsDeleteDialogOpen(true)}>
                <div className="flex items-center gap-2 text-red-500">
                  <div className="i-ph:trash" />
                  删除页面
                </div>
              </ContextMenuItem>
            </ContextMenu.Group>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>

      <CreatePageDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onConfirm={handleCreatePage}
      />

      <ConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="删除页面"
        description={`确定要删除页面 "${pageName}" 吗？此操作不可撤销。`}
        confirmLabel="删除"
        cancelLabel="取消"
        variant="destructive"
        isLoading={isLoading}
      />
    </>
  );
}

interface PageProps {
  page: PageNode;
  selected: boolean;
  unsavedChanges?: boolean;
  onClick: () => void;
}

function formatSaveTime(timestamp: number): string {
  const saveDate = new Date(timestamp);
  return `${saveDate.getHours().toString().padStart(2, '0')}:${saveDate.getMinutes().toString().padStart(2, '0')}`;
}

function Page({ page, onClick, selected, unsavedChanges = false }: PageProps) {
  const pageHistory = useStore(webBuilderStore.pagesStore.pageHistory);
  const { name, title } = page;
  const pageModifications = pageHistory[name];
  const lastSavedTimes = useStore(webBuilderStore.editorStore.documentLastSaved);
  const lastSavedTime = lastSavedTimes[name];

  const { additions, deletions } = useMemo(() => {
    if (!pageModifications?.originalContent) {
      return { additions: 0, deletions: 0 };
    }

    const normalizedOriginal = pageModifications.originalContent.replace(/\r\n/g, '\n');
    const normalizedCurrent =
      pageModifications.versions[pageModifications.versions.length - 1]?.content.replace(/\r\n/g, '\n') || '';

    if (normalizedOriginal === normalizedCurrent) {
      return { additions: 0, deletions: 0 };
    }

    const changes = diffLines(normalizedOriginal, normalizedCurrent, {
      newlineIsToken: false,
      ignoreWhitespace: true,
    });

    return changes.reduce(
      (acc: { additions: number; deletions: number }, change: Change) => {
        if (change.added) {
          acc.additions += change.value.split('\n').length;
        }

        if (change.removed) {
          acc.deletions += change.value.split('\n').length;
        }

        return acc;
      },
      { additions: 0, deletions: 0 },
    );
  }, [pageModifications]);

  const showStats = additions > 0 || deletions > 0;

  return (
    <PageContextMenu pageName={name}>
      <div
        className={classNames('rounded-md transition-colors duration-200 my-1 overflow-hidden', {
          'bg-upage-elements-background-depth-1 hover:bg-upage-elements-item-backgroundActive': !selected,
          'bg-upage-elements-item-backgroundAccent': selected,
        })}
      >
        <NodeButton
          className={classNames('group', {
            'text-upage-elements-item-contentDefault dark:bg-gray-800': !selected,
            'text-upage-elements-item-contentAccent dark:bg-gray-800': selected,
          })}
          iconClasses={classNames('i-ph:file-duotone scale-98', {
            'group-hover:text-upage-elements-item-contentActive': !selected,
          })}
          onClick={onClick}
        >
          <div className="flex flex-col w-full">
            <div
              className={classNames('flex items-center', {
                'group-hover:text-upage-elements-item-contentActive': !selected,
              })}
            >
              <div className="flex-1 font-medium truncate pr-2">{title || name}</div>
              <div className="flex items-center gap-1">
                {showStats && (
                  <div className="flex items-center gap-1 text-xs">
                    {additions > 0 && <span className="text-green-500">+{additions}</span>}
                    {deletions > 0 && <span className="text-red-500">-{deletions}</span>}
                  </div>
                )}
                {unsavedChanges && <span className="i-ph:circle-fill scale-68 shrink-0 text-orange-500" />}
              </div>
            </div>

            <div className="flex justify-between items-center text-xs text-upage-elements-textTertiary mt-0.5">
              <span className="truncate opacity-80">{name}</span>
              {lastSavedTime && !unsavedChanges && (
                <span className="flex items-center text-xs whitespace-nowrap">
                  <span className="i-ph:clock-clockwise size-4 mr-1 scale-90 inline-block" />
                  {formatSaveTime(lastSavedTime)}
                </span>
              )}
            </div>
          </div>
        </NodeButton>
      </div>
    </PageContextMenu>
  );
}

interface ButtonProps {
  iconClasses: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

function NodeButton({ iconClasses, onClick, className, children }: ButtonProps) {
  return (
    <button
      className={classNames('flex items-start gap-1.5 w-full px-3 py-2 border-2 border-transparent', className)}
      onClick={() => onClick?.()}
    >
      <div className={classNames('scale-120 shrink-0 mt-0.5', iconClasses)}></div>
      <div className="w-full text-left">{children}</div>
    </button>
  );
}

function buildPageList(pages: PageMap): PageNode[] {
  const nodeList: PageNode[] = [];
  const pageList = Object.values(pages);
  for (const page of pageList) {
    if (!page) {
      continue;
    }
    nodeList.push({
      id: page.name,
      name: page.name,
      title: page.title ?? '未命名页面',
    });
  }
  return nodeList.sort((a, b) => compareNodes(a, b));
}

function compareNodes(a: PageNode, b: PageNode): number {
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}

interface CreatePageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (pageName: string, pageTitle: string) => void;
}

function CreatePageDialog({ isOpen, onClose, onConfirm }: CreatePageDialogProps) {
  const [pageName, setPageName] = useState('');
  const [pageTitle, setPageTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPageName('');
      setPageTitle('');
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!pageName.trim()) {
      setError('页面名称不能为空');
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(pageName)) {
      setError('页面名称只能包含字母、数字、连字符和下划线');
      return;
    }

    setIsLoading(true);

    try {
      await onConfirm(pageName.trim(), pageTitle.trim() || '未命名页面');
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DialogRoot open={isOpen} onOpenChange={onClose}>
      <Dialog showCloseButton={true} onClose={onClose}>
        <div className="p-6 bg-white dark:bg-gray-950 relative z-10">
          <DialogTitle>新建页面</DialogTitle>
          <DialogDescription className="mb-4">请输入页面文件名和标题</DialogDescription>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="pageName" className="block text-sm font-medium text-upage-elements-textPrimary">
                页面文件名 <span className="text-red-500">*</span>
              </label>
              <input
                id="pageName"
                type="text"
                value={pageName}
                onChange={(e) => setPageName(e.target.value)}
                className="w-full px-3 py-2 border border-upage-elements-borderColor rounded-md bg-upage-elements-background-depth-1 text-upage-elements-textPrimary focus:outline-none focus:ring-2 focus:ring-upage-elements-item-contentAccent"
                placeholder="例如：about"
                autoFocus
              />
              <p className="text-xs text-upage-elements-textTertiary">只能包含字母、数字、连字符和下划线</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="pageTitle" className="block text-sm font-medium text-upage-elements-textPrimary">
                页面标题
              </label>
              <input
                id="pageTitle"
                type="text"
                value={pageTitle}
                onChange={(e) => setPageTitle(e.target.value)}
                className="w-full px-3 py-2 border border-upage-elements-borderColor rounded-md bg-upage-elements-background-depth-1 text-upage-elements-textPrimary focus:outline-none focus:ring-2 focus:ring-upage-elements-item-contentAccent"
                placeholder="例如：关于我们"
              />
              <p className="text-xs text-upage-elements-textTertiary">如果不填写，将使用默认标题"未命名页面"</p>
            </div>

            {error && <div className="text-sm text-red-500 font-medium">{error}</div>}

            <div className="flex justify-end space-x-2 pt-2">
              <Button variant="outline" onClick={onClose} type="button" disabled={isLoading}>
                取消
              </Button>
              <Button type="submit" disabled={isLoading || !pageName.trim()}>
                {isLoading ? (
                  <>
                    <div className="i-ph-spinner-gap-bold animate-spin size-4 mr-2" />
                    创建中...
                  </>
                ) : (
                  '创建页面'
                )}
              </Button>
            </div>
          </form>
        </div>
      </Dialog>
    </DialogRoot>
  );
}

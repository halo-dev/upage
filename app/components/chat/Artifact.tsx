import { useStore } from '@nanostores/react';
import classNames from 'classnames';
import { AnimatePresence, motion } from 'framer-motion';
import { computed } from 'nanostores';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { type BundledLanguage, type BundledTheme, createHighlighter, type HighlighterGeneric } from 'shiki';
import type { ActionState } from '~/lib/runtime/action-runner';
import { webBuilderStore } from '~/lib/stores/web-builder';
import { cubicEasingFn } from '~/utils/easings';

const highlighterOptions = {
  langs: ['shell'],
  themes: ['light-plus', 'dark-plus'],
};

const shellHighlighter: HighlighterGeneric<BundledLanguage, BundledTheme> =
  import.meta.hot?.data?.shellHighlighter ?? (await createHighlighter(highlighterOptions));

if (import.meta.hot && import.meta.hot.data) {
  import.meta.hot.data.shellHighlighter = shellHighlighter;
}

interface ArtifactProps {
  messageId: string;
  pageName: string;
}

export const Artifact = memo(({ messageId, pageName }: ArtifactProps) => {
  const userToggledActions = useRef(false);
  const [showActions, setShowActions] = useState(false);
  const [allActionFinished, setAllActionFinished] = useState(false);

  const artifacts = useStore(webBuilderStore.chatStore.artifacts);
  const artifact = useMemo(() => {
    const artifactsByPageName = artifacts.get(messageId);
    if (!artifactsByPageName) {
      return undefined;
    }

    return artifactsByPageName.get(pageName);
  }, [artifacts, messageId, pageName]);

  const actions = useStore(
    computed(artifact?.runner.actions!, (actions) => {
      return Object.values(actions);
    }),
  );

  const toggleActions = () => {
    userToggledActions.current = true;
    setShowActions(!showActions);
  };

  useEffect(() => {
    const actionsMap = artifact?.runner.actions.get();
    if (!actionsMap) {
      return;
    }

    Object.entries(actionsMap).forEach(([actionId, action]) => {
      if (action.status === 'running' || action.status === 'pending') {
        artifact?.runner.actions.setKey(actionId, {
          ...action,
          status: 'aborted',
        });
      }
    });
  }, []);

  useEffect(() => {
    if (actions.length && !showActions && !userToggledActions.current) {
      setShowActions(true);
    }

    if (actions.length !== 0 && artifact?.type === 'bundled') {
      const finished = !actions.find((action) => action.status !== 'complete');

      if (allActionFinished !== finished) {
        setAllActionFinished(finished);
      }
    }
  }, [actions]);

  return (
    <div className="artifact border border-upage-elements-borderColor flex flex-col overflow-hidden rounded-lg w-full transition-border duration-150">
      <div className="flex">
        <button
          className="flex items-stretch bg-upage-elements-artifacts-background hover:bg-upage-elements-artifacts-backgroundHover w-full overflow-hidden"
          onClick={() => {
            const showWorkbench = webBuilderStore.showWorkbench.get();
            webBuilderStore.showWorkbench.set(!showWorkbench);
          }}
        >
          {artifact?.type == 'bundled' && (
            <>
              <div className="p-4">
                {allActionFinished ? (
                  <div className={'i-ph:files-light'} style={{ fontSize: '2rem' }}></div>
                ) : (
                  <div className={'i-svg-spinners:90-ring-with-bg'} style={{ fontSize: '2rem' }}></div>
                )}
              </div>
              <div className="bg-upage-elements-artifacts-borderColor w-[1px]" />
            </>
          )}
          <div className="px-5 p-3.5 w-full text-left">
            <div className="w-full text-upage-elements-textPrimary font-medium leading-5 text-sm">
              {artifact?.title}
            </div>
            <div className="w-full w-full text-upage-elements-textSecondary text-xs mt-0.5">点击打开 WebBuilder</div>
          </div>
        </button>
        <div className="bg-upage-elements-artifacts-borderColor w-[1px]" />
        <AnimatePresence>
          {actions.length && artifact?.type !== 'bundled' && (
            <motion.button
              initial={{ width: 0 }}
              animate={{ width: 'auto' }}
              exit={{ width: 0 }}
              transition={{ duration: 0.15, ease: cubicEasingFn }}
              className="bg-upage-elements-artifacts-background hover:bg-upage-elements-artifacts-backgroundHover"
              onClick={toggleActions}
            >
              <div className="p-4">
                <div className={showActions ? 'i-ph:caret-up-bold' : 'i-ph:caret-down-bold'}></div>
              </div>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {artifact?.type !== 'bundled' && showActions && actions.length > 0 && (
          <motion.div
            className="actions"
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: '0px' }}
            transition={{ duration: 0.15 }}
          >
            <div className="bg-upage-elements-artifacts-borderColor h-[1px]" />

            <div className="p-5 text-left bg-upage-elements-actions-background">
              <ActionList actions={actions} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

interface ActionListProps {
  actions: ActionState[];
}

const actionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

function openArtifactInWebBuilder(pageName: string, rootDomId: string) {
  if (webBuilderStore.currentView.get() !== 'code') {
    webBuilderStore.currentView.set('code');
  }
  webBuilderStore.setSelectedPage(pageName);
  webBuilderStore.setActiveSectionByPageName(pageName);
  webBuilderStore.editorStore.scrollToElement(rootDomId);
}

const ActionList = memo(({ actions }: ActionListProps) => {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
      <ul className="list-none space-y-2.5">
        {actions.map((action, index) => {
          const { status } = action;

          return (
            <motion.li
              key={index}
              variants={actionVariants}
              initial="hidden"
              animate="visible"
              transition={{
                duration: 0.2,
                ease: cubicEasingFn,
              }}
            >
              <div className="flex items-center gap-1.5 text-sm">
                <div className={classNames('text-lg', getIconColor(action.status))}>
                  {status === 'running' ? (
                    <div className="i-svg-spinners:90-ring-with-bg"></div>
                  ) : status === 'pending' ? (
                    <div className="i-ph:circle-duotone"></div>
                  ) : status === 'complete' ? (
                    <div className="i-ph:check"></div>
                  ) : status === 'failed' || status === 'aborted' ? (
                    <div className="i-ph:x"></div>
                  ) : null}
                </div>
                <div>
                  {action.action === 'add' ? 'Create' : action.action === 'update' ? 'Update' : 'Delete'}{' '}
                  <code
                    className="bg-upage-ele ments-artifacts-inlineCode-background text-upage-elements-artifacts-inlineCode-text px-1.5 py-1 rounded-md text-upage-elements-item-contentAccent hover:underline cursor-pointer"
                    onClick={() => openArtifactInWebBuilder(action.pageName, action.rootDomId)}
                  >
                    {action.id}
                  </code>
                </div>
              </div>
            </motion.li>
          );
        })}
      </ul>
    </motion.div>
  );
});

function getIconColor(status: ActionState['status']) {
  switch (status) {
    case 'pending': {
      return 'text-upage-elements-textTertiary';
    }
    case 'running': {
      return 'text-upage-elements-loader-progress';
    }
    case 'complete': {
      return 'text-upage-elements-icon-success';
    }
    case 'aborted': {
      return 'text-upage-elements-textSecondary';
    }
    case 'failed': {
      return 'text-upage-elements-icon-error';
    }
    default: {
      return undefined;
    }
  }
}

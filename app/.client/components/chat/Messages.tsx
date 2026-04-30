import { useStore } from '@nanostores/react';
import classNames from 'classnames';
import type { ForwardedRef } from 'react';
import { Fragment, forwardRef, memo, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router';
import { toast } from 'sonner';
import WithTooltip from '~/.client/components/ui/Tooltip';
import { useAuth } from '~/.client/hooks/useAuth';
import { useChatOperate } from '~/.client/hooks/useChatOperate';
import { useSnapScroll } from '~/.client/hooks/useSnapScroll';
import { aiState } from '~/.client/stores/ai-state';
import type { ChatUIMessage } from '~/types/message';
import { AssistantMessage } from './AssistantMessage';
import styles from './Messages.module.scss';
import { UserMessage } from './UserMessage';

interface MessagesProps {
  id?: string;
  className?: string;
  messages: ChatUIMessage[];
  renderedTexts: Record<string, string>;
}

const MessageItem = memo(
  forwardRef<
    HTMLDivElement,
    {
      message: ChatUIMessage;
      renderedText?: string;
      index: number;
      isLast: boolean;
      isStreaming: boolean;
      isAborted: boolean;
      userInfo: any;
      onRewind: (messageId: string) => void;
      onFork: (messageId: string) => void;
    }
  >(({ message, renderedText, index, isLast, isStreaming, isAborted, userInfo, onRewind, onFork }, ref) => {
    const { role, id: messageId } = message;

    const isUserMessage = role === 'user';
    const isHidden = message.metadata?.isHidden;

    if (isHidden) {
      return <Fragment key={index} />;
    }

    return (
      <div
        ref={ref}
        className={classNames(styles.messageItem, {
          [styles.userRow]: isUserMessage,
          [styles.assistantRow]: !isUserMessage,
        })}
      >
        {!isUserMessage && (
          <div
            className={classNames(
              styles.avatar,
              styles.assistantAvatar,
              'flex items-center justify-center overflow-hidden rounded-full shrink-0 self-start',
            )}
          >
            <div className="i-ph:sparkle text-base" />
          </div>
        )}

        <div
          className={classNames(styles.messageMain, {
            [styles.userMain]: isUserMessage,
            [styles.assistantMain]: !isUserMessage,
          })}
        >
          <div
            className={classNames(styles.messageBubble, {
              [styles.userBubble]: isUserMessage,
              [styles.assistantBubble]: !isUserMessage && (!isStreaming || !isLast),
              [styles.streamingBubble]: !isUserMessage && isStreaming && isLast,
            })}
          >
            <div
              className={classNames(styles.messageContent, {
                [styles.userContent]: isUserMessage,
                [styles.assistantContent]: !isUserMessage,
              })}
            >
              {isUserMessage ? (
                <UserMessage message={message} />
              ) : (
                <AssistantMessage
                  message={message}
                  renderedText={renderedText}
                  isStreaming={isStreaming && isLast}
                  isAborted={isAborted && isLast}
                />
              )}
            </div>
          </div>

          {!isUserMessage && (
            <div className={styles.assistantActions}>
              {messageId && (
                <WithTooltip tooltip="恢复到此消息">
                  <button
                    type="button"
                    aria-label="恢复到此消息"
                    onClick={() => onRewind(messageId)}
                    key="rewind-message"
                    className={classNames(
                      styles.actionButton,
                      'text-upage-elements-textSecondary hover:text-upage-elements-textPrimary',
                    )}
                  >
                    <span className="i-ph:arrow-u-up-left text-base" aria-hidden="true" />
                    <span className={styles.actionLabel}>恢复</span>
                  </button>
                </WithTooltip>
              )}

              <WithTooltip tooltip="从此消息分叉聊天">
                <button
                  type="button"
                  aria-label="从此消息分叉聊天"
                  onClick={() => onFork(messageId)}
                  key="fork-message"
                  className={classNames(
                    styles.actionButton,
                    'text-upage-elements-textSecondary hover:text-upage-elements-textPrimary',
                  )}
                >
                  <span className="i-ph:git-fork text-base" aria-hidden="true" />
                  <span className={styles.actionLabel}>分叉</span>
                </button>
              </WithTooltip>
            </div>
          )}
        </div>

        {isUserMessage && (
          <div
            className={classNames(
              styles.avatar,
              styles.userAvatar,
              'flex items-center justify-center overflow-hidden rounded-full shrink-0 self-start',
            )}
          >
            {userInfo?.picture ? (
              <img
                src={userInfo.picture}
                alt={userInfo?.user || userInfo.username || 'User'}
                className="size-full object-cover"
                loading="eager"
                decoding="sync"
              />
            ) : (
              <div className="i-ph:user-fill text-base" />
            )}
          </div>
        )}
      </div>
    );
  }),
);

export const Messages = forwardRef<HTMLDivElement, MessagesProps>(
  (props: MessagesProps, ref: ForwardedRef<HTMLDivElement> | undefined) => {
    const { id, messages, renderedTexts } = props;
    const location = useLocation();
    const { userInfo } = useAuth();
    const { forkMessage } = useChatOperate();
    const { chatId, isStreaming, requestPhase, aborted } = useStore(aiState);
    const containerRef = useRef<HTMLDivElement | null>(null);

    // 使用useSnapScroll钩子获取自动滚动功能
    const [messageRef, scrollRef] = useSnapScroll();

    // 组合refs: 外部传入的ref、内部的containerRef和scrollRef
    useEffect(() => {
      if (containerRef.current) {
        scrollRef(containerRef.current);
      }

      // 连接外部ref和内部ref
      if (typeof ref === 'function') {
        ref(containerRef.current);
      } else if (ref) {
        ref.current = containerRef.current;
      }
    }, [ref, scrollRef]);

    const handleRewind = (messageId: string) => {
      const searchParams = new URLSearchParams(location.search);
      searchParams.set('rewindTo', messageId);
      window.location.search = searchParams.toString();
    };

    const handleFork = async (messageId: string) => {
      try {
        if (!chatId) {
          return;
        }

        const id = await forkMessage(chatId, messageId);
        window.location.href = `/chat/${id}`;
      } catch (error) {
        toast.error('分叉聊天失败: ' + (error as Error).message);
      }
    };

    const messageItems = useMemo(() => {
      return messages.map((message, index) => {
        const isLast = index === messages.length - 1;

        const refToApply = isLast ? messageRef : undefined;

        return (
          <MessageItem
            ref={refToApply}
            key={`${message.id || index}`}
            message={message}
            renderedText={renderedTexts[message.id]}
            index={index}
            isLast={isLast}
            isStreaming={isStreaming}
            isAborted={aborted}
            userInfo={userInfo}
            onRewind={handleRewind}
            onFork={handleFork}
          />
        );
      });
    }, [aborted, isStreaming, messages, renderedTexts, userInfo, messageRef]);

    const shouldShowSubmittedPlaceholder =
      requestPhase === 'submitted' && (messages.length === 0 || messages[messages.length - 1]?.role === 'user');

    return (
      <div id={id} className={classNames(props.className, styles.messagesRoot, 'px-1 sm:px-2')} ref={containerRef}>
        {messages.length > 0 ? messageItems : null}
        {(requestPhase === 'submitted' || isStreaming) && (
          <div
            className="text-center w-full text-upage-elements-textSecondary i-svg-spinners:3-dots-fade text-4xl mt-4"
            ref={shouldShowSubmittedPlaceholder ? messageRef : undefined}
          ></div>
        )}
      </div>
    );
  },
);

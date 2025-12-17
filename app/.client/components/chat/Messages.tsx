import { useStore } from '@nanostores/react';
import { useLocation } from 'react-router';
import classNames from 'classnames';
import type { ForwardedRef } from 'react';
import { Fragment, forwardRef, memo, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import WithTooltip from '~/.client/components/ui/Tooltip';
import { useAuth } from '~/.client/hooks/useAuth';
import { useChatOperate } from '~/.client/hooks/useChatOperate';
import { useSnapScroll } from '~/.client/hooks/useSnapScroll';
import { aiState, type ParsedUIMessage } from '~/.client/stores/ai-state';
import { AssistantMessage } from './AssistantMessage';
import styles from './Messages.module.scss';
import { UserMessage } from './UserMessage';

interface MessagesProps {
  id?: string;
  className?: string;
  isStreaming?: boolean;
}

const MessageItem = memo(
  forwardRef<
    HTMLDivElement,
    {
      message: ParsedUIMessage;
      index: number;
      isFirst: boolean;
      isLast: boolean;
      isStreaming: boolean;
      userInfo: any;
      onRewind: (messageId: string) => void;
      onFork: (messageId: string) => void;
    }
  >(({ message, index, isFirst, isLast, isStreaming, userInfo, onRewind, onFork }, ref) => {
    const { role, id: messageId } = message;

    const isUserMessage = role === 'user';
    const isHidden = message.metadata?.isHidden;

    if (isHidden) {
      return <Fragment key={index} />;
    }

    return (
      <div
        ref={ref}
        className={classNames(styles.messageItem, 'flex gap-4 p-5 w-full', {
          [styles.userMessage]: isUserMessage,
          [styles.assistantMessage]: !isUserMessage && (!isStreaming || !isLast),
          [styles.streamingLastMessage]: !isUserMessage && isStreaming && isLast,
          'mt-6': !isFirst,
        })}
      >
        {isUserMessage && (
          <div
            className={classNames(
              'flex items-center justify-center w-[40px] h-[40px] overflow-hidden bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-500 rounded-full shrink-0 self-start',
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
              <div className="i-ph:user-fill text-2xl" />
            )}
          </div>
        )}
        <div className={classNames(styles.messageContent, 'grid grid-col-1 w-full')}>
          {isUserMessage ? <UserMessage message={message} /> : <AssistantMessage message={message} />}
        </div>
        {!isUserMessage && (
          <div className="flex gap-2 flex-col lg:flex-row">
            {messageId && (
              <WithTooltip tooltip="恢复到此消息">
                <button
                  onClick={() => onRewind(messageId)}
                  key="i-ph:arrow-u-up-left"
                  className={classNames(
                    styles.actionButton,
                    'i-ph:arrow-u-up-left',
                    'text-xl text-upage-elements-textSecondary hover:text-upage-elements-textPrimary transition-colors',
                  )}
                />
              </WithTooltip>
            )}

            <WithTooltip tooltip="从此消息分叉聊天">
              <button
                onClick={() => onFork(messageId)}
                key="i-ph:git-fork"
                className={classNames(
                  styles.actionButton,
                  'i-ph:git-fork',
                  'text-xl text-upage-elements-textSecondary hover:text-upage-elements-textPrimary transition-colors',
                )}
              />
            </WithTooltip>
          </div>
        )}
      </div>
    );
  }),
);

export const Messages = forwardRef<HTMLDivElement, MessagesProps>(
  (props: MessagesProps, ref: ForwardedRef<HTMLDivElement> | undefined) => {
    const { id } = props;
    const location = useLocation();
    const { userInfo } = useAuth();
    const { forkMessage } = useChatOperate();
    const { chatId, parseMessages, isStreaming } = useStore(aiState);
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
      return parseMessages.map((message, index) => {
        const isFirst = index === 0;
        const isLast = index === parseMessages.length - 1;

        const refToApply = isLast ? messageRef : undefined;

        return (
          <MessageItem
            ref={refToApply}
            key={`${message.id || index}`}
            message={message}
            index={index}
            isFirst={isFirst}
            isLast={isLast}
            isStreaming={isStreaming}
            userInfo={userInfo}
            onRewind={handleRewind}
            onFork={handleFork}
          />
        );
      });
    }, [isStreaming, parseMessages, userInfo, messageRef]);

    return (
      <div id={id} className={classNames(props.className, 'px-2')} ref={containerRef}>
        {parseMessages.length > 0 ? messageItems : null}
        {isStreaming && (
          <div
            className="text-center w-full text-upage-elements-textSecondary i-svg-spinners:3-dots-fade text-4xl mt-4"
            ref={messageRef}
          ></div>
        )}
      </div>
    );
  },
);

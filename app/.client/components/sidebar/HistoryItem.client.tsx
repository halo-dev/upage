import { useParams } from 'react-router';
import classNames from 'classnames';
import { type ForwardedRef, forwardRef, useCallback } from 'react';
import { Checkbox } from '~/.client/components/ui/Checkbox';
import WithTooltip from '~/.client/components/ui/Tooltip';
import { useEditChatDescription } from '~/.client/hooks';
import type { ServerChatItem } from '~/.client/hooks/useChatEntries';

interface HistoryItemProps {
  item: ServerChatItem;
  onDelete?: (event: React.UIEvent) => void;
  onDuplicate?: (id: string) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
}

export function HistoryItem({
  item,
  onDelete,
  onDuplicate,
  selectionMode = false,
  isSelected = false,
  onToggleSelection,
}: HistoryItemProps) {
  const { id } = useParams();
  const isActiveChat = id === item.id;
  const { editing, handleChange, handleBlur, handleSubmit, handleKeyDown, currentDescription, toggleEditMode } =
    useEditChatDescription({
      initialDescription: item.description || '',
      chatId: item.id,
    });

  const handleItemClick = useCallback(
    (e: React.MouseEvent) => {
      if (selectionMode) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Item clicked in selection mode:', item.id);
        onToggleSelection?.(item.id);
      }
    },
    [selectionMode, item.id, onToggleSelection],
  );

  const handleCheckboxChange = useCallback(() => {
    console.log('Checkbox changed for item:', item.id);
    onToggleSelection?.(item.id);
  }, [item.id, onToggleSelection]);

  const handleDeleteClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      event.preventDefault();
      event.stopPropagation();
      console.log('Delete button clicked for item:', item.id);

      if (onDelete) {
        onDelete(event as unknown as React.UIEvent);
      }
    },
    [onDelete, item.id],
  );

  return (
    <div
      className={classNames(
        'group rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50/80 dark:hover:bg-gray-800/30 overflow-hidden flex justify-between items-center px-1 py-2.5 transition-colors',
        { 'text-gray-900 dark:text-white bg-gray-50/80 dark:bg-gray-800/30': isActiveChat },
        { 'cursor-pointer': selectionMode },
      )}
      onClick={selectionMode ? handleItemClick : undefined}
    >
      <div
        className={classNames('flex items-center mr-2 invisible group-hover:visible', {
          '!visible': selectionMode,
        })}
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          id={`select-${item.id}`}
          checked={isSelected}
          onCheckedChange={handleCheckboxChange}
          className="size-4"
        />
      </div>

      {editing ? (
        <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2 pr-2">
          <input
            type="text"
            className="flex-1 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-md px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
            autoFocus
            value={currentDescription}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
          />
          <button
            type="submit"
            className="i-ph:check size-4 text-gray-500 hover:text-purple-500 transition-colors"
            onMouseDown={handleSubmit}
          />
        </form>
      ) : (
        <a
          href={`/chat/${item.id}`}
          className="flex w-full relative items-center"
          onClick={selectionMode ? handleItemClick : undefined}
        >
          <span className="truncate max-w-[calc(100%-90px)] pl-2">{currentDescription}</span>
          <div
            className={classNames(
              'absolute right-0 top-0 bottom-0 flex items-center px-2 transition-colors',
              'min-w-[80px] justify-end z-10',
              'bg-gradient-to-l from-upage-elements-background-depth-1 via-upage-elements-background-depth-1 to-transparent',
            )}
          >
            <div className="flex items-center gap-2.5 text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
              {onDuplicate && (
                <ChatActionButton
                  toolTipContent="复制"
                  icon="i-mingcute:copy-2-line size-4"
                  onClick={(event) => {
                    event.preventDefault();
                    onDuplicate?.(item.id);
                  }}
                />
              )}
              <ChatActionButton
                toolTipContent="重命名"
                icon="i-mingcute:edit-2-line size-4"
                onClick={(event) => {
                  event.preventDefault();
                  toggleEditMode();
                }}
              />
              <ChatActionButton
                toolTipContent="删除"
                icon="i-mingcute:delete-2-line size-4"
                className="hover:text-red-500 dark:hover:text-red-400"
                onClick={handleDeleteClick}
              />
            </div>
          </div>
        </a>
      )}
    </div>
  );
}

const ChatActionButton = forwardRef(
  (
    {
      toolTipContent,
      icon,
      className,
      onClick,
    }: {
      toolTipContent: string;
      icon: string;
      className?: string;
      onClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
      btnTitle?: string;
    },
    ref: ForwardedRef<HTMLButtonElement>,
  ) => {
    return (
      <WithTooltip tooltip={toolTipContent} position="bottom" sideOffset={4}>
        <button
          ref={ref}
          type="button"
          className={`text-gray-400 dark:text-gray-500 hover:text-purple-500 dark:hover:text-purple-400 transition-colors ${icon} ${className ? className : ''}`}
          onClick={onClick}
        />
      </WithTooltip>
    );
  },
);

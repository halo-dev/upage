import { useStore } from '@nanostores/react';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { useEffect } from 'react';
import WithTooltip from '~/components/ui/Tooltip';
import { useEditChatDescription } from '~/lib/hooks';
import { useChatHistory } from '~/lib/hooks/useChatHistory';
import { webBuilderStore } from '~/lib/stores/web-builder';

export function ChatDescription() {
  const { getChatLatestDescription } = useChatHistory();
  const description = useStore(webBuilderStore.chatStore.description);

  const {
    editing,
    handleChange,
    handleBlur,
    handleSubmit,
    handleKeyDown,
    currentDescription,
    toggleEditMode,
    setCurrentDescription,
    updateChatDescription,
  } = useEditChatDescription({
    initialDescription: getChatLatestDescription() || '',
  });

  useEffect(() => {
    if (!currentDescription && description) {
      setCurrentDescription(description);
      updateChatDescription(description);
    }
  }, [description]);

  if (!currentDescription) {
    return null;
  }

  return (
    <div className="flex items-center justify-center">
      {editing ? (
        <form onSubmit={handleSubmit} className="flex items-center justify-center">
          <input
            type="text"
            className="bg-upage-elements-background-depth-1 text-upage-elements-textPrimary rounded px-2 py-0.5 mr-2 focus:outline-none focus:ring-1 focus:ring-upage-elements-ring"
            autoFocus
            value={currentDescription}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            style={{ width: `${Math.max(currentDescription?.length * 9 || 0, 180)}px` }}
          />
          <TooltipProvider>
            <WithTooltip tooltip="保存标题">
              <div className="flex justify-between items-center p-2 rounded-md bg-upage-elements-item-backgroundAccent">
                <button
                  type="submit"
                  className="i-ph:check-bold scale-110 hover:text-upage-elements-item-contentAccent"
                  onMouseDown={handleSubmit}
                />
              </div>
            </WithTooltip>
          </TooltipProvider>
        </form>
      ) : (
        <>
          {currentDescription}
          <TooltipProvider>
            <WithTooltip tooltip="重命名聊天">
              <div className="flex justify-between items-center p-2 rounded-md bg-upage-elements-item-backgroundAccent ml-2">
                <button
                  type="button"
                  className="i-ph:pencil-fill scale-110 hover:text-upage-elements-item-contentAccent"
                  onClick={(event) => {
                    event.preventDefault();
                    toggleEditMode();
                  }}
                />
              </div>
            </WithTooltip>
          </TooltipProvider>
        </>
      )}
    </div>
  );
}

import { memo } from 'react';
import Popover from '~/components/ui/Popover';
import Tooltip from '~/components/ui/Tooltip';
import type { ParsedUIMessage } from '~/lib/stores/ai-state';
import { Markdown } from './Markdown';

export const AssistantMessage = memo(({ message }: { message: ParsedUIMessage }) => {
  return (
    <div className="overflow-hidden w-full">
      {message.parts.map((part) => {
        if (part.type === 'data-summary') {
          return (
            <div className="flex gap-2 items-center text-sm text-upage-elements-textSecondary mb-1.5">
              {part.data.summary && (
                <Tooltip tooltip="查看对话上下文" position="top">
                  <div className="relative group">
                    <Popover
                      side="right"
                      align="start"
                      trigger={
                        <button
                          aria-label="Open context"
                          className="i-ph:clipboard-text text-lg text-upage-elements-textSecondary cursor-pointer transition-all duration-200 ease-out"
                        />
                      }
                    >
                      {part.data.summary && (
                        <div className="max-w-chat">
                          <div className="summary flex flex-col">
                            <div className="p-5 border border-upage-elements-borderColor rounded-md bg-upage-elements-background shadow-sm">
                              <h2 className="text-lg font-medium text-upage-elements-textPrimary border-b border-upage-elements-borderColor pb-3 mb-4 flex items-center gap-2">
                                <span className="i-ph:note-pencil"></span>
                                摘要
                              </h2>
                              <div className="overflow-y-auto max-h-80 text-sm">
                                <Markdown>{part.data.summary}</Markdown>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="context"></div>
                    </Popover>
                  </div>
                </Tooltip>
              )}
            </div>
          );
        }
      })}
      {message.content && <Markdown html>{message.content}</Markdown>}
    </div>
  );
});

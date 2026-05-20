import classNames from 'classnames';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UserChoiceRequest, UserChoiceResponse } from '~/types/page-builder-tools';

export type UserChoiceCardProps = {
  request: UserChoiceRequest;
  response?: UserChoiceResponse;
  onSubmit?: (response: UserChoiceResponse) => void;
};

export const UserChoiceCard = memo(({ request, response, onSubmit }: UserChoiceCardProps) => {
  const isCompleted = Boolean(response);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(response?.selectedOptionIds || []));
  const [customText, setCustomText] = useState(response?.customText || '');
  const customInputRef = useRef<HTMLInputElement>(null);

  const isSingle = request.mode === 'single';

  const toggleOption = useCallback(
    (id: string) => {
      if (isCompleted) {
        return;
      }

      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (isSingle) {
          next.clear();
          next.add(id);
        } else {
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
        }
        return next;
      });
    },
    [isSingle, isCompleted],
  );

  const canSubmit = useMemo(() => {
    if (isCompleted) {
      return false;
    }
    return selectedIds.size > 0 || (request.allowCustomInput && customText.trim().length > 0);
  }, [selectedIds, customText, request.allowCustomInput, isCompleted]);

  const handleSubmit = useCallback(() => {
    if (!canSubmit || isCompleted) {
      return;
    }

    onSubmit?.({
      choiceId: request.choiceId,
      selectedOptionIds: Array.from(selectedIds),
      customText: request.allowCustomInput && customText.trim() ? customText.trim() : undefined,
    });
  }, [canSubmit, isCompleted, onSubmit, request.choiceId, request.allowCustomInput, selectedIds, customText]);

  useEffect(() => {
    if (isCompleted) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && canSubmit) {
        e.preventDefault();
        handleSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canSubmit, handleSubmit, isCompleted]);

  const renderSelectedSummary = () => {
    if (!response) {
      return null;
    }

    const selectedOptions = request.options.filter((opt) => response.selectedOptionIds.includes(opt.id));
    const labels = selectedOptions.map((opt) => opt.label);
    if (response.customText) {
      labels.push(`自定义: ${response.customText}`);
    }

    return (
      <div className="flex flex-wrap gap-1.5 mt-2">
        {labels.map((label, idx) => (
          <span
            key={idx}
            className="inline-flex items-center rounded-full bg-upage-elements-primary/10 px-2.5 py-0.5 text-xs text-upage-elements-primary"
          >
            {label}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div
      className={classNames(
        'rounded-xl border bg-upage-elements-background-depth-1/40 p-4',
        isCompleted ? 'border-upage-elements-borderColor/30 opacity-75' : 'border-upage-elements-borderColor/60',
      )}
    >
      <div className="flex items-start gap-2 mb-3">
        <div className="i-ph:question flex-shrink-0 mt-0.5 text-base text-upage-elements-primary" />
        <h4 className="text-sm font-medium text-upage-elements-textPrimary leading-relaxed">{request.question}</h4>
      </div>

      <div className="flex flex-col gap-2">
        {request.options.map((option) => {
          const isSelected = selectedIds.has(option.id);
          return (
            <button
              key={option.id}
              type="button"
              disabled={isCompleted}
              onClick={() => toggleOption(option.id)}
              className={classNames(
                'flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-all duration-150',
                isSelected
                  ? 'border-upage-elements-primary/50 bg-upage-elements-primary/5'
                  : 'border-upage-elements-borderColor/40 bg-upage-elements-background/60 hover:border-upage-elements-borderColor/70',
                isCompleted && 'cursor-default',
              )}
            >
              <div className="flex-shrink-0 mt-0.5">
                {isSingle ? (
                  <div
                    className={classNames(
                      'size-4 rounded-full border-2 flex items-center justify-center',
                      isSelected ? 'border-upage-elements-primary' : 'border-upage-elements-borderColor/60',
                    )}
                  >
                    {isSelected && <div className="size-2 rounded-full bg-upage-elements-primary" />}
                  </div>
                ) : (
                  <div
                    className={classNames(
                      'size-4 rounded border-2 flex items-center justify-center',
                      isSelected
                        ? 'border-upage-elements-primary bg-upage-elements-primary'
                        : 'border-upage-elements-borderColor/60',
                    )}
                  >
                    {isSelected && <div className="i-ph:check text-xs text-white" />}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-upage-elements-textPrimary">{option.label}</div>
                {option.description && (
                  <div className="text-xs text-upage-elements-textSecondary mt-0.5">{option.description}</div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {request.allowCustomInput && !isCompleted && (
        <div className="mt-3">
          <input
            ref={customInputRef}
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder={request.customInputPlaceholder || '或输入你的自定义方案...'}
            className="w-full rounded-lg border border-upage-elements-borderColor/50 bg-upage-elements-background/80 px-3 py-2 text-sm text-upage-elements-textPrimary placeholder:text-upage-elements-textSecondary/60 focus:border-upage-elements-primary/50 focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canSubmit) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
        </div>
      )}

      {isCompleted && renderSelectedSummary()}

      {!isCompleted && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className={classNames(
              'inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150',
              canSubmit
                ? 'bg-upage-elements-primary text-white hover:bg-upage-elements-primary/90'
                : 'bg-upage-elements-borderColor/30 text-upage-elements-textSecondary cursor-not-allowed',
            )}
          >
            <span>确认选择</span>
            <span className="i-ph:arrow-right text-xs" />
          </button>
        </div>
      )}

      {isCompleted && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-upage-elements-textSecondary">
          <span className="i-ph:check-circle text-upage-elements-primary" />
          <span>已选择</span>
        </div>
      )}
    </div>
  );
});

UserChoiceCard.displayName = 'UserChoiceCard';

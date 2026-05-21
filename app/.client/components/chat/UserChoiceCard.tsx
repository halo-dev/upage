import classNames from 'classnames';
import { memo, useState } from 'react';
import { getUserChoiceSelection, setUserChoiceSelection } from '~/.client/stores/ai-state';
import type { UserChoiceRequest, UserChoiceResponse } from '~/types/page-builder-tools';

export type UserChoiceCardProps = {
  request: UserChoiceRequest;
  response?: UserChoiceResponse;
  onSubmit?: (response: UserChoiceResponse) => void;
};

export const UserChoiceCard = memo(({ request, response, onSubmit }: UserChoiceCardProps) => {
  const isCompleted = Boolean(response);

  const persisted = getUserChoiceSelection(request.choiceId);
  const initialSelectedIds = persisted ? new Set(persisted.selectedIds) : new Set(response?.selectedOptionIds || []);
  const initialCustomText = persisted ? persisted.customText : response?.customText || '';

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => initialSelectedIds);
  const [customText, setCustomText] = useState(initialCustomText);

  const isSingle = request.mode === 'single';
  const groupName = `choice-${request.choiceId}`;

  const canSubmit = !isCompleted && (selectedIds.size > 0 || customText.trim().length > 0);

  const handleToggle = (id: string) => {
    if (isCompleted) {
      return;
    }

    const next = new Set(selectedIds);
    if (isSingle) {
      next.clear();
      next.add(id);
    } else {
      next.has(id) ? next.delete(id) : next.add(id);
    }

    setSelectedIds(next);
    setUserChoiceSelection(request.choiceId, {
      selectedIds: Array.from(next),
      customText,
    });
  };

  const handleCustomTextChange = (value: string) => {
    setCustomText(value);
    setUserChoiceSelection(request.choiceId, {
      selectedIds: Array.from(selectedIds),
      customText: value,
    });
  };

  const handleCustomFocus = () => {
    if (isCompleted) {
      return;
    }
    if (isSingle && selectedIds.size > 0) {
      setSelectedIds(new Set());
      setUserChoiceSelection(request.choiceId, {
        selectedIds: [],
        customText,
      });
    }
  };

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }

    setUserChoiceSelection(request.choiceId, undefined);
    onSubmit?.({
      choiceId: request.choiceId,
      selectedOptionIds: Array.from(selectedIds),
      customText: customText.trim() || undefined,
    });
  };

  if (isCompleted && response) {
    const selectedOptions = request.options.filter((opt) => response.selectedOptionIds.includes(opt.id));
    return (
      <div className="rounded-xl border border-upage-elements-borderColor/30 bg-upage-elements-background-depth-1/30 opacity-70 p-4">
        <div className="flex items-start gap-2.5 mb-3">
          <div className="i-ph:question flex-shrink-0 mt-0.5 text-lg text-accent-500" />
          <h4 className="text-sm font-semibold text-upage-elements-textPrimary leading-relaxed">{request.question}</h4>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedOptions.map((opt) => (
            <span
              key={opt.id}
              className="inline-flex items-center rounded-full bg-accent-500/10 px-3 py-1 text-xs font-medium text-accent-500"
            >
              {opt.label}
            </span>
          ))}
          {response.customText && (
            <span className="inline-flex items-center rounded-full bg-accent-500/10 px-3 py-1 text-xs font-medium text-accent-500">
              其他: {response.customText}
            </span>
          )}
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-xs text-upage-elements-textSecondary/70">
          <span className="i-ph:check-circle-fill text-accent-500 text-sm" />
          <span>已选择</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-upage-elements-borderColor/50 bg-upage-elements-background-depth-1/60 p-4">
      <div className="flex items-start gap-2.5 mb-4">
        <div className="i-ph:question flex-shrink-0 mt-0.5 text-lg text-accent-500" />
        <h4 className="text-sm font-semibold text-upage-elements-textPrimary leading-relaxed">{request.question}</h4>
      </div>

      <div className="flex flex-col gap-2">
        {request.options.map((option) => {
          const isSelected = selectedIds.has(option.id);
          const inputId = `${groupName}-${option.id}`;
          return (
            <label
              key={option.id}
              htmlFor={inputId}
              className={classNames(
                'flex items-center gap-3 rounded-lg border px-3.5 py-3 cursor-pointer transition-all duration-150',
                isSelected
                  ? 'border-accent-500 bg-accent-500/15'
                  : 'border-upage-elements-borderColor/40 bg-upage-elements-background/50 hover:border-upage-elements-borderColor/80 hover:bg-upage-elements-background/80',
              )}
            >
              <input
                id={inputId}
                type={isSingle ? 'radio' : 'checkbox'}
                name={groupName}
                value={option.id}
                checked={isSelected}
                onChange={() => handleToggle(option.id)}
                className="shrink-0 cursor-pointer accent-accent-500"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-upage-elements-textPrimary">{option.label}</div>
                {option.description && (
                  <div className="text-xs text-upage-elements-textSecondary/80 mt-0.5 leading-relaxed">
                    {option.description}
                  </div>
                )}
              </div>
            </label>
          );
        })}
      </div>

      <div className="mt-3">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="h-px flex-1 bg-upage-elements-borderColor/30" />
          <span className="text-[11px] text-upage-elements-textSecondary/70">其他建议</span>
          <div className="h-px flex-1 bg-upage-elements-borderColor/30" />
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 i-ph:pencil-simple text-sm text-upage-elements-textSecondary/50" />
          <input
            type="text"
            value={customText}
            onChange={(e) => handleCustomTextChange(e.target.value)}
            onFocus={handleCustomFocus}
            placeholder="输入你的自定义方案..."
            className={classNames(
              'w-full rounded-lg border pl-9 pr-3.5 py-2.5 text-sm transition-all duration-150',
              'bg-upage-elements-background/80 text-upage-elements-textPrimary',
              'placeholder:text-upage-elements-textSecondary/50',
              'focus:border-accent-500/50 focus:outline-none focus:ring-1 focus:ring-accent-500/20',
              customText.trim() ? 'border-accent-500/40' : 'border-upage-elements-borderColor/50',
            )}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canSubmit) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className={classNames(
            'inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all duration-150',
            canSubmit
              ? 'bg-accent-500 text-white hover:bg-accent-600 active:scale-[0.98] shadow-sm'
              : 'bg-upage-elements-borderColor/25 text-upage-elements-textSecondary/60 cursor-not-allowed',
          )}
        >
          <span>确认选择</span>
          <span className="i-ph:arrow-right text-xs" />
        </button>
      </div>
    </div>
  );
});

UserChoiceCard.displayName = 'UserChoiceCard';

import classNames from 'classnames';
import { memo, useState } from 'react';
import type { UserChoiceRequest, UserChoiceResponse } from '~/types/page-builder-tools';

export type UserChoiceCardProps = {
  choiceId: string;
  request: UserChoiceRequest;
  response?: UserChoiceResponse;
  onSubmit?: (response: UserChoiceResponse) => Promise<void> | void;
};

export const UserChoiceCard = memo(({ choiceId, request, response, onSubmit }: UserChoiceCardProps) => {
  const [selectedIds, setSelectedIds] = useState(() => new Set(response?.selectedOptionIds ?? []));
  const [customText, setCustomText] = useState(response?.customText ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isCompleted = Boolean(response);
  const isSingle = request.mode === 'single';
  const canSubmit = !isCompleted && !isSubmitting && Boolean(onSubmit) && (selectedIds.size > 0 || customText.trim());

  const toggleOption = (optionId: string) => {
    if (isCompleted || isSubmitting) {
      return;
    }

    const nextSelectedIds = new Set(selectedIds);
    if (isSingle) {
      nextSelectedIds.clear();
      nextSelectedIds.add(optionId);
      setCustomText('');
    } else if (nextSelectedIds.has(optionId)) {
      nextSelectedIds.delete(optionId);
    } else {
      nextSelectedIds.add(optionId);
    }
    setSelectedIds(nextSelectedIds);
  };

  const updateCustomText = (value: string) => {
    if (isSingle && value) {
      setSelectedIds(new Set());
    }
    setCustomText(value);
  };

  const submit = async () => {
    if (!canSubmit || !onSubmit) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        choiceId,
        selectedOptionIds: [...selectedIds],
        customText: customText.trim() || undefined,
      });
    } catch {
      setIsSubmitting(false);
    }
  };

  if (isCompleted && response) {
    const selectedOptions = request.options.filter((option) => response.selectedOptionIds.includes(option.id));
    return (
      <section
        aria-label="已完成的选择"
        className="rounded-xl border border-upage-elements-borderColor/40 bg-upage-elements-background-depth-1/35 p-4"
      >
        <div className="flex items-start gap-2.5">
          <span className="i-ph:check-circle-fill mt-0.5 shrink-0 text-lg text-upage-elements-textSuccess" />
          <div className="min-w-0">
            <h4 className="text-sm font-semibold leading-relaxed text-upage-elements-textPrimary">
              {request.question}
            </h4>
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedOptions.map((option) => (
                <span
                  key={option.id}
                  className="rounded-full bg-upage-elements-background-depth-2 px-2.5 py-1 text-xs text-upage-elements-textPrimary"
                >
                  {option.label}
                </span>
              ))}
              {response.customText ? (
                <span className="rounded-full bg-upage-elements-background-depth-2 px-2.5 py-1 text-xs text-upage-elements-textPrimary">
                  {response.customText}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="等待你的选择"
      className="rounded-xl border border-upage-elements-borderColor/60 bg-upage-elements-background-depth-1/55 p-4"
    >
      <div className="flex items-start gap-2.5">
        <span className="i-ph:palette mt-0.5 shrink-0 text-lg text-accent-500" />
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wide text-upage-elements-textSecondary">
            需要你的选择
          </div>
          <h4 className="mt-0.5 text-sm font-semibold leading-relaxed text-upage-elements-textPrimary">
            {request.question}
          </h4>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2" role={isSingle ? 'radiogroup' : 'group'}>
        {request.options.map((option) => {
          const isSelected = selectedIds.has(option.id);
          return (
            <label
              key={option.id}
              className={classNames(
                'flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 transition-colors',
                isSelected
                  ? 'border-accent-500/70 bg-accent-500/10'
                  : 'border-upage-elements-borderColor/45 bg-upage-elements-background/45 hover:border-upage-elements-borderColorActive hover:bg-upage-elements-background/75',
              )}
            >
              <input
                type={isSingle ? 'radio' : 'checkbox'}
                name={`user-choice-${choiceId}`}
                value={option.id}
                checked={isSelected}
                disabled={isSubmitting}
                onChange={() => toggleOption(option.id)}
                className="mt-0.5 shrink-0 accent-accent-500"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-upage-elements-textPrimary">{option.label}</span>
                {option.description ? (
                  <span className="mt-0.5 block text-xs leading-relaxed text-upage-elements-textSecondary">
                    {option.description}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>

      {request.allowCustomInput ? (
        <div className="mt-3">
          <label htmlFor={`user-choice-custom-${choiceId}`} className="text-xs text-upage-elements-textSecondary">
            或者描述你想要的方案
          </label>
          <input
            id={`user-choice-custom-${choiceId}`}
            value={customText}
            disabled={isSubmitting}
            placeholder={request.customInputPlaceholder || '输入你的自定义想法'}
            onChange={(event) => updateCustomText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && canSubmit) {
                event.preventDefault();
                void submit();
              }
            }}
            className="mt-1.5 w-full rounded-lg border border-upage-elements-borderColor/50 bg-upage-elements-background/75 px-3 py-2.5 text-sm text-upage-elements-textPrimary outline-none transition-colors placeholder:text-upage-elements-textSecondary/60 focus:border-accent-500/70"
          />
        </div>
      ) : null}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => void submit()}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent-500 px-4 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isSubmitting ? <span className="i-svg-spinners:90-ring-with-bg text-sm" /> : null}
          <span>{isSubmitting ? '正在继续' : '确认并继续'}</span>
        </button>
      </div>
    </section>
  );
});

UserChoiceCard.displayName = 'UserChoiceCard';

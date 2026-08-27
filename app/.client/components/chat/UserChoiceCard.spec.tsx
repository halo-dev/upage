import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UserChoiceCard } from './UserChoiceCard';

const request = {
  question: '请选择首页的视觉风格',
  options: [
    { id: 'editorial', label: '杂志编辑感', description: '强调排版与留白' },
    { id: 'playful', label: '活泼插画感', description: '强调色彩与亲和力' },
  ],
  mode: 'single' as const,
  allowCustomInput: true,
  customInputPlaceholder: '描述你的风格',
};

describe('UserChoiceCard', () => {
  it('submits a selected option', () => {
    const onSubmit = vi.fn();
    render(<UserChoiceCard choiceId="choice-1" request={request} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('radio', { name: /杂志编辑感/ }));
    fireEvent.click(screen.getByRole('button', { name: '确认并继续' }));

    expect(onSubmit).toHaveBeenCalledWith({
      choiceId: 'choice-1',
      selectedOptionIds: ['editorial'],
      customText: undefined,
    });
  });

  it('allows a custom answer and renders a persisted response', () => {
    const onSubmit = vi.fn();
    const { rerender } = render(<UserChoiceCard choiceId="choice-2" request={request} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByPlaceholderText('描述你的风格'), { target: { value: '克制的东方极简' } });
    fireEvent.click(screen.getByRole('button', { name: '确认并继续' }));

    expect(onSubmit).toHaveBeenCalledWith({
      choiceId: 'choice-2',
      selectedOptionIds: [],
      customText: '克制的东方极简',
    });

    rerender(
      <UserChoiceCard
        choiceId="choice-2"
        request={request}
        response={{ choiceId: 'choice-2', selectedOptionIds: [], customText: '克制的东方极简' }}
      />,
    );

    expect(screen.getByText('克制的东方极简')).toBeTruthy();
    expect(screen.getByLabelText('已完成的选择')).toBeTruthy();
  });
});

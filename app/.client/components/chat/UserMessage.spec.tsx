import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ChatUIMessage } from '~/types/message';
import { UserMessage } from './UserMessage';

describe('UserMessage', () => {
  it('should treat raw html in user text as plain text', () => {
    const message: ChatUIMessage = {
      id: 'user-message-1',
      role: 'user',
      parts: [
        {
          type: 'text',
          text: '<div data-testid="danger">hello</div>',
        },
      ],
    };

    const { container } = render(<UserMessage message={message} />);

    expect(container.querySelector('[data-testid="danger"]')).toBeNull();
    expect(screen.getByText('<div data-testid="danger">hello</div>')).toBeTruthy();
  });
});

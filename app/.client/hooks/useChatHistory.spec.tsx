import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { useRouteLoaderDataMock, useSearchParamsMock, loadEditorProjectMock, loadEditorProjectByMessageIdMock } =
  vi.hoisted(() => ({
    useRouteLoaderDataMock: vi.fn(),
    useSearchParamsMock: vi.fn(),
    loadEditorProjectMock: vi.fn(),
    loadEditorProjectByMessageIdMock: vi.fn(),
  }));

vi.mock('react-router', () => ({
  useRouteLoaderData: useRouteLoaderDataMock,
  useSearchParams: useSearchParamsMock,
}));

vi.mock('../persistence/editor', () => ({
  useEditorStorage: () => ({
    loadEditorProject: loadEditorProjectMock,
    loadEditorProjectByMessageId: loadEditorProjectByMessageIdMock,
  }),
}));

import { useChatHistory } from './useChatHistory';

let latestHookResult: ReturnType<typeof useChatHistory>;

function Probe() {
  latestHookResult = useChatHistory();
  return null;
}

describe('useChatHistory', () => {
  it('should fall back to the latest message that still has project data', async () => {
    loadEditorProjectMock.mockResolvedValue(undefined);
    loadEditorProjectByMessageIdMock.mockResolvedValue(undefined);
    useSearchParamsMock.mockReturnValue([new URLSearchParams(), vi.fn()]);
    useRouteLoaderDataMock.mockReturnValue({
      chat: {
        messages: [
          {
            id: 'assistant-1',
            role: 'assistant',
            pagesV2: [
              {
                id: 'page-1',
                messageId: 'assistant-1',
                name: 'index',
                title: '首页',
                content: '<main id="main"></main>',
                actionIds: [],
              },
            ],
            sections: [],
          },
          {
            id: 'user-2',
            role: 'user',
            pagesV2: [],
            sections: [],
          },
        ],
      },
    });

    render(<Probe />);

    await waitFor(async () => {
      const project = await latestHookResult?.getLoadProject?.();
      expect(project).toMatchObject({
        messageId: 'assistant-1',
        pages: [
          expect.objectContaining({
            name: 'index',
          }),
        ],
      });
    });
  });
});

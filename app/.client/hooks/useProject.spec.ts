import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveProjectToServer } from './useProject';

describe('saveProjectToServer', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should retry when the message has not been persisted yet', async () => {
    vi.useFakeTimers();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, message: '当前消息尚未保存，无法保存项目，请等待响应完成后重试' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: '项目保存成功' }),
      });

    const resultPromise = saveProjectToServer(
      {
        messageId: 'message-1',
        pages: '[]',
        sections: '[]',
      },
      fetchMock as typeof fetch,
    );

    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
  });

  it('should stop immediately for non-retryable errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, message: 'sections数据格式无效' }),
    });

    const result = await saveProjectToServer(
      {
        messageId: 'message-1',
        pages: '[]',
        sections: '[]',
      },
      fetchMock as typeof fetch,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
    expect(result.message).toBe('sections数据格式无效');
  });

  it('should include clearDraftMessageId when promoting a draft to final', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, message: '项目保存成功' }),
    });

    await saveProjectToServer(
      {
        messageId: 'message-1',
        pages: '[]',
        sections: '[]',
        clearDraftMessageId: 'draft-message-1',
      },
      fetchMock as typeof fetch,
    );

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const formData = requestInit.body as FormData;
    expect(formData.get('clearDraftMessageId')).toBe('draft-message-1');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { uploadFileMock, getFileContentMock } = vi.hoisted(() => {
  return {
    uploadFileMock: vi.fn(),
    getFileContentMock: vi.fn(),
  };
});

vi.mock('~/.server/storage/index.server', () => {
  return {
    storageProvider: {
      uploadFile: uploadFileMock,
      getFileContent: getFileContentMock,
    },
  };
});

import { materializeMessagesFileReferencesForModel, normalizeMessageFileReferences } from './chat-file-reference';

describe('chat-file-reference', () => {
  beforeEach(() => {
    uploadFileMock.mockReset();
    getFileContentMock.mockReset();
  });

  it('should reject foreign local upload references during normalization', async () => {
    await expect(
      normalizeMessageFileReferences({
        userId: 'user-a',
        messageId: 'msg-1',
        message: {
          id: 'msg-1',
          role: 'user',
          metadata: {},
          parts: [
            {
              type: 'file',
              url: '/uploads/chat-references/user-b/msg-2/image.png',
              mediaType: 'image/png',
              filename: 'image.png',
            },
          ],
        },
      }),
    ).rejects.toThrow('无权访问当前聊天附件');
  });

  it('should keep owned local upload references during normalization', async () => {
    const result = await normalizeMessageFileReferences({
      userId: 'user-a',
      messageId: 'msg-1',
      message: {
        id: 'msg-1',
        role: 'user',
        metadata: {},
        parts: [
          {
            type: 'file',
            url: '/uploads/chat-references/user-a/msg-1/image.png',
            mediaType: 'image/png',
            filename: 'image.png',
          },
        ],
      },
    });

    expect(result.parts[0]).toEqual(
      expect.objectContaining({
        type: 'file',
        url: '/uploads/chat-references/user-a/msg-1/image.png',
      }),
    );
  });

  it('should materialize owned files as absolute urls for vision-capable models', async () => {
    const [message] = await materializeMessagesFileReferencesForModel({
      request: new Request('https://example.com/chat'),
      userId: 'user-a',
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          metadata: {},
          parts: [
            {
              type: 'file',
              url: '/uploads/chat-references/user-a/msg-1/image.png',
              mediaType: 'image/png',
              filename: 'image.png',
            },
          ],
        },
      ],
      supportsImageUrl: true,
      supportsBase64Image: false,
    });

    expect(message.parts[0]).toEqual(
      expect.objectContaining({
        type: 'file',
        url: 'https://example.com/uploads/chat-references/user-a/msg-1/image.png',
      }),
    );
  });

  it('should materialize owned files as base64 when needed', async () => {
    getFileContentMock.mockResolvedValue(Buffer.from('hello'));

    const [message] = await materializeMessagesFileReferencesForModel({
      request: new Request('http://localhost:5173/chat'),
      userId: 'user-a',
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          metadata: {},
          parts: [
            {
              type: 'file',
              url: '/uploads/chat-references/user-a/msg-1/image.png',
              mediaType: 'image/png',
              filename: 'image.png',
            },
          ],
        },
      ],
      supportsImageUrl: false,
      supportsBase64Image: true,
    });

    expect(getFileContentMock).toHaveBeenCalledWith('chat-references/user-a/msg-1/image.png');
    expect(message.parts[0]).toEqual(
      expect.objectContaining({
        type: 'file',
        url: 'data:image/png;base64,aGVsbG8=',
      }),
    );
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireAuthMock, findUniqueMock, saveOrUpdateProjectMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  findUniqueMock: vi.fn(),
  saveOrUpdateProjectMock: vi.fn(),
}));

vi.mock('~/.server/service/auth', () => ({
  requireAuth: requireAuthMock,
}));

vi.mock('~/.server/service/prisma', () => ({
  prisma: {
    message: {
      findUnique: findUniqueMock,
    },
  },
}));

vi.mock('~/.server/service/project-service', () => ({
  saveOrUpdateProject: saveOrUpdateProjectMock,
}));

import { action } from './index';

function createRequest() {
  const formData = new FormData();
  formData.append('messageId', 'message-1');
  formData.append('pages', JSON.stringify([{ name: 'index', title: '首页', content: '<main id="main"></main>' }]));
  formData.append(
    'sections',
    JSON.stringify([{ id: 'section-1', pageName: 'index', domId: 'main', rootDomId: 'main', actionId: 'section-1' }]),
  );

  return new Request('http://localhost/api/project', {
    method: 'POST',
    body: formData,
  });
}

describe('/api/project action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return auth response directly when user is not authenticated', async () => {
    const authResponse = new Response('Unauthorized', { status: 401 });
    requireAuthMock.mockResolvedValue(authResponse);

    const result = await action({ request: createRequest() } as never);

    expect(result).toBe(authResponse);
  });

  it('should reject saving projects owned by another user', async () => {
    requireAuthMock.mockResolvedValue({
      userInfo: {
        sub: 'user-1',
      },
    });
    findUniqueMock.mockResolvedValue({
      id: 'message-1',
      chat: {
        userId: 'user-2',
      },
    });

    const result = await action({ request: createRequest() } as never);

    expect(result).toMatchObject({
      init: {
        status: 403,
      },
      data: {
        success: false,
        message: '无权保存当前项目',
      },
    });
    expect(saveOrUpdateProjectMock).not.toHaveBeenCalled();
  });

  it('should save project data for the owning user', async () => {
    requireAuthMock.mockResolvedValue({
      userInfo: {
        sub: 'user-1',
      },
    });
    findUniqueMock.mockResolvedValue({
      id: 'message-1',
      chat: {
        userId: 'user-1',
      },
    });
    saveOrUpdateProjectMock.mockResolvedValue({
      success: true,
      pages: [],
      sections: [],
    });

    const result = await action({ request: createRequest() } as never);

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { id: 'message-1' },
      select: {
        id: true,
        chat: {
          select: {
            userId: true,
          },
        },
      },
    });
    expect(saveOrUpdateProjectMock).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          messageId: 'message-1',
          name: 'index',
        }),
      ],
      [
        expect.objectContaining({
          messageId: 'message-1',
          actionId: 'section-1',
        }),
      ],
    );
    expect(result).toMatchObject({
      init: {
        status: 200,
      },
      data: {
        success: true,
      },
    });
  });
});

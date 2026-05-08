import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createOrUpdatePagesV2, createOrUpdateManySections, deletePageV2ByMessageId, deleteMessageSections } =
  vi.hoisted(() => ({
    createOrUpdatePagesV2: vi.fn(),
    createOrUpdateManySections: vi.fn(),
    deletePageV2ByMessageId: vi.fn(),
    deleteMessageSections: vi.fn(),
  }));

vi.mock('./page-v2', () => ({
  createOrUpdatePagesV2,
  deletePageV2ByMessageId,
}));

vi.mock('./section', () => ({
  createOrUpdateManySections,
  deleteMessageSections,
}));

import { replaceProjectSnapshot, saveOrUpdateProject } from './project-service';

describe('saveOrUpdateProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should persist sections even when content is empty', async () => {
    createOrUpdatePagesV2.mockResolvedValue([
      {
        id: 'page-v2-1',
        messageId: 'message-1',
        name: 'index',
        title: '首页',
        content: '<main id="main-content"></main>',
      },
    ]);
    createOrUpdateManySections.mockResolvedValue([
      {
        id: 'section-1',
        messageId: 'message-1',
        action: 'update',
        actionId: 'main-content',
        pageName: 'index',
        content: '',
        domId: 'btn-action',
        rootDomId: 'btn-action',
        pageV2Id: 'page-v2-1',
      },
    ]);

    const result = await saveOrUpdateProject(
      [
        {
          messageId: 'message-1',
          name: 'index',
          title: '首页',
          content: '<main id="main-content"></main>',
          actionIds: ['main-content'],
        },
      ],
      [
        {
          id: 'section-1',
          messageId: 'message-1',
          action: 'update',
          actionId: 'main-content',
          pageName: 'index',
          content: '',
          domId: 'btn-action',
          rootDomId: 'btn-action',
        },
      ],
    );

    expect(createOrUpdatePagesV2).toHaveBeenCalledWith([
      expect.objectContaining({
        messageId: 'message-1',
        name: 'index',
      }),
    ]);
    expect(createOrUpdateManySections).toHaveBeenCalledWith([
      expect.objectContaining({
        actionId: 'main-content',
        content: '',
        domId: 'btn-action',
        pageName: 'index',
        pageV2Id: 'page-v2-1',
      }),
    ]);
    expect(result).toMatchObject({
      success: true,
    });
  });

  it('should backfill legacy section identifiers before persisting', async () => {
    createOrUpdatePagesV2.mockResolvedValue([
      {
        id: 'page-v2-1',
        messageId: 'message-1',
        name: 'index',
        title: '首页',
        content: '<main id="main-content"></main>',
      },
    ]);
    createOrUpdateManySections.mockResolvedValue([
      {
        id: 'section-legacy',
        messageId: 'message-1',
        action: 'update',
        actionId: 'section-legacy',
        pageName: 'index',
        content: '<button id="btn-action">立即开始</button>',
        domId: 'hero-actions',
        rootDomId: 'hero-actions',
        pageV2Id: 'page-v2-1',
      },
    ]);

    await saveOrUpdateProject(
      [
        {
          messageId: 'message-1',
          name: 'index',
          title: '首页',
          content: '<main id="main-content"></main>',
          actionIds: ['section-legacy'],
        },
      ],
      [
        {
          id: 'section-legacy',
          messageId: 'message-1',
          action: 'update',
          actionId: '',
          pageName: 'index',
          content: '<button id="btn-action">立即开始</button>',
          domId: '',
          rootDomId: 'hero-actions',
        },
      ],
    );

    expect(createOrUpdateManySections).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'section-legacy',
        actionId: 'section-legacy',
        domId: 'hero-actions',
        rootDomId: 'hero-actions',
        pageV2Id: 'page-v2-1',
      }),
    ]);
  });

  it('should replace an existing snapshot before persisting draft data', async () => {
    createOrUpdatePagesV2.mockResolvedValue([
      {
        id: 'page-v2-1',
        messageId: 'message-1',
        name: 'index',
        title: '首页',
        content: '<main id="main"></main>',
      },
    ]);
    createOrUpdateManySections.mockResolvedValue([]);

    const result = await replaceProjectSnapshot(
      'message-1',
      [
        {
          messageId: 'message-1',
          name: 'index',
          title: '首页',
          content: '<main id="main"></main>',
          actionIds: [],
        },
      ],
      [],
    );

    expect(deleteMessageSections).toHaveBeenCalledWith('message-1');
    expect(deletePageV2ByMessageId).toHaveBeenCalledWith('message-1');
    expect(createOrUpdatePagesV2).toHaveBeenCalledWith([
      expect.objectContaining({
        messageId: 'message-1',
        name: 'index',
      }),
    ]);
    expect(result).toMatchObject({
      success: true,
      sections: [],
    });
  });
});

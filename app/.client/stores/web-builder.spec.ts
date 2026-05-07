import { describe, expect, it, vi } from 'vitest';
import type { PageMap } from '~/types/pages';
import { WebBuilderStore } from './web-builder';

describe('WebBuilderStore.setPages', () => {
  it('should replace the pages snapshot instead of mutating existing store state', () => {
    const replaceSnapshot = vi.fn();
    const resetSnapshot = vi.fn();
    const pages: PageMap = {
      index: {
        id: 'page-1',
        name: 'index',
        title: '首页',
        content: '<main id="main"></main>',
        actionIds: [],
      },
    };

    WebBuilderStore.prototype.setPages.call(
      {
        pagesStore: {
          replaceSnapshot,
        },
        editorStore: {
          resetSnapshot,
        },
      },
      pages,
    );

    expect(replaceSnapshot).toHaveBeenCalledTimes(1);
    expect(replaceSnapshot).toHaveBeenCalledWith(pages);
    expect(resetSnapshot).toHaveBeenCalledTimes(1);
    expect(resetSnapshot).toHaveBeenCalledWith(pages);
  });
});

describe('WebBuilderStore.deletePage', () => {
  it('should prevent deleting the last remaining page', async () => {
    const deletePage = vi.fn();

    const result = await WebBuilderStore.prototype.deletePage.call(
      {
        pagesStore: {
          pages: {
            get: () => ({
              index: {
                id: 'page-1',
                name: 'index',
                title: '首页',
                content: '<main id="main"></main>',
                actionIds: [],
              },
            }),
          },
          deletePage,
        },
        editorStore: {
          currentDocument: {
            get: () => ({ name: 'index' }),
          },
        },
        setSelectedPage: vi.fn(),
      },
      'index',
    );

    expect(result).toBe(false);
    expect(deletePage).not.toHaveBeenCalled();
  });

  it('should switch to another existing page after deleting the current page', async () => {
    const nextPages: PageMap = {
      index: undefined,
      about: {
        id: 'page-2',
        name: 'about',
        title: '关于',
        content: '<main id="about"></main>',
        actionIds: [],
      },
    };
    const getPages = vi
      .fn()
      .mockReturnValueOnce({
        index: {
          id: 'page-1',
          name: 'index',
          title: '首页',
          content: '<main id="main"></main>',
          actionIds: [],
        },
        about: nextPages.about,
      })
      .mockReturnValueOnce(nextPages);
    const deletePage = vi.fn().mockResolvedValue(true);
    const setSelectedPage = vi.fn();

    const result = await WebBuilderStore.prototype.deletePage.call(
      {
        pagesStore: {
          pages: {
            get: getPages,
          },
          deletePage,
        },
        editorStore: {
          currentDocument: {
            get: () => ({ name: 'index' }),
          },
        },
        setSelectedPage,
      },
      'index',
    );

    expect(result).toBe(true);
    expect(deletePage).toHaveBeenCalledWith('index');
    expect(setSelectedPage).toHaveBeenCalledWith('about');
  });
});

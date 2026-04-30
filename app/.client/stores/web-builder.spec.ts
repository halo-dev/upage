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

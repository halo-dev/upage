import { describe, expect, it } from 'vitest';
import type { UPagePagePart } from '~/types/message';
import type { PageData } from '~/types/pages';
import { applyPagePartToDraftProjectSnapshot } from './page-builder-draft';

describe('page-builder draft materialization', () => {
  it('should materialize patches targeting main in Node runtime', () => {
    const snapshot = {
      anchorMessageId: 'assistant-1',
      pages: new Map<string, PageData>([
        [
          'index',
          {
            id: 'page-index',
            messageId: 'assistant-1',
            name: 'index',
            title: '首页',
            content: '',
            actionIds: [],
            sort: 0,
          },
        ],
      ]),
      sections: new Map(),
    };

    const page: UPagePagePart = {
      artifact: {
        id: 'artifact-index',
        name: 'index',
        title: '首页',
      },
      actions: [
        {
          id: 'hero',
          action: 'add',
          pageName: 'index',
          domId: 'main',
          rootDomId: 'hero',
          validRootDomId: false,
          contentKind: 'patch',
          content: '',
          patches: [
            {
              type: 'insert-node',
              opId: 'insert-hero',
              parentDomId: 'main',
              html: '<section id="hero"><h1>hello</h1></section>',
            },
          ],
        },
      ],
    };

    expect(() => applyPagePartToDraftProjectSnapshot(snapshot, page)).not.toThrow();
    expect(snapshot.pages.get('index')?.content).toContain('<section id="hero"><h1>hello</h1></section>');
  });
});

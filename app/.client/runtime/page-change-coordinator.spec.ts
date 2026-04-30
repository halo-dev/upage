import { atom, map } from 'nanostores';
import { describe, expect, it, vi } from 'vitest';
import { PageChangeCoordinator } from './page-change-coordinator';

describe('PageChangeCoordinator', () => {
  it('should materialize patch actions before enqueueing editor patches', () => {
    const upsertSection = vi.fn();
    const enqueueEditorPatch = vi.fn();
    const addAction = vi.fn();
    const runAction = vi.fn();

    const coordinator = new PageChangeCoordinator({
      showWorkbench: atom(false),
      currentView: atom<'code' | 'diff' | 'preview'>('diff'),
      editorStore: {
        editorDocuments: map({
          index: {
            name: 'index',
            title: '首页',
            content: '<section id="hero"><div id="hero-copy">旧标题</div></section>',
            head: '',
          },
        }),
      },
      chatStore: {
        addArtifact: vi.fn(),
        updateArtifact: vi.fn(),
        setCurrentMessageId: vi.fn(),
        addAction,
        runAction,
      },
      pagesStore: {
        activePage: atom<string | undefined>(undefined),
        activeSection: atom<string | undefined>(undefined),
        getPage: vi.fn(() => ({
          id: 'page-1',
          name: 'index',
          title: '首页',
          content: '<section id="hero"><div id="hero-copy">旧标题</div></section>',
          actionIds: [],
        })),
        setActivePage: vi.fn(),
        setActiveSection: vi.fn(),
        upsertSection,
        enqueueEditorPatch,
      },
    } as never);

    coordinator.handleEvent({
      type: 'action',
      messageId: 'message-1',
      artifactId: 'artifact-1',
      actionId: 'hero-copy',
      source: 'tool-upage-output',
      action: {
        id: 'hero-copy',
        action: 'update',
        pageName: 'index',
        contentKind: 'patch',
        content: '',
        domId: 'hero-copy',
        rootDomId: 'hero-copy',
        validRootDomId: false,
        patches: [
          {
            opId: 'set-copy',
            type: 'set-text',
            target: {
              domId: 'hero-copy',
            },
            text: '第一版标题',
          },
        ],
      },
    });

    coordinator.handleEvent({
      type: 'action',
      messageId: 'message-1',
      artifactId: 'artifact-1',
      actionId: 'hero-copy-class',
      source: 'tool-upage-output',
      action: {
        id: 'hero-copy-class',
        action: 'update',
        pageName: 'index',
        contentKind: 'patch',
        content: '',
        domId: 'hero-copy',
        rootDomId: 'hero-copy',
        validRootDomId: false,
        patches: [
          {
            opId: 'set-class',
            type: 'set-attr',
            target: {
              domId: 'hero-copy',
            },
            name: 'class',
            value: 'headline',
          },
        ],
      },
    });

    expect(upsertSection).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        contentKind: 'html',
        content: '<div id="hero-copy">第一版标题</div>',
      }),
    );
    expect(upsertSection).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        contentKind: 'html',
        content: '<div id="hero-copy" class="headline">第一版标题</div>',
      }),
    );
    expect(enqueueEditorPatch).toHaveBeenCalledTimes(2);
    expect(addAction).toHaveBeenCalledTimes(2);
    expect(runAction).toHaveBeenCalledTimes(2);
  });

  it('should route remove-page patch actions to the action runner without materializing sections', () => {
    const getPage = vi.fn();
    const upsertSection = vi.fn();
    const enqueueEditorPatch = vi.fn();
    const addAction = vi.fn();
    const runAction = vi.fn();

    const coordinator = new PageChangeCoordinator({
      showWorkbench: atom(false),
      currentView: atom<'code' | 'diff' | 'preview'>('diff'),
      editorStore: {
        editorDocuments: map({}),
      },
      chatStore: {
        addArtifact: vi.fn(),
        updateArtifact: vi.fn(),
        setCurrentMessageId: vi.fn(),
        addAction,
        runAction,
      },
      pagesStore: {
        activePage: atom<string | undefined>(undefined),
        activeSection: atom<string | undefined>(undefined),
        getPage,
        setActivePage: vi.fn(),
        setActiveSection: vi.fn(),
        upsertSection,
        enqueueEditorPatch,
      },
    } as never);

    coordinator.handleEvent({
      type: 'action',
      messageId: 'message-1',
      artifactId: 'artifact-1',
      actionId: 'remove-pricing-page',
      source: 'tool-upage-output',
      action: {
        id: 'remove-pricing-page',
        action: 'remove',
        pageName: 'pricing',
        contentKind: 'patch',
        content: '',
        domId: '__page__',
        rootDomId: '__page__',
        validRootDomId: true,
        patches: [
          {
            opId: 'remove-pricing-page-op',
            type: 'remove-page',
          },
        ],
      },
    });

    expect(getPage).not.toHaveBeenCalled();
    expect(upsertSection).not.toHaveBeenCalled();
    expect(enqueueEditorPatch).not.toHaveBeenCalled();
    expect(addAction).toHaveBeenCalledTimes(1);
    expect(runAction).toHaveBeenCalledTimes(1);
    expect(runAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expect.objectContaining({
          id: 'remove-pricing-page',
        }),
      }),
      false,
    );
  });

  it('should not append duplicate nodes for repeated streaming insert patches', () => {
    const upsertSection = vi.fn();
    const enqueueEditorPatch = vi.fn();
    const addAction = vi.fn();
    const runAction = vi.fn();

    const coordinator = new PageChangeCoordinator({
      showWorkbench: atom(false),
      currentView: atom<'code' | 'diff' | 'preview'>('diff'),
      editorStore: {
        editorDocuments: map({
          index: {
            name: 'index',
            title: '首页',
            content: '<section id="main-content"><p id="hero-copy">旧文案</p></section>',
            head: '',
          },
        }),
      },
      chatStore: {
        addArtifact: vi.fn(),
        updateArtifact: vi.fn(),
        setCurrentMessageId: vi.fn(),
        addAction,
        runAction,
      },
      pagesStore: {
        activePage: atom<string | undefined>(undefined),
        activeSection: atom<string | undefined>(undefined),
        getPage: vi.fn(() => ({
          id: 'page-1',
          name: 'index',
          title: '首页',
          content: '<section id="main-content"><p id="hero-copy">旧文案</p></section>',
          actionIds: [],
        })),
        setActivePage: vi.fn(),
        setActiveSection: vi.fn(),
        upsertSection,
        enqueueEditorPatch,
      },
    } as never);

    const event = {
      type: 'action' as const,
      messageId: 'message-1',
      artifactId: 'artifact-1',
      actionId: 'main-content',
      source: 'tool-upage-input' as const,
      action: {
        id: 'main-content',
        action: 'update' as const,
        pageName: 'index',
        contentKind: 'patch' as const,
        content: '',
        domId: 'main-content',
        rootDomId: 'main-content',
        validRootDomId: false,
        patches: [
          {
            opId: 'add-button',
            type: 'insert-node' as const,
            parentDomId: 'main-content',
            position: 'append' as const,
            sort: 1,
            html: '<button id="cta-btn">立即开始</button>',
          },
        ],
      },
    };

    coordinator.handleEvent({ ...event, streaming: true });
    coordinator.handleEvent({ ...event, streaming: true });
    coordinator.handleEvent({ ...event, source: 'tool-upage-output', streaming: false });

    expect(upsertSection).toHaveBeenCalledTimes(2);
    expect(upsertSection).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        content:
          '<section id="main-content"><p id="hero-copy">旧文案</p><button id="cta-btn">立即开始</button></section>',
      }),
    );
    expect(upsertSection).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        content:
          '<section id="main-content"><p id="hero-copy">旧文案</p><button id="cta-btn">立即开始</button></section>',
      }),
    );
    expect(enqueueEditorPatch).toHaveBeenCalledTimes(2);
    expect(runAction).toHaveBeenCalledTimes(2);
  });
});

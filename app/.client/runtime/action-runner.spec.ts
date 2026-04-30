import { describe, expect, it, vi } from 'vitest';
import type { EditorBridge } from '~/.client/bridge';
import { ActionRunner } from './action-runner';

describe('ActionRunner', () => {
  it('should execute materialized html actions successfully', async () => {
    const editorBridge = createEditorBridgeMock();
    const runner = new ActionRunner(Promise.resolve(editorBridge), { id: 'page-1', name: 'index', title: '首页' });
    const data = createActionData();

    runner.addAction(data);
    await runner.runAction(data);

    expect(editorBridge.upsertPageAction).toHaveBeenCalledWith('index', '首页', 'hero', 'index');
    expect(editorBridge.updateSection).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'hero',
        contentKind: 'html',
        content: '<section id="hero"></section>',
      }),
    );
    expect(runner.actions.get()[data.actionId]?.status).toBe('complete');
  });

  it('should not execute aborted actions', async () => {
    const editorBridge = createEditorBridgeMock();
    const runner = new ActionRunner(Promise.resolve(editorBridge), { id: 'page-1', name: 'index', title: '首页' });
    const data = createActionData();

    runner.addAction(data);
    runner.actions.get()[data.actionId]?.abort();

    await runner.runAction(data);

    expect(editorBridge.upsertPageAction).not.toHaveBeenCalled();
    expect(editorBridge.updateSection).not.toHaveBeenCalled();
    expect(runner.actions.get()[data.actionId]?.status).toBe('aborted');
  });

  it('should stop before section updates when aborted after page update', async () => {
    let runner: ActionRunner;
    const editorBridge = createEditorBridgeMock({
      upsertPageAction: vi.fn(async () => {
        runner.actions.get().hero?.abort();
      }),
    });

    runner = new ActionRunner(Promise.resolve(editorBridge), { id: 'page-1', name: 'index', title: '首页' });
    const data = createActionData();

    runner.addAction(data);
    await runner.runAction(data);

    expect(editorBridge.upsertPageAction).toHaveBeenCalledTimes(1);
    expect(editorBridge.updateSection).not.toHaveBeenCalled();
    expect(runner.actions.get()[data.actionId]?.status).toBe('aborted');
  });

  it('should move an action away from the previous draft page when the final page name changes', async () => {
    const editorBridge = createEditorBridgeMock();
    const runner = new ActionRunner(Promise.resolve(editorBridge), { id: 'page-1', name: 'index', title: '首页' });
    const draftData = createActionData({
      action: {
        pageName: 'ui-test-page-draft',
      },
    });
    const finalData = createActionData();

    runner.addAction(draftData);
    await runner.runAction(draftData, true);
    await runner.runAction(finalData);

    expect(editorBridge.upsertPageAction).toHaveBeenNthCalledWith(
      1,
      'ui-test-page-draft',
      '首页',
      'hero',
      'ui-test-page-draft',
    );
    expect(editorBridge.upsertPageAction).toHaveBeenNthCalledWith(2, 'index', '首页', 'hero', 'ui-test-page-draft');
  });

  it('should not execute the same action again when final payload matches the streaming payload', async () => {
    const editorBridge = createEditorBridgeMock();
    const runner = new ActionRunner(Promise.resolve(editorBridge), { id: 'page-1', name: 'index', title: '首页' });
    const data = createActionData();

    runner.addAction(data);
    await runner.runAction(data, true);
    await runner.runAction(data);

    expect(editorBridge.upsertPageAction).toHaveBeenCalledTimes(1);
    expect(editorBridge.updateSection).toHaveBeenCalledTimes(1);
    expect(runner.actions.get()[data.actionId]?.status).toBe('complete');
  });

  it('should delete a page for remove-page patch actions', async () => {
    const editorBridge = createEditorBridgeMock();
    const runner = new ActionRunner(Promise.resolve(editorBridge), { id: 'page-1', name: 'pricing', title: '定价页' });
    const data = createActionData({
      actionId: 'remove-pricing-page',
      action: {
        id: 'remove-pricing-page',
        action: 'remove' as const,
        pageName: 'pricing',
        contentKind: 'patch' as const,
        content: '',
        domId: '__page__',
        rootDomId: '__page__',
        validRootDomId: true,
        patches: [
          {
            opId: 'remove-pricing-page-op',
            type: 'remove-page' as const,
          },
        ],
      },
    });

    runner.addAction(data);
    await runner.runAction(data);

    expect(editorBridge.removePage).toHaveBeenCalledWith('pricing');
    expect(editorBridge.upsertPageAction).not.toHaveBeenCalled();
    expect(editorBridge.updateSection).not.toHaveBeenCalled();
    expect(runner.actions.get()[data.actionId]?.status).toBe('complete');
  });
});

function createEditorBridgeMock(overrides: Partial<EditorBridge> = {}) {
  return {
    upsertPageAction: vi.fn().mockResolvedValue(undefined),
    updateSection: vi.fn().mockResolvedValue(undefined),
    removePage: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as EditorBridge;
}

function createActionData(
  overrides: Partial<{
    messageId: string;
    artifactId: string;
    actionId: string;
    action: Partial<{
      id: string;
      action: 'update' | 'remove';
      pageName: string;
      contentKind: 'html' | 'patch';
      content: string;
      domId: string;
      rootDomId: string;
      validRootDomId: boolean;
      patches: Array<
        | {
            opId: string;
            type: 'remove-page';
          }
        | {
            opId: string;
            type: 'set-text';
            target: { domId: string };
            text: string;
          }
      >;
    }>;
  }> = {},
) {
  return {
    messageId: overrides.messageId ?? 'message-1',
    artifactId: overrides.artifactId ?? 'artifact-1',
    actionId: overrides.actionId ?? 'hero',
    action: {
      id: overrides.action?.id ?? 'hero',
      action: overrides.action?.action ?? ('update' as const),
      pageName: overrides.action?.pageName ?? 'index',
      contentKind: overrides.action?.contentKind ?? ('html' as const),
      content: overrides.action?.content ?? '<section id="hero"></section>',
      domId: overrides.action?.domId ?? 'page-index',
      rootDomId: overrides.action?.rootDomId ?? 'hero',
      validRootDomId: overrides.action?.validRootDomId ?? true,
      patches: overrides.action?.patches,
    },
  };
}

import type { ActionCallbackData, ArtifactCallbackData } from '~/.client/runtime/message-parser';
import type { WebBuilderStore } from '~/.client/stores/web-builder';
import { isRemovePageAction } from '~/types/actions';
import { materializePageAction } from './protocol/materialize-page-action';
import type { PageChangeEvent } from './protocol/types';

export class PageChangeCoordinator {
  private processedActionKeys = new Set<string>();
  private pageContentSnapshots = new Map<string, string>();
  private actionSignatures = new Map<string, string>();
  private materializedActionCache = new Map<string, ActionCallbackData['action']>();

  constructor(private readonly webBuilderStore: WebBuilderStore) {}

  reset() {
    this.processedActionKeys = new Set();
    this.pageContentSnapshots = new Map();
    this.actionSignatures = new Map();
    this.materializedActionCache = new Map();
  }

  handleEvents(events: PageChangeEvent[]) {
    for (const event of events) {
      this.handleEvent(event);
    }
  }

  handleEvent(event: PageChangeEvent) {
    switch (event.type) {
      case 'artifact-open':
        this.handleArtifactOpen({
          messageId: event.messageId,
          ...event.artifact,
        });
        return;
      case 'artifact-close':
        this.handleArtifactClose({
          messageId: event.messageId,
          ...event.artifact,
        });
        return;
      case 'action':
        this.handleActionEvent(event);
        return;
    }
  }

  handleArtifactOpen(data: ArtifactCallbackData) {
    this.webBuilderStore.showWorkbench.set(true);
    this.webBuilderStore.chatStore.addArtifact(data);
    this.webBuilderStore.chatStore.setCurrentMessageId(data.messageId);
  }

  handleArtifactClose(data: ArtifactCallbackData) {
    this.webBuilderStore.chatStore.updateArtifact(data, { closed: true });
  }

  handleAction(data: ActionCallbackData, streaming: boolean = false) {
    this.handleActionEvent({
      type: 'action',
      messageId: data.messageId,
      artifactId: data.artifactId,
      actionId: data.actionId,
      action: data.action,
      source: 'legacy-xml',
      streaming,
    });
  }

  private handleActionEvent(event: Extract<PageChangeEvent, { type: 'action' }>) {
    const processedKey = `${event.messageId}:${event.artifactId}:${event.actionId}`;
    const actionSignature = JSON.stringify(event.action);
    if (!event.streaming && this.processedActionKeys.has(processedKey)) {
      return;
    }

    if (isRemovePageAction(event.action)) {
      this.handleRemovePageActionEvent(event, processedKey);
      return;
    }

    const previousSignature = this.actionSignatures.get(processedKey);
    if (event.streaming && previousSignature === actionSignature) {
      return;
    }

    const cachedAction =
      previousSignature === actionSignature ? this.materializedActionCache.get(processedKey) : undefined;
    const materializedResult = cachedAction
      ? undefined
      : materializePageAction(event.action, this.resolvePageContent(event.action.pageName));
    const materializedAction = cachedAction ?? materializedResult?.action;

    if (!materializedAction) {
      return;
    }

    if (materializedResult) {
      this.pageContentSnapshots.set(event.action.pageName, materializedResult.nextPageContent);
      this.actionSignatures.set(processedKey, actionSignature);
      this.materializedActionCache.set(processedKey, materializedAction);
    }

    const data: ActionCallbackData = {
      messageId: event.messageId,
      artifactId: event.artifactId,
      actionId: event.actionId,
      action: materializedAction,
    };

    this.webBuilderStore.showWorkbench.set(true);
    this.webBuilderStore.chatStore.setCurrentMessageId(event.messageId);
    this.webBuilderStore.chatStore.addAction(data);

    if (event.source === 'data-upage-block-start') {
      return;
    }

    this.focusActionTarget(materializedAction.pageName, materializedAction.id);
    this.webBuilderStore.pagesStore.upsertSection(materializedAction);
    this.webBuilderStore.pagesStore.enqueueEditorPatch({
      messageId: event.messageId,
      artifactId: event.artifactId,
      actionId: event.actionId,
      action: materializedAction,
      source: event.source,
      streaming: Boolean(event.streaming),
    });
    this.webBuilderStore.chatStore.runAction(data, Boolean(event.streaming));

    if (!event.streaming) {
      this.processedActionKeys.add(processedKey);
    }
  }

  private handleRemovePageActionEvent(event: Extract<PageChangeEvent, { type: 'action' }>, processedKey: string) {
    this.pageContentSnapshots.delete(event.action.pageName);

    const data: ActionCallbackData = {
      messageId: event.messageId,
      artifactId: event.artifactId,
      actionId: event.actionId,
      action: event.action,
    };

    this.webBuilderStore.showWorkbench.set(true);
    this.webBuilderStore.chatStore.setCurrentMessageId(event.messageId);
    this.webBuilderStore.chatStore.addAction(data);

    if (event.source === 'data-upage-block-start') {
      return;
    }

    this.webBuilderStore.chatStore.runAction(data, Boolean(event.streaming));

    if (!event.streaming) {
      this.processedActionKeys.add(processedKey);
    }
  }

  private resolvePageContent(pageName: string) {
    const cached = this.pageContentSnapshots.get(pageName);
    if (cached !== undefined) {
      return cached;
    }

    const editorDocument = this.webBuilderStore.editorStore.editorDocuments.get()[pageName];
    if (editorDocument?.content !== undefined) {
      return editorDocument.content;
    }

    return this.webBuilderStore.pagesStore.getPage(pageName)?.content || '';
  }

  private focusActionTarget(pageName: string, sectionId: string) {
    if (this.webBuilderStore.pagesStore.activePage.get() !== pageName) {
      this.webBuilderStore.pagesStore.setActivePage(pageName);
    }

    if (this.webBuilderStore.pagesStore.activeSection.get() !== sectionId) {
      this.webBuilderStore.pagesStore.setActiveSection(sectionId);
    }

    if (this.webBuilderStore.currentView.get() !== 'code') {
      this.webBuilderStore.currentView.set('code');
    }
  }
}

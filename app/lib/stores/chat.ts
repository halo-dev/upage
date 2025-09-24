import { atom, type MapStore, map, type WritableAtom } from 'nanostores';
import type { ActionAlert } from '~/types/actions';
import { createSampler } from '~/utils/sampler';
import { unreachable } from '~/utils/unreachable';
import { editorBridge } from '../bridge';
import { ActionRunner } from '../runtime/action-runner';
import type { ActionCallbackData, ArtifactCallbackData } from '../runtime/message-parser';
import type { PagesStore } from './pages';
import type { WebBuilderStore } from './web-builder';

export interface ArtifactState {
  id: string;
  name: string;
  title: string;
  type?: string;
  closed: boolean;
  runner: ActionRunner;
}

export type ArtifactUpdateState = Pick<ArtifactState, 'title' | 'closed'>;

type Artifacts = MapStore<Record<string, ArtifactState>>;

export class ChatStore {
  private globalExecutionQueue = Promise.resolve();
  private reloadedMessages = new Set<string>();

  // 当前消息 id
  currentMessageId: WritableAtom<string | undefined> =
    import.meta.hot?.data.currentMessageId ?? atom<string | undefined>(undefined);
  currentDescription: WritableAtom<string | undefined> =
    import.meta.hot?.data.currentDescription ?? atom<string | undefined>(undefined);

  artifacts: Artifacts = import.meta.hot?.data.artifacts ?? map({});
  artifactIdList: string[] = [];
  actionAlert: WritableAtom<ActionAlert | undefined> =
    import.meta.hot?.data.actionAlert ?? atom<ActionAlert | undefined>(undefined);

  // 添加对webBuilderStore和pagesStore的引用
  readonly webBuilderStore: WebBuilderStore;
  readonly pagesStore: PagesStore;

  constructor(webBuilderStore: WebBuilderStore, pagesStore: PagesStore) {
    this.webBuilderStore = webBuilderStore;
    this.pagesStore = pagesStore;

    if (import.meta.hot) {
      import.meta.hot.data.artifacts = this.artifacts;
      import.meta.hot.data.actionAlert = this.actionAlert;
      import.meta.hot.data.currentDescription = this.currentDescription;
    }

    this.setupCoordination();
  }

  private setupCoordination() {
    this.artifacts.listen(() => {
      this.currentDescription.set(this.firstArtifact?.title || '未命名页面');
    });
  }

  get firstArtifact(): ArtifactState | undefined {
    return this.getArtifact(this.artifactIdList[0]);
  }

  get description() {
    return this.currentDescription;
  }

  get alert() {
    return this.actionAlert;
  }

  clearAlert() {
    this.actionAlert.set(undefined);
  }

  abortAllActions() {
    // TODO: what do we wanna do and how do we wanna recover from this?
    const artifacts = this.artifacts.get();

    Object.values(artifacts).forEach((artifact) => {
      const actions = artifact.runner.actions.get();

      Object.values(actions).forEach((action) => {
        if (action.status === 'running' || action.status === 'pending') {
          action.abort();
        }
      });
    });
  }

  addArtifact({ messageId, name, title, id }: ArtifactCallbackData) {
    const artifact = this.getArtifact(messageId);
    if (artifact) {
      return;
    }

    if (!this.artifactIdList.includes(messageId)) {
      this.artifactIdList.push(messageId);
    }

    this.artifacts.setKey(messageId, {
      id,
      name,
      title,
      closed: false,
      runner: new ActionRunner(editorBridge, { id, name, title }, (alert) => {
        if (this.reloadedMessages.has(messageId)) {
          return;
        }

        this.actionAlert.set(alert);
      }),
    });
  }

  updateArtifact({ messageId }: ArtifactCallbackData, state: Partial<ArtifactUpdateState>) {
    const artifact = this.getArtifact(messageId);
    if (!artifact) {
      return;
    }

    this.artifacts.setKey(messageId, { ...artifact, ...state });
  }

  private getArtifact(id: string) {
    const artifacts = this.artifacts.get();
    return artifacts[id];
  }

  setReloadedMessages(messages: string[]) {
    this.reloadedMessages = new Set(messages);
  }

  addAction(data: ActionCallbackData) {
    this._addAction(data);
  }

  private async _addAction(data: ActionCallbackData) {
    const { messageId } = data;
    const artifact = this.getArtifact(messageId);

    if (!artifact) {
      unreachable('Artifact not found');
    }

    return artifact.runner.addAction(data);
  }

  runAction(data: ActionCallbackData, isStreaming: boolean = false) {
    if (isStreaming) {
      this.actionStreamSampler(data, isStreaming);
    } else {
      this.addToExecutionQueue(() => this._runAction(data, isStreaming));
    }
  }

  async _runAction(data: ActionCallbackData, isRunning: boolean = false) {
    const { messageId } = data;

    const artifact = this.getArtifact(messageId);
    if (!artifact) {
      unreachable('Artifact not found');
    }

    const action = artifact.runner.actions.get()[data.actionId];
    if (!action || action.executed) {
      return;
    }

    const { pageName, id } = data.action;

    if (this.pagesStore.activeSection.get() !== id) {
      this.pagesStore.setActiveSection(id);
    }

    if (this.pagesStore.activePage.get() !== pageName) {
      this.pagesStore.setActivePage(pageName);
    }

    if (this.webBuilderStore.currentView.get() !== 'code') {
      this.webBuilderStore.currentView.set('code');
    }

    const actionId = data.action.id;
    const section = this.pagesStore.sections.get()[actionId];
    if (!section) {
      await artifact.runner.runAction(data, isRunning);
    }

    this.pagesStore.updateSection(actionId, data.action.content);

    if (!isRunning) {
      await artifact.runner.runAction(data);
      this.pagesStore.resetPageModifications();
    }
  }

  actionStreamSampler = createSampler(async (data: ActionCallbackData, isStreaming: boolean = false) => {
    return await this._runAction(data, isStreaming);
  }, 100); // TODO: remove this magic number to have it configurable

  addToExecutionQueue(callback: () => Promise<void>) {
    this.globalExecutionQueue = this.globalExecutionQueue.then(() => callback());
  }

  setCurrentMessageId(id: string | undefined) {
    this.currentMessageId.set(id);
  }
}

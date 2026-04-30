import { atom, type MapStore, map, type WritableAtom } from 'nanostores';
import { editorBridge } from '~/.client/bridge';
import { ActionRunner } from '~/.client/runtime/action-runner';
import type { ActionCallbackData, ArtifactCallbackData } from '~/.client/runtime/message-parser';
import type { PagesStore } from '~/.client/stores/pages';
import type { WebBuilderStore } from '~/.client/stores/web-builder';
import { createSampler } from '~/.client/utils/sampler';
import { unreachable } from '~/.client/utils/unreachable';
import type { ActionAlert } from '~/types/actions';

export interface ArtifactState {
  id: string;
  name: string;
  title: string;
  type?: string;
  closed: boolean;
  runner: ActionRunner;
}

export type ArtifactUpdateState = Pick<ArtifactState, 'title' | 'closed'>;
type ArtifactsById = Map<string, ArtifactState>;
// messageId -> ArtifactsById
type ArtifactsByMessageId = Map<string, ArtifactsById>;
type Artifacts = MapStore<ArtifactsByMessageId>;

export class ChatStore {
  private globalExecutionQueue = Promise.resolve();
  private executionQueueVersion = 0;
  private reloadedMessages = new Set<string>();

  // 当前消息 id
  currentMessageId: WritableAtom<string | undefined> =
    import.meta.hot?.data?.currentMessageId ?? atom<string | undefined>(undefined);
  currentDescription: WritableAtom<string | undefined> =
    import.meta.hot?.data?.currentDescription ?? atom<string | undefined>(undefined);

  artifacts: Artifacts = import.meta.hot?.data?.artifacts ?? map(new Map());
  artifactIdList: { messageId: string; artifactId: string }[] = [];
  actionAlert: WritableAtom<ActionAlert | undefined> =
    import.meta.hot?.data?.actionAlert ?? atom<ActionAlert | undefined>(undefined);

  // 添加对webBuilderStore和pagesStore的引用
  readonly webBuilderStore: WebBuilderStore;
  readonly pagesStore: PagesStore;

  constructor(webBuilderStore: WebBuilderStore, pagesStore: PagesStore) {
    this.webBuilderStore = webBuilderStore;
    this.pagesStore = pagesStore;

    if (import.meta.hot && import.meta.hot.data) {
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
    if (this.artifactIdList.length === 0) {
      return undefined;
    }

    const { messageId, artifactId } = this.artifactIdList[0];
    return this.getArtifact(messageId, artifactId);
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
    this.executionQueueVersion += 1;
    const artifacts = this.artifacts.get();

    artifacts.values().forEach((artifactByPageNames) => {
      artifactByPageNames.values().forEach((artifact) => {
        const actions = artifact.runner.actions.get();
        Object.values(actions).forEach((action) => {
          if (action.status === 'running' || action.status === 'pending') {
            action.abort();
          }
        });
      });
    });
  }

  async addArtifact({ messageId, name, title, id }: ArtifactCallbackData) {
    const artifact = this.getArtifact(messageId, id);
    if (artifact) {
      return;
    }

    if (!this.artifactIdList.some((item) => item.messageId === messageId && item.artifactId === id)) {
      this.artifactIdList.push({ messageId, artifactId: id });
    }
    const newArtifact = {
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
    };

    const artifactsByMessageId = this.artifacts.get();
    const existingArtifactsById = artifactsByMessageId.get(messageId);
    const artifactsById = existingArtifactsById ? new Map(existingArtifactsById) : new Map();

    artifactsById.set(id, newArtifact);

    // create new outer Map instance to trigger nanostores listener
    const newArtifactsByMessageId = new Map(artifactsByMessageId);
    newArtifactsByMessageId.set(messageId, artifactsById);

    this.artifacts.set(newArtifactsByMessageId);
    const bridge = await editorBridge;
    bridge.updatePageAttributes(name, { title });
  }

  updateArtifact({ messageId, id }: ArtifactCallbackData, state: Partial<ArtifactUpdateState>) {
    const artifact = this.getArtifact(messageId, id);
    if (!artifact) {
      return;
    }

    const artifactsByMessageId = this.artifacts.get();
    const existingArtifactsById = artifactsByMessageId.get(messageId);
    if (!existingArtifactsById) {
      return;
    }

    const artifactsById = new Map(existingArtifactsById);
    artifactsById.set(id, { ...artifact, ...state });

    // create new outer Map instance to trigger nanostores listener
    const newArtifactsByMessageId = new Map(artifactsByMessageId);
    newArtifactsByMessageId.set(messageId, artifactsById);

    this.artifacts.set(newArtifactsByMessageId);
  }

  private getArtifact(messageId: string, artifactId: string) {
    const artifacts = this.artifacts.get();
    const artifactsById = artifacts.get(messageId);
    if (!artifactsById) {
      return undefined;
    }

    return artifactsById.get(artifactId);
  }

  private getArtifactByArtifactId(messageId: string, artifactId: string) {
    return this.getArtifact(messageId, artifactId);
  }

  setReloadedMessages(messages: string[]) {
    this.reloadedMessages = new Set(messages);
  }

  pruneArtifacts(messageIds: string[]) {
    const validMessageIds = new Set(messageIds);
    const currentArtifacts = this.artifacts.get();
    const nextArtifacts = new Map(
      [...currentArtifacts.entries()].filter(([messageId]) => {
        return validMessageIds.has(messageId);
      }),
    );

    this.artifactIdList = this.artifactIdList.filter((item) => validMessageIds.has(item.messageId));
    this.artifacts.set(nextArtifacts);

    if (this.currentMessageId.get() && !validMessageIds.has(this.currentMessageId.get()!)) {
      this.currentMessageId.set(undefined);
    }
  }

  addAction(data: ActionCallbackData) {
    this._addAction(data);
  }

  private async _addAction(data: ActionCallbackData) {
    const { messageId, artifactId } = data;
    const artifact = this.getArtifactByArtifactId(messageId, artifactId);

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
    const { messageId, artifactId } = data;

    const artifact = this.getArtifactByArtifactId(messageId, artifactId);
    if (!artifact) {
      unreachable('Artifact not found');
    }

    const action = artifact.runner.actions.get()[data.actionId];
    if (!action || action.executed) {
      return;
    }

    if (!isRunning) {
      await artifact.runner.runAction(data);
      this.pagesStore.resetPageModifications();
      return;
    }

    await artifact.runner.runAction(data, true);
  }

  actionStreamSampler = createSampler(async (data: ActionCallbackData, isStreaming: boolean = false) => {
    return await this._runAction(data, isStreaming);
  }, 100); // TODO: remove this magic number to have it configurable

  addToExecutionQueue(callback: () => Promise<void>) {
    const queueVersion = this.executionQueueVersion;
    this.globalExecutionQueue = this.globalExecutionQueue.then(() => {
      if (queueVersion !== this.executionQueueVersion) {
        return;
      }

      return callback();
    });
  }

  setCurrentMessageId(id: string | undefined) {
    this.currentMessageId.set(id);
  }

  async waitForAllActionsSettled() {
    const runners = Array.from(this.artifacts.get().values()).flatMap((artifactsById) => {
      return Array.from(artifactsById.values()).map((artifact) => artifact.runner);
    });

    await Promise.all(runners.map((runner) => runner.waitForIdle()));
  }
}

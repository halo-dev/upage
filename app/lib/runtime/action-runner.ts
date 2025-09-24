import { atom, type MapStore, map } from 'nanostores';
import type { EditorBridge } from '~/lib/bridge';
import type { ActionAlert, UPageAction } from '~/types/actions';
import { isValidContent } from '~/utils/html-parse';
import { createScopedLogger } from '~/utils/logger';
import { unreachable } from '~/utils/unreachable';
import type { ActionCallbackData } from './message-parser';

export type ActionPage = {
  id: string;
  name: string;
  title: string;
};

const logger = createScopedLogger('ActionRunner');

export type ActionStatus = 'pending' | 'running' | 'complete' | 'aborted' | 'failed';

export type BaseActionState = UPageAction & {
  status: Exclude<ActionStatus, 'failed'>;
  abort: () => void;
  executed: boolean;
  abortSignal: AbortSignal;
};

export type FailedActionState = UPageAction &
  Omit<BaseActionState, 'status'> & {
    status: Extract<ActionStatus, 'failed'>;
    error: string;
  };

export type ActionState = BaseActionState | FailedActionState;

type BaseActionUpdate = Partial<Pick<BaseActionState, 'status' | 'abort' | 'executed'>>;

export type ActionStateUpdate =
  | BaseActionUpdate
  | (Omit<BaseActionUpdate, 'status'> & { status: 'failed'; error: string });

type ActionsMap = MapStore<Record<string, ActionState>>;

class ActionCommandError extends Error {
  readonly _output: string;
  readonly _header: string;

  constructor(message: string, output: string) {
    // Create a formatted message that includes both the error message and output
    const formattedMessage = `Failed To Execute Shell Command: ${message}\n\nOutput:\n${output}`;
    super(formattedMessage);

    // Set the output separately so it can be accessed programmatically
    this._header = message;
    this._output = output;

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, ActionCommandError.prototype);

    // Set the name of the error for better debugging
    this.name = 'ActionCommandError';
  }

  // Optional: Add a method to get just the terminal output
  get output() {
    return this._output;
  }
  get header() {
    return this._header;
  }
}

export class ActionRunner {
  #editorBridge: Promise<EditorBridge>;
  #currentExecutionPromise: Promise<void> = Promise.resolve();
  #page: ActionPage;

  runnerId = atom<string>(`${Date.now()}`);
  actions: ActionsMap = map({});
  onAlert?: (alert: ActionAlert) => void;
  buildOutput?: { path: string; exitCode: number; output: string };

  constructor(editorBridgePromise: Promise<EditorBridge>, page: ActionPage, onAlert?: (alert: ActionAlert) => void) {
    this.#editorBridge = editorBridgePromise;

    this.onAlert = onAlert;
    this.#page = page;
  }

  addAction(data: ActionCallbackData) {
    const { actionId } = data;

    const actions = this.actions.get();
    const action = actions[actionId];

    if (action) {
      // action already added
      return;
    }

    const abortController = new AbortController();
    this.actions.setKey(actionId, {
      ...data.action,
      status: 'pending',
      executed: false,
      abort: () => {
        abortController.abort();
        this.#updateAction(actionId, { status: 'aborted' });
      },
      abortSignal: abortController.signal,
    });

    this.#currentExecutionPromise.then(() => {
      this.#updateAction(actionId, { status: 'running' });
    });
  }

  async runAction(data: ActionCallbackData, isRunning: boolean = false) {
    const { actionId } = data;
    const action = this.actions.get()[actionId];

    if (!action) {
      unreachable(`Action ${actionId} not found`);
    }

    if (action.executed) {
      return;
    }

    this.#updateAction(actionId, { ...action, ...data.action, executed: !isRunning });

    this.#currentExecutionPromise = this.#currentExecutionPromise
      .then(() => {
        return this.#executeAction(actionId, isRunning);
      })
      .catch((error) => {
        console.error('Action failed:', error);
      });

    await this.#currentExecutionPromise;

    return;
  }

  async #executeAction(actionId: string, isRunning: boolean = false) {
    let action = this.actions.get()[actionId];

    this.#updateAction(actionId, { status: 'running' });
    const newAction = this.updateSectionRootDomId(actionId, action);
    if (newAction) {
      action = newAction;
    }
    try {
      await this.runPageAction(action);
      this.#updateAction(actionId, {
        status: isRunning ? 'running' : action.abortSignal.aborted ? 'aborted' : 'complete',
      });
    } catch (error) {
      if (action.abortSignal.aborted) {
        return;
      }

      this.#updateAction(actionId, { status: 'failed', error: 'Action failed' });
      logger.error(`Action failed\n\n`, error);

      if (!(error instanceof ActionCommandError)) {
        return;
      }

      this.onAlert?.({
        type: 'error',
        title: 'Dev Server Failed',
        description: error.header,
        content: error.output,
      });

      // re-throw the error to be caught in the promise chain
      throw error;
    }
  }

  async #runPageSectionAction(action: ActionState) {
    const editorBridge = await this.#editorBridge;
    try {
      await editorBridge.updateSection(action);
      logger.debug(`Page Section written ${action.pageName}`);
    } catch (error) {
      logger.error('Failed to write page section\n\n', error);
    }
  }

  async runPageAction(action: ActionState) {
    const editorBridge = await this.#editorBridge;
    try {
      // 新增或更新 Pages
      await editorBridge.upsertPageAction(action.pageName, this.#page.title, action.id);
      logger.debug(`Page written ${action.pageName}`);
    } catch (error) {
      logger.error('Failed to write page\n\n', error);
    }

    this.#runPageSectionAction(action);
  }

  private updateSectionRootDomId(actionId: string, action: ActionState) {
    if (action.validRootDomId) {
      return;
    }
    if (action.action === 'remove') {
      this.actions.setKey(action.id, { ...action, rootDomId: action.domId, validRootDomId: true });
      return this.actions.get()[actionId];
    }
    const content = action.content;
    const isValid = isValidContent(content);
    if (!isValid) {
      return;
    }
    const div = document.createElement('div');
    div.innerHTML = content;
    const rootDomId = div.firstElementChild?.id;
    if (!rootDomId) {
      return;
    }
    const oldRootDomId = action.rootDomId;
    if (oldRootDomId && oldRootDomId === rootDomId) {
      this.actions.setKey(actionId, { ...action, validRootDomId: true });
    } else {
      this.actions.setKey(actionId, { ...action, rootDomId });
    }
    return this.actions.get()[actionId];
  }

  #updateAction(id: string, newState: ActionStateUpdate) {
    const actions = this.actions.get();
    const actionState = actions[id];

    this.actions.setKey(id, { ...actionState, ...newState });
  }
}

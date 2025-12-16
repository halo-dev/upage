import { createScopedLogger } from '~/.client/utils/logger';
import { unreachable } from '~/.client/utils/unreachable';
import type { UPageAction, UPageActionData } from '~/types/actions';
import type { UPageArtifactData } from '~/types/artifact';

const ARTIFACT_TAG_OPEN = '<uPageArtifact';
const ARTIFACT_TAG_CLOSE = '</uPageArtifact>';
const ARTIFACT_ACTION_TAG_OPEN = '<uPageAction';
const ARTIFACT_ACTION_TAG_CLOSE = '</uPageAction>';

const logger = createScopedLogger('MessageParser');

export interface ArtifactCallbackData extends UPageArtifactData {
  messageId: string;
}

export interface ActionCallbackData {
  artifactId: string;
  messageId: string;
  actionId: string;
  action: UPageAction;
}

export type ArtifactCallback = (data: ArtifactCallbackData) => void;
export type ActionCallback = (data: ActionCallbackData) => void;

export interface ParserCallbacks {
  onArtifactOpen?: ArtifactCallback;
  onArtifactClose?: ArtifactCallback;
  onActionOpen?: ActionCallback;
  onActionStream?: ActionCallback;
  onActionClose?: ActionCallback;
}

interface ElementFactoryProps {
  messageId: string;
  pageName: string;
}

type ElementFactory = (props: ElementFactoryProps) => string;

export interface StreamingMessageParserOptions {
  callbacks?: ParserCallbacks;
  artifactElement?: ElementFactory;
}

interface MessageState {
  position: number;
  insideArtifact: boolean;
  insideAction: boolean;
  currentArtifact?: UPageArtifactData;
  currentAction: UPageActionData;
  actionId: number;
}

export class StreamingMessageParser {
  #messages = new Map<string, MessageState>();

  constructor(private _options: StreamingMessageParserOptions = {}) {}

  parse(messageId: string, input: string) {
    let state = this.#messages.get(messageId);

    if (!state) {
      state = {
        position: 0,
        insideAction: false,
        insideArtifact: false,
        currentAction: { content: '' },
        actionId: 0,
      };

      this.#messages.set(messageId, state);
    }

    let output = '';
    let i = state.position;
    let earlyBreak = false;

    while (i < input.length) {
      if (state.insideArtifact) {
        const currentArtifact = state.currentArtifact;

        if (currentArtifact === undefined) {
          unreachable('Artifact not initialized');
        }

        if (state.insideAction) {
          const closeIndex = input.indexOf(ARTIFACT_ACTION_TAG_CLOSE, i);

          const currentAction = state.currentAction;

          if (closeIndex !== -1) {
            currentAction.content += input.slice(i, closeIndex);

            currentAction.content = currentAction.content.trim();

            this._options.callbacks?.onActionClose?.({
              artifactId: currentArtifact.id,
              messageId,

              /**
               * We decrement the id because it's been incremented already
               * when `onActionOpen` was emitted to make sure the ids are
               * the same.
               */
              actionId: String(state.actionId - 1),

              action: currentAction as UPageAction,
            });

            state.insideAction = false;
            state.currentAction = { content: '' };

            i = closeIndex + ARTIFACT_ACTION_TAG_CLOSE.length;
          } else {
            const content = input.slice(i);
            this._options.callbacks?.onActionStream?.({
              artifactId: currentArtifact.id,
              messageId,
              actionId: String(state.actionId - 1),
              action: {
                ...(currentAction as UPageAction),
                content,
              },
            });

            break;
          }
        } else {
          const actionOpenIndex = input.indexOf(ARTIFACT_ACTION_TAG_OPEN, i);
          const artifactCloseIndex = input.indexOf(ARTIFACT_TAG_CLOSE, i);

          if (actionOpenIndex !== -1 && (artifactCloseIndex === -1 || actionOpenIndex < artifactCloseIndex)) {
            const actionEndIndex = input.indexOf('>', actionOpenIndex);

            if (actionEndIndex !== -1) {
              state.insideAction = true;

              state.currentAction = this.#parseActionTag(input, actionOpenIndex, actionEndIndex);

              this._options.callbacks?.onActionOpen?.({
                artifactId: currentArtifact.id,
                messageId,
                actionId: String(state.actionId++),
                action: state.currentAction as UPageAction,
              });

              i = actionEndIndex + 1;
            } else {
              break;
            }
          } else if (artifactCloseIndex !== -1) {
            this._options.callbacks?.onArtifactClose?.({ messageId, ...currentArtifact });

            state.insideArtifact = false;
            state.currentArtifact = undefined;

            i = artifactCloseIndex + ARTIFACT_TAG_CLOSE.length;
          } else {
            break;
          }
        }
      } else if (input[i] === '<' && input[i + 1] !== '/') {
        let j = i;
        let potentialTag = '';

        while (j < input.length && potentialTag.length < ARTIFACT_TAG_OPEN.length) {
          potentialTag += input[j];

          if (potentialTag === ARTIFACT_TAG_OPEN) {
            const nextChar = input[j + 1];

            if (nextChar && nextChar !== '>' && nextChar !== ' ') {
              output += input.slice(i, j + 1);
              i = j + 1;
              break;
            }

            const openTagEnd = input.indexOf('>', j);

            if (openTagEnd !== -1) {
              const artifactTag = input.slice(i, openTagEnd + 1);

              const artifactId = this.#extractAttribute(artifactTag, 'id') as string;
              const artifactName = this.#extractAttribute(artifactTag, 'name') as string;
              const artifactTitle = this.#extractAttribute(artifactTag, 'title') as string;

              if (!artifactId || !artifactName) {
                logger.warn('Artifact id 或者 name 未指定');
              }

              if (!artifactTitle) {
                logger.warn('Artifact title 未指定');
              }

              state.insideArtifact = true;

              const currentArtifact = {
                id: artifactId,
                name: artifactName,
                title: artifactTitle,
              } satisfies UPageArtifactData;

              state.currentArtifact = currentArtifact;

              this._options.callbacks?.onArtifactOpen?.({ messageId, ...currentArtifact });

              const artifactFactory = this._options.artifactElement ?? createArtifactElement;

              output += artifactFactory({ messageId, pageName: artifactName });

              i = openTagEnd + 1;
            } else {
              earlyBreak = true;
            }

            break;
          } else if (!ARTIFACT_TAG_OPEN.startsWith(potentialTag)) {
            output += input.slice(i, j + 1);
            i = j + 1;
            break;
          }

          j++;
        }

        if (j === input.length && ARTIFACT_TAG_OPEN.startsWith(potentialTag)) {
          break;
        }
      } else {
        output += input[i];
        i++;
      }

      if (earlyBreak) {
        break;
      }
    }

    state.position = i;

    return output;
  }

  reset() {
    this.#messages.clear();
  }

  #parseActionTag(input: string, actionOpenIndex: number, actionEndIndex: number) {
    const actionTag = input.slice(actionOpenIndex, actionEndIndex + 1);

    const actionAttributes: UPageAction = {
      id: '',
      pageName: '',
      action: 'add',
      domId: '',
      content: '',
      rootDomId: '',
      validRootDomId: false,
    };

    const id = this.#extractAttribute(actionTag, 'id') as string;
    if (!id) {
      logger.warn('页面 id 未指定');
      throw new Error('Page id not specified');
    }

    const pageName = this.#extractAttribute(actionTag, 'pageName') as string;
    if (!pageName) {
      logger.warn('页面名称未指定');
    }

    const action = this.#extractAttribute(actionTag, 'action') as UPageAction['action'];
    if (!action) {
      logger.warn('Action 未指定');
    }

    if (!['add', 'remove', 'update'].includes(action)) {
      logger.warn(`无效的 action: ${action}`);
      throw new Error(`Invalid action: ${action}`);
    }

    const domId = this.#extractAttribute(actionTag, 'domId') as string;
    if (!domId) {
      logger.warn('domId 未指定');
    }

    const rootDomId = this.#extractAttribute(actionTag, 'rootDomId') as string;
    if (!rootDomId) {
      logger.warn('rootDomId 未指定');
    } else {
      actionAttributes.validRootDomId = true;
    }

    const sort = this.#extractAttribute(actionTag, 'sort');

    actionAttributes.id = id;
    actionAttributes.pageName = pageName;
    actionAttributes.action = action;
    actionAttributes.domId = domId;
    actionAttributes.rootDomId = rootDomId;
    actionAttributes.sort = sort ? parseInt(sort) : undefined;
    return actionAttributes;
  }

  #extractAttribute(tag: string, attributeName: string): string | undefined {
    const match = tag.match(new RegExp(`${attributeName}="([^"]*)"`, 'i'));
    return match ? match[1] : undefined;
  }
}

const createArtifactElement: ElementFactory = (props) => {
  const elementProps = [
    'class="__uPageArtifact__"',
    ...Object.entries(props).map(([key, value]) => {
      return `data-${camelToDashCase(key)}=${JSON.stringify(value)}`;
    }),
  ];

  return `<div ${elementProps.join(' ')}></div>`;
};

function camelToDashCase(input: string) {
  return input.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

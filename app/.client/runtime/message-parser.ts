import { createScopedLogger } from '~/.client/utils/logger';
import { unreachable } from '~/.client/utils/unreachable';
import type { UPageAction, UPageActionData } from '~/types/actions';
import type { UPageArtifactData } from '~/types/artifact';
import {
  LEGACY_ACTION_TAG_CLOSE as ARTIFACT_ACTION_TAG_CLOSE,
  LEGACY_ACTION_TAG_OPEN as ARTIFACT_ACTION_TAG_OPEN,
  LEGACY_ARTIFACT_TAG_CLOSE as ARTIFACT_TAG_CLOSE,
  LEGACY_ARTIFACT_TAG_OPEN as ARTIFACT_TAG_OPEN,
  parseLegacyActionTag,
  parseLegacyArtifactTag,
} from '~/utils/upage-legacy';

const ARTIFACT_TAG_OPEN_LOWER = ARTIFACT_TAG_OPEN.toLowerCase();
const ARTIFACT_TAG_CLOSE_LOWER = ARTIFACT_TAG_CLOSE.toLowerCase();
const ARTIFACT_ACTION_TAG_OPEN_LOWER = ARTIFACT_ACTION_TAG_OPEN.toLowerCase();
const ARTIFACT_ACTION_TAG_CLOSE_LOWER = ARTIFACT_ACTION_TAG_CLOSE.toLowerCase();

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
  artifactId: string;
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

    // 生成一次小写版本，用于所有标签的大小写不敏感搜索
    const inputLower = input.toLowerCase();

    while (i < input.length) {
      if (state.insideArtifact) {
        const currentArtifact = state.currentArtifact;

        if (currentArtifact === undefined) {
          unreachable('Artifact not initialized');
        }

        if (state.insideAction) {
          const closeIndex = inputLower.indexOf(ARTIFACT_ACTION_TAG_CLOSE_LOWER, i);

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
          const actionOpenIndex = inputLower.indexOf(ARTIFACT_ACTION_TAG_OPEN_LOWER, i);
          const artifactCloseIndex = inputLower.indexOf(ARTIFACT_TAG_CLOSE_LOWER, i);

          if (actionOpenIndex !== -1 && (artifactCloseIndex === -1 || actionOpenIndex < artifactCloseIndex)) {
            const actionEndIndex = input.indexOf('>', actionOpenIndex);

            if (actionEndIndex !== -1) {
              const parsedAction = this.#parseActionTag(input, actionOpenIndex, actionEndIndex);
              if (!parsedAction) {
                i = actionEndIndex + 1;
                continue;
              }

              state.insideAction = true;
              state.currentAction = parsedAction;

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

        while (j < input.length && potentialTag.length < ARTIFACT_TAG_OPEN_LOWER.length) {
          potentialTag += inputLower[j];

          if (potentialTag === ARTIFACT_TAG_OPEN_LOWER) {
            const nextChar = input[j + 1];

            if (nextChar && nextChar !== '>' && nextChar !== ' ') {
              output += input.slice(i, j + 1);
              i = j + 1;
              break;
            }

            const openTagEnd = input.indexOf('>', j);

            if (openTagEnd !== -1) {
              const artifactTag = input.slice(i, openTagEnd + 1);
              const artifact = parseLegacyArtifactTag(artifactTag);

              if (!artifact.id || !artifact.name) {
                logger.warn('Artifact id 或者 name 未指定');
              }

              if (!artifact.title) {
                logger.warn('Artifact title 未指定');
              }

              state.insideArtifact = true;
              state.currentArtifact = artifact;

              this._options.callbacks?.onArtifactOpen?.({ messageId, ...artifact });

              const artifactFactory = this._options.artifactElement ?? createArtifactElement;

              output += artifactFactory({ artifactId: artifact.id, messageId, pageName: artifact.name });

              i = openTagEnd + 1;
            } else {
              earlyBreak = true;
            }

            break;
          } else if (!ARTIFACT_TAG_OPEN_LOWER.startsWith(potentialTag)) {
            output += input.slice(i, j + 1);
            i = j + 1;
            break;
          }

          j++;
        }

        if (j === input.length && ARTIFACT_TAG_OPEN_LOWER.startsWith(potentialTag)) {
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

  #parseActionTag(input: string, actionOpenIndex: number, actionEndIndex: number, fallbackActionId: number = 0) {
    const actionTag = input.slice(actionOpenIndex, actionEndIndex + 1);
    const action = parseLegacyActionTag(actionTag, '');
    if (!action) {
      logger.warn('页面 id 未指定');
      return undefined;
    }

    if (!action.pageName) {
      logger.warn('页面名称未指定');
    }

    if (!action.domId) {
      logger.warn('domId 未指定');
    }

    if (!action.rootDomId) {
      logger.warn('rootDomId 未指定');
    }

    return action;
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

import type { UPageAction } from '~/types/actions';
import type { ChatUIMessage } from '~/types/message';
import {
  getCompletedUpageToolPartPages,
  getUpageToolPartInputPages,
  getUpageToolPartOutputPages,
  isUpageToolPart,
} from '~/utils/message-parts';
import type { PageChangeEvent, PageChangeSource } from './types';

export function normalizeStructuredPageEvents(message: Pick<ChatUIMessage, 'id' | 'parts'>): PageChangeEvent[] {
  const events: PageChangeEvent[] = [];

  for (const part of message.parts || []) {
    if (part.type === 'data-upage-block-start') {
      if (!isValidArtifact(part.data.artifact) || !isValidAction(part.data.action)) {
        continue;
      }

      events.push(
        {
          type: 'artifact-open',
          messageId: message.id,
          artifact: part.data.artifact,
          source: 'data-upage-block-start',
        },
        {
          type: 'action',
          messageId: message.id,
          artifactId: part.data.artifact.id,
          actionId: part.data.action.id,
          action: part.data.action,
          source: 'data-upage-block-start',
          streaming: true,
        },
      );
      continue;
    }

    if (part.type === 'data-upage-page') {
      events.push(...pagePartToEvents(message.id, part.data, 'data-upage-page', false));
      continue;
    }

    if (!isUpageToolPart(part)) {
      continue;
    }

    if (part.state === 'input-streaming' || part.state === 'input-available') {
      events.push(
        ...getUpageToolPartInputPages(part).flatMap((pagePart) =>
          pagePartToEvents(message.id, pagePart, 'tool-upage-input', true),
        ),
      );
      continue;
    }

    if (part.state === 'output-available') {
      events.push(
        ...getCompletedUpageToolPartPages(part).flatMap((pagePart) =>
          pagePartToEvents(message.id, pagePart, 'tool-upage-output', false),
        ),
      );
    }
  }

  return events;
}

function pagePartToEvents(
  messageId: string,
  pagePart:
    | ReturnType<typeof getUpageToolPartInputPages>[number]
    | ReturnType<typeof getUpageToolPartOutputPages>[number]
    | Extract<ChatUIMessage['parts'][number], { type: 'data-upage-page' }>['data'],
  source: PageChangeSource,
  streaming: boolean,
) {
  const artifact = pagePart.artifact;
  const validActions = pagePart.actions.filter(isValidAction);

  if (!isValidArtifact(artifact) || validActions.length === 0) {
    return [];
  }

  return [
    {
      type: 'artifact-open',
      messageId,
      artifact,
      source,
    } satisfies PageChangeEvent,
    ...validActions.map((action) => {
      return {
        type: 'action',
        messageId,
        artifactId: artifact.id,
        actionId: action.id,
        action,
        source,
        streaming,
      } satisfies PageChangeEvent;
    }),
    ...(streaming
      ? []
      : [
          {
            type: 'artifact-close',
            messageId,
            artifact,
            source,
          } satisfies PageChangeEvent,
        ]),
  ];
}

function isValidArtifact(
  artifact: ChatUIMessage['parts'][number] extends never ? never : { id?: string; name?: string; title?: string },
) {
  return (
    typeof artifact?.id === 'string' &&
    artifact.id.trim().length > 0 &&
    typeof artifact.name === 'string' &&
    artifact.name.trim().length > 0 &&
    typeof artifact.title === 'string' &&
    artifact.title.trim().length > 0
  );
}

function isValidAction(action: UPageAction) {
  return (
    typeof action.id === 'string' &&
    action.id.trim().length > 0 &&
    typeof action.pageName === 'string' &&
    action.pageName.trim().length > 0
  );
}

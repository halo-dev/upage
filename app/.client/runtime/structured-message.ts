import type { ActionCallbackData, ArtifactCallbackData } from '~/.client/runtime/message-parser';
import type { ChatUIMessage, UPagePagePart } from '~/types/message';
import { extractStructuredPageParts } from '~/utils/message-parts';

export function getStructuredPageParts(message: Pick<ChatUIMessage, 'parts'>): UPagePagePart[] {
  return extractStructuredPageParts(message);
}

export function replayStructuredPageParts(
  message: Pick<ChatUIMessage, 'id' | 'parts'>,
  callbacks: {
    onArtifactOpen?: (data: ArtifactCallbackData) => void;
    onArtifactClose?: (data: ArtifactCallbackData) => void;
    onAction?: (data: ActionCallbackData) => void;
  },
) {
  const pageParts = getStructuredPageParts(message);

  for (const pagePart of pageParts) {
    const artifactData: ArtifactCallbackData = {
      messageId: message.id,
      ...pagePart.artifact,
    };

    callbacks.onArtifactOpen?.(artifactData);

    for (const action of pagePart.actions) {
      callbacks.onAction?.({
        artifactId: pagePart.artifact.id,
        messageId: message.id,
        actionId: action.id,
        action,
      });
    }

    callbacks.onArtifactClose?.(artifactData);
  }
}

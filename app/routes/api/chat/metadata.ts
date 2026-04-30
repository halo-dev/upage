import type { ChatMetadata } from '~/types/chat';

export function resolveChatMetadataForRequest({
  chatMetadata,
  clientDesignMd,
  designMdRemoved,
}: {
  chatMetadata: ChatMetadata | null;
  clientDesignMd?: string;
  designMdRemoved?: boolean;
}) {
  const nextMetadata: ChatMetadata = {
    ...(chatMetadata ?? {}),
    sessionType: 'agent-page-builder',
  };

  if (designMdRemoved) {
    nextMetadata.designMd = '';
  } else if (clientDesignMd) {
    nextMetadata.designMd = clientDesignMd;
  }

  const shouldUpdate =
    chatMetadata?.sessionType !== 'agent-page-builder' ||
    (designMdRemoved
      ? Boolean(chatMetadata?.designMd)
      : Boolean(clientDesignMd && clientDesignMd !== chatMetadata?.designMd));

  return {
    nextMetadata,
    shouldUpdate,
  };
}

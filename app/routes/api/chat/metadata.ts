import type { ChatMetadata, TemplateReference } from '~/types/chat';

export function resolveChatMetadataForRequest({
  chatMetadata,
  clientDesignMd,
  designMdRemoved,
  clientTemplateReference,
}: {
  chatMetadata: ChatMetadata | null;
  clientDesignMd?: string;
  designMdRemoved?: boolean;
  clientTemplateReference?: TemplateReference;
}) {
  const templateReferenceChanged =
    clientTemplateReference !== undefined &&
    !isTemplateReferenceEqual(clientTemplateReference, chatMetadata?.templateReference);
  const nextMetadata: ChatMetadata = {
    ...(chatMetadata ?? {}),
    sessionType: 'agent-page-builder',
  };

  if (designMdRemoved) {
    nextMetadata.designMd = '';
  } else if (templateReferenceChanged && !clientDesignMd) {
    nextMetadata.designMd = '';
  } else if (clientDesignMd) {
    nextMetadata.designMd = clientDesignMd;
  }

  if (clientTemplateReference) {
    nextMetadata.templateReference = clientTemplateReference;
  }

  const shouldUpdate =
    chatMetadata?.sessionType !== 'agent-page-builder' ||
    (designMdRemoved
      ? Boolean(chatMetadata?.designMd)
      : templateReferenceChanged
        ? Boolean(chatMetadata?.designMd) || Boolean(clientDesignMd !== chatMetadata?.designMd)
        : Boolean(clientDesignMd && clientDesignMd !== chatMetadata?.designMd)) ||
    Boolean(templateReferenceChanged);

  return {
    nextMetadata,
    shouldUpdate,
  };
}

function isTemplateReferenceEqual(nextValue?: TemplateReference, currentValue?: TemplateReference) {
  return JSON.stringify(nextValue ?? null) === JSON.stringify(currentValue ?? null);
}

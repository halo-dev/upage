import type { FileUIPart } from 'ai';
import { MODEL_REGEX, PROVIDER_REGEX } from '~/.client/utils/constants';
import type { UPageUIMessage } from '~/types/message';
import { ElementEditPreview } from './ElementEditPreview';
import { Markdown } from './Markdown';

export function UserMessage({ message }: { message: UPageUIMessage }) {
  const parts = message.parts || [];
  const textContent = stripMetadata(parts.find((part) => part.type === 'text')?.text || '');
  const images = parts.filter((part) => part.type === 'file' && part.mediaType.startsWith('image')) as FileUIPart[];
  const elementInfo = message.metadata?.elementInfo;

  return (
    <div className="overflow-hidden pt-2">
      <div className="flex flex-col gap-3">
        {textContent && <Markdown html>{textContent}</Markdown>}
        {images.map((item, index) => (
          <img
            key={index}
            src={item.url}
            alt={item.filename || `Image ${index + 1}`}
            className="max-w-full h-auto rounded-lg"
            style={{ maxHeight: '512px', objectFit: 'contain' }}
          />
        ))}

        {elementInfo && <ElementEditPreview elementEditInfo={elementInfo} className="mt-3" />}
      </div>
    </div>
  );
}

function stripMetadata(content: string) {
  const artifactRegex = /<uPageArtifact\s+[^>]*>[\s\S]*?<\/uPageArtifact>/gm;
  return content.replace(MODEL_REGEX, '').replace(PROVIDER_REGEX, '').replace(artifactRegex, '');
}

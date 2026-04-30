import type { FileUIPart } from 'ai';
import { MODEL_REGEX, PROVIDER_REGEX } from '~/.client/utils/constants';
import type { ChatUIMessage } from '~/types/message';
import { ElementEditPreview } from './ElementEditPreview';
import { Markdown } from './Markdown';
import markdownStyles from './Markdown.module.scss';

export function UserMessage({ message }: { message: ChatUIMessage }) {
  const parts = message.parts || [];
  const textContent = stripMetadata(parts.find((part) => part.type === 'text')?.text || '');
  const images = parts.filter((part) => part.type === 'file' && part.mediaType.startsWith('image')) as FileUIPart[];
  const elementInfo = message.metadata?.elementInfo;

  return (
    <div className="overflow-hidden">
      <div className="flex flex-col gap-3">
        {textContent && <Markdown className={markdownStyles.UserBody}>{textContent}</Markdown>}
        {images.map((item, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-2xl border border-upage-elements-borderColor/60 bg-upage-elements-background shadow-sm"
          >
            <img
              src={item.url}
              alt={item.filename || `Image ${index + 1}`}
              className="max-w-full h-auto"
              style={{ maxHeight: '512px', objectFit: 'contain' }}
            />
          </div>
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

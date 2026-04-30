import type { Section } from '~/types/actions';
import type { ChatUIMessage, SummaryAnnotation, UserPageSnapshot } from '~/types/message';
import type { SectionMap } from '~/types/pages';
import { stripIndents } from '~/utils/strip-indent';

type UserMessageContentOptions = {
  includeVisualHint?: boolean;
  visualSummary?: string;
};

type UserImagePart = Extract<ChatUIMessage['parts'][number], { type: 'file' }>;

export function getUserImageParts(message: Pick<ChatUIMessage, 'parts'>): UserImagePart[] {
  return (message.parts || []).filter(
    (part): part is UserImagePart =>
      part.type === 'file' && typeof part.mediaType === 'string' && part.mediaType.startsWith('image/') && !!part.url,
  );
}

export function hasUserImageParts(message: Pick<ChatUIMessage, 'parts'>) {
  return getUserImageParts(message).length > 0;
}

export function createVisualHintText(message: Pick<ChatUIMessage, 'parts'>) {
  const imageParts = getUserImageParts(message);
  if (imageParts.length === 0) {
    return '';
  }

  const filenames = imageParts.map((part) => part.filename).filter(Boolean);
  return `用户提供了 ${imageParts.length} 张图片视觉参考${filenames.length > 0 ? `（${filenames.join('、')}）` : ''}。`;
}

export function getUserMessageContent(
  message: Omit<ChatUIMessage, 'id'>,
  options: UserMessageContentOptions = {},
): string {
  if (message.role !== 'user') {
    throw new Error('Message is not a user message');
  }

  const textContent = (message.parts || [])
    .map((part) => {
      if (part.type === 'text') {
        return part.text;
      }
      return '';
    })
    .join('\n')
    .trim();

  const segments = [textContent];

  if (options.includeVisualHint) {
    const visualHint = createVisualHintText(message);
    if (visualHint) {
      segments.push(visualHint);
    }
  }

  if (options.visualSummary) {
    segments.push(`视觉摘要：\n${options.visualSummary}`);
  }

  return segments.filter(Boolean).join('\n\n').trim();
}

export function createVisionAnalysisMessage(message: Omit<ChatUIMessage, 'id'>, instruction: string): ChatUIMessage {
  const imageParts = getUserImageParts(message);
  const textParts = (message.parts || []).filter(
    (part): part is Extract<ChatUIMessage['parts'][number], { type: 'text' }> => part.type === 'text',
  );

  return {
    id: 'vision-analysis',
    role: 'user',
    metadata: {},
    parts: [
      ...imageParts,
      ...textParts,
      {
        type: 'text',
        text: instruction,
      },
    ],
  };
}

export function simplifyUPageActions(input: string): string {
  // Using regex to match uPageAction tags that have type="page"
  const regex = /(<uPageAction[^>]*type="page"[^>]*>)([\s\S]*?)(<\/uPageAction>)/g;

  // Replace each matching occurrence
  return input.replace(regex, (_0, openingTag, _2, closingTag) => {
    return `${openingTag}\n          ...\n        ${closingTag}`;
  });
}

export function getSectionByPageName(sections: SectionMap) {
  return Object.values(sections).reduce(
    (acc, section) => {
      if (section) {
        const pageName = section.pageName;
        acc[pageName] = [...(acc[pageName] || []), section];
      }
      return acc;
    },
    {} as Record<string, Section[]>,
  );
}

export function extractCurrentContext(messages: ChatUIMessage[]) {
  const lastAssistantMessage = messages.filter((x) => x.role == 'assistant').slice(-1)[0];

  if (!lastAssistantMessage) {
    return { summary: undefined };
  }

  let summary: SummaryAnnotation | undefined;

  if (!lastAssistantMessage.parts?.length) {
    return { summary: undefined };
  }

  const parts = lastAssistantMessage.parts;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.type === 'data-summary') {
      summary = part.data;
      break;
    }
  }

  return { summary };
}

export function extractMessageTextForPrompt(message: Pick<ChatUIMessage, 'parts'>): string {
  return (message.parts || [])
    .map((part) => {
      if (part.type === 'text') {
        return part.text;
      }

      if (part.type === 'reasoning') {
        return part.text;
      }

      return '';
    })
    .filter(Boolean)
    .join('\n')
    .trim();
}

export function appendVisualSummary(text: string, visualSummary?: string) {
  if (!visualSummary) {
    return text.trim();
  }

  return `${text.trim()}\n\n视觉摘要：\n${visualSummary}`.trim();
}

export function createUserPageSnapshotContext(snapshot?: UserPageSnapshot) {
  if (!snapshot || snapshot.pages.length === 0) {
    return '';
  }

  return snapshot.pages
    .map((page) => {
      const pageActions = snapshot.actions.filter((action) => action.pageName === page.name);
      return stripIndents`
        ---
        页面名称: ${page.name}
        页面标题: ${page.title}
        页面主体内容:
        ${page.content}

        关联区块:
        ${
          pageActions.length > 0
            ? pageActions
                .map((action) => {
                  return stripIndents`
                    - 区块 ID: ${action.id}
                    - 操作类型: ${action.action}
                    - domId: ${action.domId}
                    - rootDomId: ${action.rootDomId}
                    - 排序: ${action.sort ?? 0}
                    - 内容:
                    ${action.content || '(删除操作，无内容)'}
                  `;
                })
                .join('\n')
            : '- 无额外区块变更'
        }
        ---
      `;
    })
    .join('\n');
}

import type { Section } from '~/types/actions';
import type { SummaryAnnotation, UPageUIMessage } from '~/types/message';
import type { PageMap, SectionMap } from '~/types/pages';

export function getUserMessageContent(message: Omit<UPageUIMessage, 'id'>): string {
  if (message.role !== 'user') {
    throw new Error('Message is not a user message');
  }

  return (message.parts || [])
    .map((part) => {
      if (part.type === 'text') {
        return part.text;
      }
      return '';
    })
    .join('\n');
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

export function createPagesContext(pages: PageMap, sections: SectionMap) {
  const pagePaths = Object.keys(pages);
  const sectionGroupByPageName = Object.values(sections).reduce(
    (acc, section) => {
      if (section) {
        const pageName = section.pageName;
        if (pagePaths.includes(pageName)) {
          acc[section.pageName] = [...(acc[section.pageName] || []), section];
        }
      }
      return acc;
    },
    {} as Record<string, Section[]>,
  );

  const pageContexts = Object.entries(sectionGroupByPageName).map(([pageName, sections]) => {
    return `<uPageAction id="${pageName}" title="Code Content">${sections
      .map((section) => {
        return `<uPageAction id="${section.domId}" type="page" pageName="${pageName}" action="${section.action}" domId="${section.domId}">${section.content}</uPageAction>`;
      })
      .join('\n')}</uPageAction>`;
  });
  return pageContexts.join('\n');
}

export function extractCurrentContext(messages: UPageUIMessage[]) {
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

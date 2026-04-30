import type { UPageAction, UPageActionType } from '~/types/actions';
import type { UPageArtifactData } from '~/types/artifact';
import type { UPagePagePart } from '~/types/page-builder-tools';

export const LEGACY_ARTIFACT_TAG_OPEN = '<uPageArtifact';
export const LEGACY_ARTIFACT_TAG_CLOSE = '</uPageArtifact>';
export const LEGACY_ACTION_TAG_OPEN = '<uPageAction';
export const LEGACY_ACTION_TAG_CLOSE = '</uPageAction>';

const LEGACY_ARTIFACT_REGEX = /<uPageArtifact\b([^>]*)>([\s\S]*?)<\/uPageArtifact>/g;
const LEGACY_ACTION_REGEX = /<uPageAction\b([^>]*)>([\s\S]*?)<\/uPageAction>/g;

export function extractLegacyTagAttribute(tag: string, attributeName: string): string | undefined {
  const match = tag.match(new RegExp(`${attributeName}="([^"]*)"`, 'i'));
  return match ? match[1] : undefined;
}

export function parseLegacyArtifactTag(tag: string): UPageArtifactData {
  return {
    id: extractLegacyTagAttribute(tag, 'id') ?? '',
    name: extractLegacyTagAttribute(tag, 'name') ?? '',
    title: extractLegacyTagAttribute(tag, 'title') ?? '',
  };
}

export function parseLegacyActionTag(tag: string, content: string): UPageAction | undefined {
  const id = extractLegacyTagAttribute(tag, 'id');
  const action = extractLegacyTagAttribute(tag, 'action');
  if (!id || !isValidLegacyActionType(action)) {
    return undefined;
  }

  const rootDomId = extractLegacyTagAttribute(tag, 'rootDomId') ?? '';
  const sort = extractLegacyTagAttribute(tag, 'sort');

  return {
    id,
    pageName: extractLegacyTagAttribute(tag, 'pageName') ?? '',
    action,
    domId: extractLegacyTagAttribute(tag, 'domId') ?? '',
    content: content.trim(),
    rootDomId,
    validRootDomId: Boolean(rootDomId),
    sort: sort ? Number.parseInt(sort, 10) : undefined,
  };
}

export function parseLegacyAssistantMessage(content: string): {
  text: string;
  pages: UPagePagePart[];
} {
  if (!content.includes(LEGACY_ARTIFACT_TAG_OPEN)) {
    return {
      text: content,
      pages: [],
    };
  }

  const pages: UPagePagePart[] = [];
  let text = '';
  let lastIndex = 0;

  for (const match of content.matchAll(LEGACY_ARTIFACT_REGEX)) {
    const [fullMatch, artifactAttributes = '', artifactBody = ''] = match;
    const matchIndex = match.index ?? 0;
    text += content.slice(lastIndex, matchIndex);
    lastIndex = matchIndex + fullMatch.length;

    const artifact = parseLegacyArtifactTag(`${LEGACY_ARTIFACT_TAG_OPEN}${artifactAttributes}>`);
    if (!artifact.id || !artifact.name) {
      continue;
    }

    const actions = [...artifactBody.matchAll(LEGACY_ACTION_REGEX)]
      .map((actionMatch) => {
        const [, actionAttributes = '', actionBody = ''] = actionMatch;
        return parseLegacyActionTag(`${LEGACY_ACTION_TAG_OPEN}${actionAttributes}>`, actionBody);
      })
      .filter((action): action is UPageAction => action !== undefined);

    pages.push({
      artifact,
      actions,
    });
  }

  text += content.slice(lastIndex);

  return {
    text,
    pages,
  };
}

function isValidLegacyActionType(value: string | undefined): value is UPageActionType {
  return value === 'add' || value === 'remove' || value === 'update';
}

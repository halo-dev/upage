import type { MapStore } from 'nanostores';
import type { UserPageSnapshot } from '~/types/message';
import type { PageData, SectionMap } from '~/types/pages';

export const pagesToSnapshot = (
  pages: { [pageName: string]: Omit<PageData, 'messageId'> },
  sections: MapStore<SectionMap>,
): UserPageSnapshot => {
  const sectionState = sections.get();
  const snapshotPages: UserPageSnapshot['pages'] = [];
  for (const pageName of Object.keys(pages)) {
    const page = pages[pageName];
    if (!page || !isValidPageName(page.name)) {
      continue;
    }

    snapshotPages.push({
      id: page.id,
      name: page.name,
      title: page.title,
      content: page.content,
      actionIds: page.actionIds,
      headMeta: page.headMeta,
      headLinks: page.headLinks,
      headScripts: page.headScripts,
      headStyles: page.headStyles,
      headRaw: page.headRaw,
      sort: page.sort,
    });
  }

  const snapshotActions: UserPageSnapshot['actions'] = snapshotPages.flatMap((page) => {
    return page.actionIds
      .map((actionId) => {
        const section = sectionState[actionId];
        if (!section) {
          return undefined;
        }

        return {
          id: section.id,
          action: section.action,
          pageName: section.pageName,
          content: section.content,
          domId: section.domId,
          rootDomId: section.rootDomId,
          sort: section.sort,
          validRootDomId: section.validRootDomId ?? false,
        };
      })
      .filter((action): action is NonNullable<typeof action> => action !== undefined);
  });

  return {
    pages: snapshotPages,
    actions: snapshotActions,
  };
};

function isValidPageName(pageName: string | undefined | null) {
  return typeof pageName === 'string' && pageName.trim().length > 0;
}

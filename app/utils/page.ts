import type { MapStore } from 'nanostores';
import type { SectionMap } from '~/lib/stores/pages';
import type { Page } from '~/types/actions';

export const pagesToArtifacts = (pages: { [pageName: string]: Page }, sections: MapStore<SectionMap>): string => {
  return Object.keys(pages)
    .map((pageName) => {
      const page = pages[pageName];
      const sectionId = page.actionIds;

      if (sectionId.length === 0) {
        return '';
      }

      return `
      <uPageArtifact id="${Date.now() + pageName}" name="${pageName}" title="${page.title}">
        ${sectionId.map((sectionId) => {
          const section = sections.get()[sectionId];

          if (section == null) {
            return '';
          }

          return `
          <uPageAction id="${Date.now()}" pageName="${pageName}" action="${section.action}" domId="${section.domId}" sort="${section.sort}">
            ${section.content}
          </uPageAction>
          `;
        })}
      </uPageArtifact>
      `;
    })
    .filter(Boolean)
    .join('\n');
};

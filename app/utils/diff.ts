import { createPatch } from 'diff';
import type { PageMap, SectionMap } from '~/lib/stores/pages';
import type { Section } from '~/types/actions';

interface ModifiedSection {
  type: 'diff' | 'section';
  content: string;
}

type SectionModifications = Record<string, ModifiedSection>;

export function computeSectionModifications(sections: SectionMap, modifiedSections: Map<string, Section>) {
  const modifications: SectionModifications = {};

  let hasModifiedPages = false;

  for (const [sectionId, oldSection] of modifiedSections) {
    const section = sections[sectionId];
    if (!section) {
      continue;
    }

    const originalContent = oldSection.content;
    const unifiedDiff = diffPages(sectionId, originalContent, section.content);

    if (!unifiedDiff) {
      // files are identical
      continue;
    }

    hasModifiedPages = true;

    if (unifiedDiff.length > section.content.length) {
      // if there are lots of changes we simply grab the current file content since it's smaller than the diff
      modifications[sectionId] = { type: 'section', content: section.content };
    } else {
      // otherwise we use the diff since it's smaller
      modifications[sectionId] = { type: 'diff', content: unifiedDiff };
    }
  }

  if (!hasModifiedPages) {
    return undefined;
  }

  return modifications;
}

interface ModifiedPage {
  type: 'diff' | 'page';
  content: string;
}

type PageModifications = Record<string, ModifiedPage>;

export function computePageModifications(pages: PageMap, modifiedFiles: Map<string, string>) {
  const modifications: PageModifications = {};

  let hasModifiedPages = false;

  for (const [filePath, originalContent] of modifiedFiles) {
    const page = pages[filePath];

    if (!page) {
      continue;
    }

    if (!page.content) {
      continue;
    }

    const unifiedDiff = diffPages(filePath, originalContent, page.content);

    if (!unifiedDiff) {
      // files are identical
      continue;
    }

    hasModifiedPages = true;

    if (unifiedDiff.length > page.content.length) {
      // if there are lots of changes we simply grab the current file content since it's smaller than the diff
      modifications[filePath] = { type: 'page', content: page.content };
    } else {
      // otherwise we use the diff since it's smaller
      modifications[filePath] = { type: 'diff', content: unifiedDiff };
    }
  }

  if (!hasModifiedPages) {
    return undefined;
  }

  return modifications;
}

/**
 * Computes a diff in the unified format. The only difference is that the header is omitted
 * because it will always assume that you're comparing two versions of the same file and
 * it allows us to avoid the extra characters we send back to the llm.
 *
 * @see https://www.gnu.org/software/diffutils/manual/html_node/Unified-Format.html
 */
export function diffPages(pageName: string, oldFileContent: string, newFileContent: string) {
  const unifiedDiff = createPatch(pageName, oldFileContent, newFileContent);

  if (unifiedDiff === '') {
    return undefined;
  }

  return unifiedDiff;
}

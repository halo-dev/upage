import type { Page, Section } from '~/types/actions';

export type PageSection = Section & {
  validRootDomId?: boolean;
};

export type PageMap = Record<string, Page | undefined>;

export type SectionMap = Record<string, PageSection | undefined>;

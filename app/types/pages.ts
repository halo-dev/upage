import type { Section } from '~/types/actions';

export type PageSection = Section & {
  validRootDomId?: boolean;
};

export type PageMap = Record<string, Omit<PageData, 'messageId'> | undefined>;

export type SectionMap = Record<string, PageSection | undefined>;

/**
 * HTML head meta tag
 */
export interface PageHeadMeta {
  name?: string;
  content?: string;
  charset?: string;
  httpEquiv?: string;
  property?: string; // e.g. og:title, og:description
  [key: string]: string | undefined;
}

/**
 * HTML head link tag
 */
export interface PageHeadLink {
  rel: string;
  href: string;
  type?: string;
  sizes?: string;
  media?: string;
  [key: string]: string | undefined;
}

/**
 * HTML head script tag
 */
export interface PageHeadScript {
  src?: string; // external script
  content?: string; // inline script
  type?: string;
  async?: boolean;
  defer?: boolean;
  [key: string]: string | boolean | undefined;
}

/**
 * HTML head style tag
 */
export interface PageHeadStyle {
  content: string;
  media?: string;
  [key: string]: string | undefined;
}

/**
 * HTML head complete information
 */
export interface PageHead {
  meta?: PageHeadMeta[];
  links?: PageHeadLink[];
  scripts?: PageHeadScript[];
  styles?: PageHeadStyle[];
  // other head content that cannot be structured
  raw?: string[];
}

/**
 * Page asset file metadata (stored in database)
 */
export interface PageAsset {
  // original filename, e.g. "style.css"
  filename: string;
  // storage path, e.g. "assets/{userId}/{messageId}/style.css"
  storagePath: string;
  // access URL, e.g. "/uploads/assets/{userId}/{messageId}/style.css"
  url: string;
  // MIME type, e.g. "text/css", "image/png"
  fileType: string;
  // file size (bytes)
  fileSize: number;
}

/**
 * Frontend temporary resource file (contains file content)
 * Used for frontend temporary storage and transmission, not stored in database
 */
export interface AssetFile {
  // filename
  filename: string;
  // file content (text or binary)
  content: string | ArrayBuffer;
  // MIME type
  fileType: string;
  // file size (bytes)
  fileSize: number;
  // whether it is editable (only text files)
  editable?: boolean;
}

/**
 * New page data structure (corresponding to database Page table)
 * Corresponds to Prisma Page model
 */
export interface PageData {
  // page ID, if not exists, generate a random ID, if exists, use the incoming ID
  id: string;
  // associated action ID array
  actionIds: string[];
  // associated message ID
  messageId: string;
  // page name (e.g. "index", "about")
  name: string;
  // page title
  title: string;
  // page body content (HTML)
  content: string;
  // head meta tag
  headMeta?: PageHeadMeta[];
  // head link tag
  headLinks?: PageHeadLink[];
  // head script tag
  headScripts?: PageHeadScript[];
  // head style tag
  headStyles?: PageHeadStyle[];
  // head other raw content
  headRaw?: string;
  // page sort
  sort?: number;
  // created time (optional)
  createdAt?: Date;
  // updated time (optional)
  updatedAt?: Date;
}

/**
 * Page asset data (corresponding to database PageAsset table)
 */
export interface PageAssetData {
  // asset ID (optional, not needed when creating)
  id?: string;
  // associated page ID (optional, not exists when creating)
  pageId?: string;
  // filename
  filename: string;
  // storage path
  storagePath: string;
  // access URL
  url: string;
  // file MIME type
  fileType: string;
  // file size (bytes)
  fileSize: number;
  // sort
  sort?: number;
  // created time (optional)
  createdAt?: Date;
  // updated time (optional)
  updatedAt?: Date;
}

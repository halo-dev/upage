import { storageProvider } from '~/.server/storage/index.server';
import { createScopedLogger } from '~/.server/utils/logger';
import type { ChatUIMessage } from '~/types/message';

const logger = createScopedLogger('chat-file-reference');

type FilePart = Extract<ChatUIMessage['parts'][number], { type: 'file' }>;

function getChatReferenceDirPath(userId: string, messageId: string) {
  return `chat-references/${userId}/${messageId}`;
}

function getChatReferenceStoragePath(userId: string, messageId: string, filename: string) {
  return `${getChatReferenceDirPath(userId, messageId)}/${normalizeStorageRelativePath(filename)}`;
}

function getChatReferenceUrl(storagePath: string) {
  return `/uploads/${storagePath}`;
}

function isDataUrl(url: string) {
  return url.startsWith('data:');
}

function isLocalUploadUrl(url: string) {
  return url.startsWith('/uploads/');
}

function extractStoragePathFromUploadUrl(url: string) {
  return normalizeStorageRelativePath(url.replace(/^\/uploads\//, ''));
}

function normalizeStorageRelativePath(value: string) {
  const segments = value
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment && segment !== '.' && segment !== '..');

  return segments.join('/');
}

function assertOwnedChatReferencePath(userId: string, storagePath: string) {
  const normalizedStoragePath = normalizeStorageRelativePath(storagePath);
  const userPrefix = `${getChatReferenceDirPath(userId, '')}`.replace(/\/$/, '');
  if (!normalizedStoragePath.startsWith(`${userPrefix}/`)) {
    throw new Error('无权访问当前聊天附件');
  }

  return normalizedStoragePath;
}

function shouldUseAbsoluteUrl(request: Request) {
  const hostname = new URL(request.url).hostname;
  return !['localhost', '127.0.0.1', '0.0.0.0'].includes(hostname);
}

export async function normalizeMessageFileReferences({
  userId,
  messageId,
  message,
}: {
  userId: string;
  messageId: string;
  message: ChatUIMessage;
}): Promise<ChatUIMessage> {
  const parts = await Promise.all(
    (message.parts || []).map(async (part) => {
      if (part.type !== 'file' || !part.url) {
        return part;
      }

      if (isLocalUploadUrl(part.url)) {
        assertOwnedChatReferencePath(userId, extractStoragePathFromUploadUrl(part.url));
        return part;
      }

      if (!isDataUrl(part.url)) {
        return part;
      }

      const uploaded = await storageProvider.uploadFile({
        dirs: getChatReferenceDirPath(userId, messageId),
        contentType: part.mediaType || 'application/octet-stream',
        filename: part.filename || 'reference.bin',
        data: part.url,
      });

      const storagePath = getChatReferenceStoragePath(userId, messageId, uploaded.filename);
      const stableUrl = getChatReferenceUrl(storagePath);
      logger.debug('已将聊天附件替换为稳定引用', { messageId, filename: uploaded.filename });

      return {
        ...part,
        url: stableUrl,
      } satisfies FilePart;
    }),
  );

  return {
    ...message,
    parts,
  };
}

export async function materializeMessageFileReferencesForModel({
  request,
  userId,
  message,
  supportsImageUrl,
  supportsBase64Image,
}: {
  request: Request;
  userId?: string;
  message: ChatUIMessage;
  supportsImageUrl: boolean;
  supportsBase64Image: boolean;
}): Promise<ChatUIMessage> {
  const parts = await Promise.all(
    (message.parts || []).map(async (part) => {
      if (part.type !== 'file' || !part.url || isDataUrl(part.url)) {
        return part;
      }

      if (!isLocalUploadUrl(part.url)) {
        return part;
      }

      const extractedStoragePath = extractStoragePathFromUploadUrl(part.url);
      const storagePath = userId ? assertOwnedChatReferencePath(userId, extractedStoragePath) : extractedStoragePath;

      if (supportsImageUrl && shouldUseAbsoluteUrl(request)) {
        return {
          ...part,
          url: new URL(getChatReferenceUrl(storagePath), request.url).toString(),
        } satisfies FilePart;
      }

      if (supportsBase64Image) {
        const content = await storageProvider.getFileContent(storagePath);
        return {
          ...part,
          url: `data:${part.mediaType || 'application/octet-stream'};base64,${content.toString('base64')}`,
        } satisfies FilePart;
      }

      return part;
    }),
  );

  return {
    ...message,
    parts,
  };
}

export async function materializeMessagesFileReferencesForModel({
  request,
  userId,
  messages,
  supportsImageUrl,
  supportsBase64Image,
}: {
  request: Request;
  userId: string;
  messages: ChatUIMessage[];
  supportsImageUrl: boolean;
  supportsBase64Image: boolean;
}) {
  return await Promise.all(
    messages.map((message) =>
      materializeMessageFileReferencesForModel({
        request,
        userId,
        message,
        supportsImageUrl,
        supportsBase64Image,
      }),
    ),
  );
}

export async function materializeMessagesFileReferencesForAgent({
  request,
  userId,
  messages,
}: {
  request: Request;
  userId: string;
  messages: ChatUIMessage[];
}) {
  return await materializeMessagesFileReferencesForModel({
    request,
    userId,
    messages,
    supportsImageUrl: false,
    supportsBase64Image: true,
  });
}

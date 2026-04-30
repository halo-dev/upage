import type { FileUIPart } from 'ai';
import type { MapStore } from 'nanostores';
import { pagesToSnapshot } from '~/.client/utils/page';
import type { PreparationStageAnnotation, ProgressAnnotation, UserPageSnapshot } from '~/types/message';
import type { PageData, SectionMap } from '~/types/pages';

export function isAbortLikeError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

export function getActiveRewindTo({
  rewindTo,
  lastStableMessageId,
}: {
  rewindTo: string | null;
  lastStableMessageId?: string;
}) {
  if (rewindTo === null) {
    return null;
  }

  return lastStableMessageId || rewindTo;
}

export function mapPreparationStageToProgress(stage: PreparationStageAnnotation): ProgressAnnotation {
  return {
    label: stage.label,
    status: mapPreparationStageStatus(stage.status),
    order: stage.order,
    message: stage.message,
  };
}

export function getRequestPhase(status: string) {
  if (status === 'submitted') {
    return 'submitted';
  }

  if (status === 'streaming') {
    return 'streaming';
  }

  return 'idle';
}

export function getDefinedPages(pages: Record<string, Omit<PageData, 'messageId'> | undefined>) {
  const entries = Object.entries(pages).filter(([, page]) => page !== undefined);
  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries) as Record<string, Omit<PageData, 'messageId'>>;
}

export function createInitialProgressAnnotation(): ProgressAnnotation {
  return {
    label: '请求已提交',
    status: 'in-progress',
    order: 0,
    message: '请求已提交，正在建立响应流...',
  };
}

export function createStoppedProgressMessage(
  progressAnnotations: ProgressAnnotation[],
  message: string,
): ProgressAnnotation | undefined {
  const lastProgressMessage = progressAnnotations[progressAnnotations.length - 1];
  if (!lastProgressMessage) {
    return undefined;
  }

  return {
    type: 'progress',
    label: lastProgressMessage.label,
    status: 'stopped',
    order: lastProgressMessage.order + 1,
    message,
  } as ProgressAnnotation;
}

export function buildNextRewindSearchParams(searchParams: URLSearchParams, messageId: string) {
  if (!searchParams.has('rewindTo')) {
    return null;
  }

  const nextSearchParams = new URLSearchParams(searchParams);
  nextSearchParams.set('rewindTo', messageId);
  return nextSearchParams;
}

export function buildPageSnapshotForRequest({
  rewindTo,
  allPages,
  modifiedPages,
  sections,
}: {
  rewindTo: string | null;
  allPages: Record<string, Omit<PageData, 'messageId'> | undefined>;
  modifiedPages: Record<string, Omit<PageData, 'messageId'>> | undefined;
  sections: MapStore<SectionMap>;
}): UserPageSnapshot | undefined {
  const snapshotPages = rewindTo !== null ? getDefinedPages(allPages) : modifiedPages;
  return snapshotPages !== undefined ? pagesToSnapshot(snapshotPages, sections) : undefined;
}

export async function filesToFileUIParts(files: File[]) {
  return Promise.all(
    files.map(async (file) => {
      const data = await fileToBase64(file);

      return {
        type: 'file',
        filename: file.name,
        mediaType: file.type,
        url: data,
      } satisfies FileUIPart;
    }),
  );
}

function mapPreparationStageStatus(stageStatus: PreparationStageAnnotation['status']): ProgressAnnotation['status'] {
  if (stageStatus === 'complete') {
    return 'complete';
  }

  if (stageStatus === 'warning' || stageStatus === 'skipped') {
    return 'warning';
  }

  if (stageStatus === 'failed') {
    return 'stopped';
  }

  return 'in-progress';
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

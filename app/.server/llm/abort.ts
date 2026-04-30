export function createAbortError() {
  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
}

export function isAbortError(error: unknown, abortSignal?: AbortSignal) {
  if (abortSignal?.aborted) {
    return true;
  }

  if (error instanceof Error) {
    return error.name === 'AbortError';
  }

  return false;
}

export function throwIfAborted(abortSignal?: AbortSignal) {
  if (abortSignal?.aborted) {
    throw createAbortError();
  }
}

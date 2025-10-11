/**
 * Creates a function that samples calls at regular intervals and captures trailing calls.
 * - Drops calls that occur between sampling intervals
 * - Takes one call per sampling interval if available
 * - Captures the last call if no call was made during the interval
 *
 * @param fn The function to sample
 * @param sampleInterval How often to sample calls (in ms)
 * @returns The sampled function
 */
export function createSampler<T extends (...args: any[]) => any>(fn: T, sampleInterval: number): T {
  let lastArgs: Parameters<T> | null = null;
  let lastTime = 0;
  let timeout: NodeJS.Timeout | null = null;

  // Create a function with the same type as the input function
  const sampled = function (this: any, ...args: Parameters<T>) {
    const now = Date.now();
    lastArgs = args;

    // If we're within the sample interval, just store the args
    if (now - lastTime < sampleInterval) {
      // Set up trailing call if not already set
      if (!timeout) {
        timeout = setTimeout(
          () => {
            timeout = null;
            lastTime = Date.now();

            if (lastArgs) {
              fn.apply(this, lastArgs);
              lastArgs = null;
            }
          },
          sampleInterval - (now - lastTime),
        );
      }

      return undefined as unknown as ReturnType<T>;
    }

    // If we're outside the interval, execute immediately
    lastTime = now;
    const result = fn.apply(this, args);
    lastArgs = null;
    return result;
  } as unknown as T;

  return sampled;
}

/**
 * 创建一个采样异步函数，在指定的时间间隔内只执行一次，并捕获尾随调用。
 * - 在采样间隔内的调用会被丢弃，但会保存最后一次调用的参数
 * - 每个采样间隔只执行一次调用
 * - 如果在间隔内没有调用，则捕获最后一次调用
 * - 始终返回一个 Promise
 * - 添加了执行状态管理，防止在高负载情况下连续多次执行
 *
 * @param fn 要采样的异步函数
 * @param sampleInterval 采样间隔（毫秒）
 * @param options 配置选项
 * @returns 采样后的异步函数
 */
export function createAsyncSampler<T extends (...args: any[]) => Promise<any>>(fn: T, sampleInterval: number): T {
  // 初始化状态变量，确保有合理的默认值
  const now = Date.now();
  let lastArgs: Parameters<T> | null = null;
  let timeout: NodeJS.Timeout | null = null;
  let lastThis: any = null;
  let isExecuting = false; // 执行状态标志
  let nextExecutionTime = now + sampleInterval; // 初始化为当前时间 + 采样间隔
  let pendingPromise: Promise<any> | null = null; // 当前正在执行的 Promise

  // 清除所有定时器
  const clearAllTimeouts = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  // 安全地重置执行状态
  const resetExecutionState = () => {
    isExecuting = false;
    pendingPromise = null;
  };

  // 创建与输入函数类型相同的函数
  const sampled = function (this: any, ...args: Parameters<T>) {
    const now = Date.now();
    lastArgs = args;
    lastThis = this;

    // 检查是否可以执行
    // 1. 当前没有正在执行的任务
    // 2. 当前时间已经超过了下次允许执行的时间
    // 3. 没有待处理的 Promise
    const canExecuteNow = !isExecuting && now >= nextExecutionTime && !pendingPromise;

    if (!canExecuteNow) {
      const waitTime = Math.max(0, nextExecutionTime - now);
      // 清除之前的定时器，确保只有一个定时器在运行
      clearAllTimeouts();

      // 设置新的定时器，延迟执行
      // 使用 Math.max 确保至少等待 100ms，避免过于频繁的检查
      const delayTime = Math.max(100, Math.min(sampleInterval, waitTime));

      timeout = setTimeout(() => {
        const currentTime = Date.now();
        // 再次检查是否可以执行
        if (!isExecuting && currentTime >= nextExecutionTime && !pendingPromise) {
          clearAllTimeouts();
          return executeTask();
        }
      }, delayTime);

      // 返回一个空的 Promise，以支持链式调用
      return Promise.resolve() as any as ReturnType<T>;
    }

    return executeTask();
  };

  async function executeTask(): Promise<void> {
    isExecuting = true;

    try {
      if (!lastArgs) {
        resetExecutionState();
        return Promise.resolve();
      }

      const result = fn.apply(lastThis, lastArgs);
      lastArgs = null;

      pendingPromise = result;

      return result.finally(() => {
        // 更新下一次执行时间
        nextExecutionTime = Date.now() + sampleInterval;
        resetExecutionState();
      });
    } catch (error) {
      // 即使发生错误也更新下一次执行时间
      nextExecutionTime = Date.now() + sampleInterval;
      resetExecutionState();
      return Promise.reject(error);
    }
  }

  return sampled as unknown as T;
}

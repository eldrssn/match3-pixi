import { warmAssetUrl, type IWarmAssetUrlOptions } from './warmAssetUrl';

/** Параллелизм прогрева: больше 6 одновременных файлов давит на мобильную сеть. */
export const ASSET_WARM_CONCURRENCY = 6;

export interface IWarmAssetsOptions extends IWarmAssetUrlOptions {
  concurrency?: number;
  /** Гранулярный прогресс батча: [готово, всего]. */
  onProgress?: (done: number, total: number) => void;
}

/**
 * Прогрев батча уникальных URL с ограничением параллелизма.
 *
 * Одиночный сбой (таймаут, 404, offline) батч не роняет - прерывается только
 * родительская отмена, которая пробрасывается наверх.
 */
export const warmAssets = async (
  urls: readonly string[],
  {
    concurrency = ASSET_WARM_CONCURRENCY,
    onProgress,
    signal,
    strategy,
    timeoutMs,
  }: IWarmAssetsOptions = {}
): Promise<void> => {
  const uniqueUrls = [...new Set(urls.filter(Boolean))];

  if (uniqueUrls.length === 0) {
    return;
  }

  signal?.throwIfAborted();

  let done = 0;
  const total = uniqueUrls.length;
  const reportDone = () => {
    done += 1;
    onProgress?.(done, total);
  };

  const queue = [...uniqueUrls];
  const workerCount = Math.min(concurrency, total);
  const worker = async (): Promise<void> => {
    while (queue.length > 0) {
      const url = queue.shift() as string;

      try {
        await warmAssetUrl(url, { signal, strategy, timeoutMs });
      } catch (error) {
        if (signal?.aborted) {
          throw error;
        }
      }

      // Учёт прогресса и по упавшему файлу: бар не должен зависнуть на
      // недостижимом ресурсе.
      reportDone();
    }
  };

  await Promise.all(Array.from({ length: workerCount }, worker));
  signal?.throwIfAborted();
};

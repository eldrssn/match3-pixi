/**
 * Запуск асинхронного игрового сценария из синхронного колбэка рантайма.
 *
 * Шина событий (`core/RuntimeEvents`), обработчики указателя Pixi и тикер
 * не ждут промис и не ловят его ошибку: любое исключение внутри цикла матчей
 * становилось unhandled rejection, а флаг `_isProcessing`, поднятый на входе,
 * оставался поднятым - доска замирала без единого следа в консоли.
 *
 * Поэтому у каждой входной точки есть обёртка: она логирует сбой с именем
 * сценария и отдаёт вызывающему шанс вернуть игру в рабочее состояние
 * (`onFailure` снимает блокировку доски).
 */
export const runGuarded = (
  scope: string,
  run: () => Promise<void>,
  onFailure?: (error: unknown) => void
): void => {
  try {
    void run().catch((error: unknown) => {
      console.error(`[game] ${scope} failed`, error);
      onFailure?.(error);
    });
  } catch (error) {
    // Синхронное исключение до первого `await`: промиса ещё нет, ловить нечем.
    console.error(`[game] ${scope} failed`, error);
    onFailure?.(error);
  }
};

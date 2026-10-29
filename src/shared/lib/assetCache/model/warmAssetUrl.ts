import { preloadImage } from '../../assets';
import { useAssetCacheStore } from './assetCacheStore';
import { isCrossOriginUrl } from './isCrossOriginUrl';

const DEFAULT_WARM_TIMEOUT_MS = 6000;

/**
 * `blob` - скачать файл и держать копию в сторе: он понадобится другому экрану,
 * а HTTP-кэша у статики нет (`Cache-Control: no-store`).
 *
 * `image` - прогреть обычным `<img>` и ничего не запоминать. Так греется то,
 * что уже рисуется на экране этим же `<img>`: blob-копия там означала бы
 * второй сетевой запрос за тем же файлом, потому что `no-store` не даёт
 * браузеру схлопнуть загрузку `<img>` и `fetch`. Записи в сторе такой прогрев
 * не оставляет намеренно - иначе он запретил бы позднейший blob-прогрев того
 * же URL для экрана, где файл действительно переиспользуется.
 */
export type TAssetWarmStrategy = 'blob' | 'image';

export interface IWarmAssetUrlOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  strategy?: TAssetWarmStrategy;
}

interface IPendingWarm {
  promise: Promise<void>;
  controller: AbortController;
  /** Сколько вызывающих ещё ждут этот прогрев; ноль - он больше никому не нужен. */
  waiters: number;
}

/** Single-flight на пару «стратегия + URL»: параллельные вызовы ждут один прогрев. */
const pendingWarms = new Map<string, IPendingWarm>();

/**
 * Прогрев одного ресурса. Ничего не возвращает: результат читается
 * потребителями через `useWarmedAssetUrl`.
 *
 * Судьба ошибки зависит от её вида. Отмена приходит из общего контроллера (см.
 * `joinWarm`) и пробрасывается наверх - батч-прогрев должен уметь прерываться
 * целиком. Таймаут и сетевой сбой конкретного файла прогревом не считаются:
 * ассет помечается `failed`, потребители продолжают жить исходным URL, а
 * повторный вызов не перезапускает заведомо битую загрузку до конца сессии.
 */
const runWarmAssetUrl = async (
  url: string,
  strategy: TAssetWarmStrategy,
  controller: AbortController,
  timeoutMs: number
): Promise<void> => {
  const { setEntry, removeEntry } = useAssetCacheStore.getState();
  const { signal } = controller;

  let didTimeout = false;
  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

  try {
    if (strategy === 'image') {
      try {
        await preloadImage(url, { signal, timeoutMs });
      } catch (error) {
        if (signal.aborted && !didTimeout) {
          throw error;
        }
      }

      return;
    }

    setEntry(url, { status: 'warming', blobUrl: null });

    // Внешние no-CORS картинки: blob недостижим, греем обычным `<img>` - он
    // хотя бы заполняет in-memory кэш браузера внутри текущего документа.
    if (isCrossOriginUrl(url)) {
      await preloadImage(url, { signal, timeoutMs });
      setEntry(url, { status: 'ready', blobUrl: null });
      return;
    }

    try {
      const response = await fetch(url, { signal, credentials: 'same-origin' });

      if (!response.ok) {
        setEntry(url, { status: 'failed', blobUrl: null });
        return;
      }

      const blob = await response.blob();
      setEntry(url, { status: 'ready', blobUrl: URL.createObjectURL(blob) });
    } catch (error) {
      if (didTimeout) {
        setEntry(url, { status: 'failed', blobUrl: null });
        return;
      }

      // Прерванный прогрев не оставляет «вечного warming»: запись исчезает, и
      // следующий вызов может начать заново.
      removeEntry(url);

      if (signal.aborted) {
        throw signal.reason ?? error;
      }

      // Иная сетевая ошибка (offline, DNS): прогрев не обязан проходить любой
      // ценой - потребители работают исходным URL.
      setEntry(url, { status: 'failed', blobUrl: null });
    }
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Присоединение вызывающего к общему прогреву.
 *
 * Его `signal` отменяет только его собственное ожидание; сама загрузка
 * прерывается, лишь когда её перестали ждать все. Иначе дедлайн одного
 * потребителя (клик по табу ждёт прогрев не дольше двух секунд) убивал бы
 * загрузку, которую в тот же момент ждёт другой - и тот молча остался бы без
 * ассета.
 *
 * Вызов без `signal` ждёт до конца и держит прогрев живым за всех.
 */
const joinWarm = (pending: IPendingWarm, signal?: AbortSignal): Promise<void> => {
  pending.waiters += 1;

  if (!signal) {
    return pending.promise;
  }

  return new Promise<void>((resolve, reject) => {
    let isReleased = false;

    const release = () => {
      if (isReleased) {
        return;
      }

      isReleased = true;
      signal.removeEventListener('abort', handleAbort);
      pending.waiters -= 1;

      if (pending.waiters <= 0) {
        pending.controller.abort(signal.reason);
      }
    };

    function handleAbort() {
      release();
      reject(signal?.reason ?? new Error('Asset warm aborted'));
    }

    if (signal.aborted) {
      handleAbort();
      return;
    }

    signal.addEventListener('abort', handleAbort, { once: true });

    pending.promise.then(
      () => {
        release();
        resolve();
      },
      (error: unknown) => {
        release();
        reject(error);
      }
    );
  });
};

export const warmAssetUrl = (url: string, options: IWarmAssetUrlOptions = {}): Promise<void> => {
  const { signal, timeoutMs = DEFAULT_WARM_TIMEOUT_MS, strategy = 'blob' } = options;

  if (!url || url.startsWith('data:')) {
    return Promise.resolve();
  }

  // Отработавший ассет (включая `failed` - попытку уже сделали) повторно не
  // греем. Решение принимает только blob-ветка: `<img>`-прогрев записей не
  // оставляет.
  //
  // Запись `warming` отработавшей не считается: по ней вызывающий ушёл бы с
  // резолвнутым промисом, пока файла ещё нет, - и прогресс батча посчитал бы
  // его готовым, а блокирующий переход не дождался бы. Такой вызов идёт ниже,
  // в общий прогрев, и становится его полноправным ожидающим.
  const entry = useAssetCacheStore.getState().entries[url];
  if (strategy === 'blob' && entry && entry.status !== 'warming') {
    return Promise.resolve();
  }

  const key = `${strategy}:${url}`;
  const running = pendingWarms.get(key);

  if (running) {
    return joinWarm(running, signal);
  }

  const controller = new AbortController();
  const pending: IPendingWarm = {
    controller,
    waiters: 0,
    promise: runWarmAssetUrl(url, strategy, controller, timeoutMs),
  };

  pendingWarms.set(key, pending);
  void pending.promise
    .catch(() => undefined)
    .finally(() => {
      if (pendingWarms.get(key) === pending) {
        pendingWarms.delete(key);
      }
    });

  return joinWarm(pending, signal);
};

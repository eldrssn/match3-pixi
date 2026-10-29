import victoryArtUrl from '@/assets/icons/game/trophy.svg?url';

/**
 * URL-ассеты (растр, шрифты и те SVG, что подставляются в CSS `url()` /
 * `mask-image`) лежат в `public/<type>/` и не проходят через Vite-сборку.
 * Ссылки строятся через BASE_URL, чтобы путь оставался корректным и при
 * деплое на CDN-подпапку (VITE_CDN_BASE_URL).
 *
 * Игровые текстуры и иконки элементов здесь не объявляются: они - часть
 * скина (`entities/skin`, папка `skins/<name>/`) и подключаются Vite-импортом
 * `?url` там же.
 *
 * SVG-иконки, которые рендерятся React-элементом, здесь не объявляются: они
 * лежат в `src/assets/icons/**` и импортируются потребителем напрямую через
 * `*.svg?react` (SVGR). Так иконка красится `currentColor`, не тянет
 * отдельный сетевой запрос и не может разъехаться с BASE_URL.
 *
 * Исключение - арт карточки победы (`gameVictoryArtUrl`): SVG из
 * `src/assets/icons/game`, который нужен как URL для `<img>`. Он проходит
 * через Vite (`*.svg?url`), а экспортируется отсюда, чтобы карточка не знала,
 * откуда арт.
 */

const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, '');

export const publicAsset = (path: string): string => `${BASE_PATH}${path}`;

interface IPreloadImageOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  /**
   * Значение атрибута `crossorigin` у прогреваемой картинки.
   *
   * По умолчанию не ставится. Задавать его нужно там, где ту же картинку
   * потом запрашивает CORS-потребитель (загрузчик рантайма партии): запись кэша от
   * no-cors `<img>` для него непрозрачна и переиспользована не будет.
   */
  crossOrigin?: 'anonymous' | 'use-credentials';
}

const DEFAULT_IMAGE_PRELOAD_TIMEOUT_MS = 6000;

/**
 * Браузерный прогрев картинки для first paint. Ошибка конкретного файла не
 * роняет весь сценарий: компонент всё равно сможет повторить обычную загрузку.
 */
export const preloadImage = (
  url: string,
  { signal, timeoutMs = DEFAULT_IMAGE_PRELOAD_TIMEOUT_MS, crossOrigin }: IPreloadImageOptions = {}
): Promise<boolean> =>
  new Promise((resolve, reject) => {
    if (!url || typeof Image === 'undefined') {
      resolve(false);
      return;
    }

    if (signal?.aborted) {
      reject(signal.reason ?? new Error('Image preload aborted'));
      return;
    }

    const image = new Image();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let isSettled = false;

    const cleanup = () => {
      image.onload = null;
      image.onerror = null;

      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }

      signal?.removeEventListener('abort', abort);
    };

    const settle = (value: boolean) => {
      if (isSettled) {
        return;
      }

      isSettled = true;
      cleanup();
      resolve(value);
    };

    const abort = () => {
      if (isSettled) {
        return;
      }

      isSettled = true;
      cleanup();
      // Снятие обработчиков само по себе загрузку не отменяет - браузер
      // продолжил бы качать файл в фоне. Пустой `src` прерывает запрос.
      image.src = '';
      reject(signal?.reason ?? new Error('Image preload aborted'));
    };

    signal?.addEventListener('abort', abort, { once: true });
    timeoutId = setTimeout(() => settle(false), timeoutMs);

    image.decoding = 'async';

    // Строго до `src`: после присвоения источника смена `crossOrigin` уже не
    // влияет на выполненный запрос.
    if (crossOrigin) {
      image.crossOrigin = crossOrigin;
    }

    image.onload = () => settle(true);
    image.onerror = () => settle(false);
    image.src = url;

    if (image.complete) {
      settle(image.naturalWidth > 0);
    }
  });

interface IPreloadImagesOptions extends IPreloadImageOptions {
  /**
   * Гранулярный ход батча: вызывается после каждого файла, успешного или нет -
   * ошибка файла здесь тоже «файл обработан», иначе доля не дошла бы до 1.
   */
  onProgress?: (done: number, total: number) => void;
}

export const preloadImages = async (
  urls: readonly string[],
  { onProgress, ...options }: IPreloadImagesOptions = {}
): Promise<boolean[]> => {
  const uniqueUrls = [...new Set(urls)];
  const total = uniqueUrls.length;
  let done = 0;

  return Promise.all(
    uniqueUrls.map((url) =>
      preloadImage(url, options).then((isLoaded) => {
        done += 1;
        onProgress?.(done, total);

        return isLoaded;
      })
    )
  );
};

// Арт карточки победы: нейтральный кубок (SVG, `src/assets/icons/game`).
export const gameVictoryArtUrl = victoryArtUrl;

/**
 * Картинки карточки результата партии: только арт победы. Греется на старте
 * партии - к её концу он уже в памяти, а у статики нет HTTP-кэша.
 */
export const PARTY_RESULT_IMAGE_URLS = [gameVictoryArtUrl];

import { Assets, loadTextures, Rectangle, Texture } from 'pixi.js';
import { listSkinTextureFiles } from '@/entities/skin';
import { resolveSheetFrames } from '../lib/sheetFrames';
import type { TextureRegistry } from './TextureRegistry';

/**
 * Сколько битых ключей выписать в консоль. Список нужен для диагностики
 * («отвалился весь CDN» или «нет одного файла»), а не для полного дампа: при
 * недоступном хосте сюда прилетают все загружаемые текстуры.
 */
const REPORTED_FAILED_KEYS_LIMIT = 5;

let isLoaderConfigured = false;

/**
 * Загрузчик картинок Pixi - тем же путём, что и браузерный прогрев
 * (`warmGameAssets`): `<img crossOrigin="anonymous">`.
 *
 * По умолчанию Pixi v8 качает картинки `fetch` в воркере и декодирует
 * `createImageBitmap`. Прогрев до старта партии качает те же файлы через
 * `Image`, и два разных пути запроса не делят кэш: `fetch` не подхватывает
 * ещё летящий img-запрос, а на кросс-origin CDN (`VITE_CDN_BASE_URL`) ответ на
 * no-cors `<img>` для CORS-запроса непрозрачен - прогретые полтора мегабайта
 * скачались бы вторым разом. `crossOrigin: 'anonymous'` - обязательная
 * половина: голый `<img>` с чужого origin GPU в текстуру не пустит
 * (`SecurityError`), и прогрев ставит ровно то же значение.
 *
 * Конфиг у загрузчика глобальный (`Assets` один на приложение), поэтому
 * ставится один раз - до первой загрузки.
 */
export const configureTextureLoader = (): void => {
  if (isLoaderConfigured) {
    return;
  }

  isLoaderConfigured = true;
  loadTextures.config = {
    preferWorkers: false,
    preferCreateImageBitmap: false,
    crossOrigin: 'anonymous',
  };
};

/**
 * Картинка, загруженная тегом `<img>` (см. `configureTextureLoader`), - в
 * `ImageBitmap` до первой отрисовки. WebGPU-рендерер Pixi не заливает
 * `HTMLImageElement` в GPU напрямую: он сам перерисовывает картинку в холст
 * и пишет предупреждение на каждую текстуру. Битмап из уже скачанной картинки
 * сети не трогает и подходит обоим рендерерам; не вышло - остаётся картинка,
 * Pixi справится сам. Источник в кэше `Assets` общий, поэтому перевод - один
 * раз на приложение.
 */
export const toImageBitmap = async (texture: Texture): Promise<void> => {
  const { source } = texture;
  const image = source.resource as unknown;

  if (
    typeof createImageBitmap !== 'function' ||
    typeof HTMLImageElement === 'undefined' ||
    !(image instanceof HTMLImageElement)
  ) {
    return;
  }

  try {
    source.resource = await createImageBitmap(image);
  } catch {
    // Картинка остаётся как есть: её переведёт сам рендерер.
  }
};

/**
 * Спрайт-лист (`frameHeight` в скине) режется на кадры: под ключом листа -
 * первый кадр, все кадры - `TextureRegistry.frames`. Кадры делят источник
 * листа, поэтому лишней памяти GPU не стоят.
 */
const registerSheet = (
  registry: TextureRegistry,
  key: string,
  sheet: Texture,
  { frameWidth, frameHeight }: { frameWidth: number; frameHeight: number }
): void => {
  const frames = resolveSheetFrames(sheet.width, sheet.height, frameWidth, frameHeight).map(
    (rect) =>
      new Texture({
        source: sheet.source,
        frame: new Rectangle(rect.x, rect.y, rect.width, rect.height),
      })
  );

  registry.set(key, frames[0] ?? sheet);
  registry.setFrames(key, frames.length > 0 ? frames : [sheet]);
};

/**
 * Грузит файлы активного скина (`listSkinTextureFiles` - тот же список, что
 * у прогрева) и кладёт их в реестр под ключами скина.
 *
 * Возвращает ключи, которые не загрузились. Файлы грузятся по одному, а не
 * одним `Assets.load([...])`: общий промис падает на первом битом файле и не
 * говорит, сколько их всего, а списку битых ключей место в консоли. Кэш
 * `Assets` - по URL и на всё приложение: следующая партия получает те же
 * текстуры без запроса, а упавший файл из кэша выпадает и будет запрошен
 * заново.
 */
export const loadSkinTextures = async (registry: TextureRegistry): Promise<string[]> => {
  configureTextureLoader();

  const files = listSkinTextureFiles();
  const results = await Promise.allSettled(
    files.map(async ({ url }) => {
      const texture = await Assets.load<Texture>(url);

      await toImageBitmap(texture);

      return texture;
    })
  );
  const failedKeys: string[] = [];

  results.forEach((result, index) => {
    const { key, sheet } = files[index];

    if (result.status === 'fulfilled' && result.value) {
      if (sheet) {
        registerSheet(registry, key, result.value, sheet);
      } else {
        registry.set(key, result.value);
      }
    } else {
      failedKeys.push(key);
    }
  });

  if (failedKeys.length > 0) {
    console.error(
      `[game] не загрузились текстуры (${failedKeys.length}):`,
      failedKeys.slice(0, REPORTED_FAILED_KEYS_LIMIT).join(', ')
    );
  }

  return failedKeys;
};

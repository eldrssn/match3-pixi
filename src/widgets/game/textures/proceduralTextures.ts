import { CanvasSource, Texture } from 'pixi.js';
import { SKIN } from '@/entities/skin';
import type { TextureRegistry } from './TextureRegistry';

/**
 * Нарисованные холсты по ключу - на всё приложение, как файлы скина в кэше
 * `Assets`. Рисунок статичен (скин один на запуск), поэтому рисовать его
 * заново на каждую партию незачем. А гасить с партией нельзя: WebGPU-батчер
 * Pixi держит bind group-ы с источниками текстур в модульном кэше без
 * очистки, и каждая уничтоженная текстура оставалась бы в нём висящей
 * ссылкой (с предупреждением «destroyed while still bound» в консоль).
 */
const drawnTextures = new Map<string, Texture>();

/**
 * Процедурные текстуры активного скина (`entities/skin`, `textures.art`) -
 * рисуются на холсте при первой партии и живут в реестре текстур под теми же
 * ключами, что и загруженные: потребителю всё равно, откуда текстура.
 *
 * Зовёт его `bootGameRuntime` после загрузки файлов. Ключ, который уже занят
 * файлом, пропускается намеренно: так скин переопределяет процедурную
 * текстуру картинкой (`textures.files` под тем же ключом).
 *
 * Текстура - `CanvasSource` без глобального кэша Pixi (`Texture.from` клал
 * бы холст ещё и в `Cache` по ссылке на сам холст).
 */
export const registerProceduralTextures = (
  registry: TextureRegistry,
  art: typeof SKIN.textures.art = SKIN.textures.art
): void => {
  Object.entries(art).forEach(([key, canvasArt]) => {
    if (registry.has(key)) {
      return;
    }

    const drawn = drawnTextures.get(key);

    if (drawn) {
      registry.set(key, drawn);

      return;
    }

    const canvas = document.createElement('canvas');

    canvas.width = canvasArt.width;
    canvas.height = canvasArt.height;

    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    canvasArt.draw(context);

    const texture = new Texture({ source: new CanvasSource({ resource: canvas }) });

    drawnTextures.set(key, texture);
    registry.set(key, texture);
  });
};

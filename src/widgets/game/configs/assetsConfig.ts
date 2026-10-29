import { listSkinTextureFiles } from '@/entities/skin';

/**
 * Загружаемые текстуры - файлы активного скина (`entities/skin`,
 * `textures.files`): кадры фишек, спецфишек и блокеров, а также любая
 * процедурная текстура, которую скин переопределил картинкой.
 *
 * URL приходят из Vite-импорта `?url` в папке скина: база
 * (`VITE_CDN_BASE_URL` -> `base` в `vite.config.ts`) уже подставлена сборкой,
 * и текстуры не уходят мимо CDN-подпапки.
 *
 * Список URL - для браузерного прогрева до старта рантайма (`warmGameAssets`).
 * Загрузчик рантайма (фаза 1, `docs/PLAN.md`) строится той же
 * `listSkinTextureFiles`: второй копии путей быть не должно.
 */
export const getGameAssetImageUrls = (): string[] => listSkinTextureFiles().map(({ url }) => url);

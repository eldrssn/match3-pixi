import { SKIN } from '@/entities/skin';
import { warmFontFaces } from '@/shared/lib/assetCache';

/**
 * Сколько ждать шрифт, прежде чем поднимать сцену с запасным: сеть может
 * зависнуть, а партия без шрифта лучше, чем партия без доски.
 */
const FONT_WAIT_TIMEOUT_MS = 3000;

/**
 * Начертание текстов холста: все тексты шапки - `bold` (`GAME_CONFIG`).
 */
const GAME_FONT_WEIGHT = 'bold';

/**
 * Дожидается шрифта текстов холста (`SKIN.fonts.game`) до первого текста
 * сцены: Pixi меряет метрики шрифта при создании текста и сам не
 * перерисовывает его, когда `@font-face` догрузится, - созданный раньше текст
 * остался бы запасным шрифтом до конца партии.
 *
 * Не бросает: ошибка шрифта или таймаут - сцена с запасным шрифтом.
 */
export const waitGameFonts = async (): Promise<void> => {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      warmFontFaces([{ family: SKIN.fonts.game, weight: GAME_FONT_WEIGHT }]).catch(() => undefined),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, FONT_WAIT_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

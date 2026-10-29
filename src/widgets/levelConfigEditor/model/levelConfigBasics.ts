import {
  MIN_LEVEL_COLORS,
  MINIGAME_CHIP_IDS,
  MINIGAME_GRID_SIZE_LIMITS,
  type TMinigameChipId,
} from '@/entities/game';
import { EDITOR_TEXTS } from './texts';

/**
 * Правила основных настроек черновика: размер поля и цвета фишек.
 *
 * Размер поля меняется с потерей всего, что не влезло (`resizeMinigameGrid`),
 * поэтому поле ввода не имеет права трактовать промежуточный ввод как размер:
 * стёртая на пути к новому числу цифра обрезала бы поле до минимума и
 * выбросила бы расставленные клетки. Отсюда два правила вместо одного
 * «прижать к границам».
 */

const isWithinGridSizeLimits = (value: number): boolean =>
  value >= MINIGAME_GRID_SIZE_LIMITS.min && value <= MINIGAME_GRID_SIZE_LIMITS.max;

/**
 * Размер, который можно применить прямо во время ввода: целое число в
 * границах. Всё остальное (пусто, «1» на пути к большему числу, мусор) -
 * `null`, размер не трогаем.
 */
export const parseGridSizeInput = (raw: string): number | null => {
  const trimmed = raw.trim();
  const value = Number(trimmed);

  return trimmed !== '' && Number.isInteger(value) && isWithinGridSizeLimits(value) ? value : null;
};

/**
 * Размер на выходе из поля ввода: число вне границ прижимается к ним, пустое
 * или нечисловое - `null`, поле возвращается к текущему размеру.
 */
export const settleGridSizeInput = (raw: string): number | null => {
  const trimmed = raw.trim();
  const value = Number(trimmed);

  if (trimmed === '' || !Number.isFinite(value)) {
    return null;
  }

  const { min, max } = MINIGAME_GRID_SIZE_LIMITS;

  return Math.min(max, Math.max(min, Math.floor(value)));
};

/** Включённый цвет уровня выключается, выключенный - включается; порядок канонический. */
export const toggleLevelColor = (
  colors: readonly TMinigameChipId[],
  id: TMinigameChipId
): TMinigameChipId[] => {
  const next = new Set(colors);

  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }

  return MINIGAME_CHIP_IDS.filter((color) => next.has(color));
};

/**
 * Сводка цветов уровня для блока «Цвета фишек»: сколько не хватает до
 * минимума (`MIN_LEVEL_COLORS`) и подсказка - что не так или что значит
 * выбранный набор.
 */
export const describeLevelColors = (
  colorCount: number
): { missingColors: number; hint: string } => {
  const missingColors = Math.max(0, MIN_LEVEL_COLORS - colorCount);

  if (missingColors > 0) {
    return {
      missingColors,
      hint: EDITOR_TEXTS.basics.colorsMissing(missingColors),
    };
  }

  return {
    missingColors,
    hint:
      colorCount === MIN_LEVEL_COLORS
        ? EDITOR_TEXTS.basics.colorsMinimal
        : EDITOR_TEXTS.basics.colorsHint,
  };
};

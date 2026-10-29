/**
 * Кегль хайп-фразы каскада, ужатый под ширину строки.
 *
 * Длинные фразы («Феноменально!», «УКУСИ МЕНЯ, ПЧЕЛА!») на базовом кегле не
 * помещаются в строку и вылезают за `max-width` баннера. Ширина строки почти
 * линейна по кеглю, поэтому хватает одного прохода: `доступно / измерено`.
 *
 * Ниже `minFontSizePx` не опускаемся - совсем мелкую фразу читать хуже, чем
 * перенесённую на две строки, а перенос - уже забота CSS (`white-space:
 * normal`). Функция чистая: замер DOM делает компонент, сюда приходят числа.
 */
export const resolveComboPhraseFontSizePx = (
  measuredWidthPx: number,
  availableWidthPx: number,
  baseFontSizePx: number,
  minFontSizePx: number
): number => {
  if (
    measuredWidthPx <= 0 ||
    availableWidthPx <= 0 ||
    baseFontSizePx <= 0 ||
    measuredWidthPx <= availableWidthPx
  ) {
    return baseFontSizePx;
  }

  const scaled = baseFontSizePx * (availableWidthPx / measuredWidthPx);

  return Math.max(minFontSizePx, scaled);
};

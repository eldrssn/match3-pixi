import type { ICanvasCssSize } from './bootGameRuntime';

/**
 * CSS-размер канваса - ровно доска экрана партии, округлённая до целых CSS px
 * (дробный размер разъехался бы с маппингом указателя на доли пикселя).
 * Физическое разрешение рантайм добавляет сам (`resolution` = DPR,
 * `GameRuntimeCore.resize`).
 *
 * `null`, пока доска не измерена: нулевой размер ломает и раскладку мира, и
 * бэкбуфер.
 */
export const resolveCanvasCssSize = (board: HTMLElement | null): ICanvasCssSize | null => {
  if (!board) {
    return null;
  }

  const rect = board.getBoundingClientRect();
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);

  return width > 0 && height > 0 ? { width, height } : null;
};

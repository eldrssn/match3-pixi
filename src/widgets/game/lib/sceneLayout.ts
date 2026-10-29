import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../configs/designSize';
import type { ISceneInsets } from '../configs/sceneInsets';

export interface ISceneLayout {
  /** Множитель «дизайн-px -> пиксели канваса» для всех модулей сцены. */
  scale: number;
  /** Верхняя граница безопасной зоны, пиксели канваса. От неё меряется шапка. */
  top: number;
  /** Нижняя граница безопасной зоны, пиксели канваса. От неё меряется низ. */
  bottom: number;
  /** Середина безопасной зоны по вертикали: вокруг неё стоит доска. */
  centerY: number;
}

interface ICanvasSize {
  width: number;
  height: number;
}

/**
 * Единственное правило раскладки сцены: мир вписывается не в весь канвас, а в
 * его безопасную зону - канвас минус отступы хоста сверху и снизу.
 *
 * Канвас при этом остаётся full-bleed (фон доходит до края экрана), а внутрь
 * отступов не заходят шапка, доска и низ. Пока модули считали масштаб от
 * полной высоты, а отступ добавляли только шапке, на коротком экране с вырезом
 * шапка съезжала на первый ряд доски.
 *
 * `pxPerCssPx` - сколько пикселей канваса в одном CSS px (отступы приходят в
 * CSS px, а канвас рисует в физических пикселях, см. `renderScale.ts`).
 */
export const resolveSceneLayout = (
  canvas: ICanvasSize,
  insets: ISceneInsets,
  pxPerCssPx: number
): ISceneLayout => {
  const ratio = pxPerCssPx > 0 ? pxPerCssPx : 1;
  // Отступы больше канваса не должны давать отрицательную зону: тогда мир
  // схлопывается в точку посередине, а не выворачивается.
  const top = Math.min(insets.top * ratio, canvas.height);
  const bottom = Math.max(top, canvas.height - insets.bottom * ratio);
  const safeHeight = bottom - top;

  return {
    scale: Math.min(canvas.width / DESIGN_WIDTH, safeHeight / DESIGN_HEIGHT),
    top,
    bottom,
    centerY: top + safeHeight / 2,
  };
};

/** Кадр спрайт-листа в пикселях листа. */
export interface ISheetFrameRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Кадры спрайт-листа по порядку: слева направо, сверху вниз, как режет лист
 * загрузчик Phaser-эталона (`generateFrameNumbers`). Неполный кадр у правого
 * или нижнего края - не кадр: обрезок листа в анимации мигал бы пустотой.
 *
 * Скин пишет ширину файла как ширину кадра (`ISkinTextureFile.width`), а
 * высоту кадра - `frameHeight`; размер самого листа берётся у загруженной
 * текстуры.
 */
export const resolveSheetFrames = (
  sheetWidth: number,
  sheetHeight: number,
  frameWidth: number,
  frameHeight: number
): ISheetFrameRect[] => {
  if (frameWidth <= 0 || frameHeight <= 0) {
    return [];
  }

  const columns = Math.floor(sheetWidth / frameWidth);
  const rows = Math.floor(sheetHeight / frameHeight);
  const frames: ISheetFrameRect[] = [];

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      frames.push({
        x: column * frameWidth,
        y: row * frameHeight,
        width: frameWidth,
        height: frameHeight,
      });
    }
  }

  return frames;
};

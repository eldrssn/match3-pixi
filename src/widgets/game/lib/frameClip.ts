/**
 * Номера кадров клипа (`ISkinFrameClip.frames`) в листе из `frameCount`
 * кадров: без списка - все кадры по порядку. Номер за пределами листа
 * отбрасывается: у загрузчика эталона такой кадр рисовался бы пустым
 * квадратом `__MISSING`, а здесь клип просто короче.
 */
export const resolveClipFrames = (
  frameCount: number,
  frames: readonly number[] | undefined
): number[] => {
  if (!frames) {
    return Array.from({ length: Math.max(0, frameCount) }, (_, index) => index);
  }

  return frames.filter((index) => Number.isInteger(index) && index >= 0 && index < frameCount);
};

/**
 * Повторы клипа в смысле часов рантайма (`RuntimeMotion`: Phaser-семантика,
 * `-1` - бесконечно): по умолчанию один проход, как у эталона.
 */
export const resolveClipRepeat = (repeat: number | undefined): number =>
  repeat === undefined ? 0 : repeat < 0 ? -1 : Math.floor(repeat);

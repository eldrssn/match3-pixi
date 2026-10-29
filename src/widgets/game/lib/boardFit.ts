import { GAME_CONFIG } from '../configs/GAME_CONFIG';

/**
 * Вписывание поля любого размера в одну и ту же область сцены.
 *
 * Сцена свёрстана под поле 6×6 (`GAME_CONFIG.board`): шапка с целями сверху,
 * панель бустеров снизу, клетка 57 дизайн-px. Масштаб только от канваса увёл
 * бы поле 8×8 при той же клетке за край колонки (8 × 59 = 470 дизайн-px при
 * ширине сцены 360), поэтому поле крупнее 6×6 ужимается под область 6×6
 * целиком - тем же множителем по обеим осям, чтобы
 * клетка осталась квадратной. Меньшие поля не растягиваются: фишка крупнее
 * макета выглядела бы чужой рядом с панелями.
 *
 * Правило одно на двух потребителей - фишки (`GameLogic`) и подложку
 * (`GameBoardBackground`): разойдись они в множителе, клетки фона и фишки
 * разъехались бы.
 */

export interface IBoardDesignSize {
  width: number;
  height: number;
}

/** Дизайн-размер поля `cols`×`rows`: клетки плюс зазоры между ними. */
export const resolveBoardDesignSize = (cols: number, rows: number): IBoardDesignSize => {
  const { width: tile, spaceBetween } = GAME_CONFIG.tile.size;
  const step = tile + spaceBetween;

  return {
    width: Math.max(0, cols * step - spaceBetween),
    height: Math.max(0, rows * step - spaceBetween),
  };
};

/** Область сцены под поле - поле 6×6, под которое свёрстаны шапка и бустеры. */
export const BOARD_FIT_AREA: IBoardDesignSize = resolveBoardDesignSize(
  GAME_CONFIG.board.width,
  GAME_CONFIG.board.height
);

/** Во сколько раз ужать поле `cols`×`rows`, чтобы оно влезло в область. */
export const resolveBoardFitScale = (
  cols: number,
  rows: number,
  area: IBoardDesignSize = BOARD_FIT_AREA
): number => {
  const size = resolveBoardDesignSize(cols, rows);

  if (size.width === 0 || size.height === 0) {
    return 1;
  }

  return Math.min(1, area.width / size.width, area.height / size.height);
};

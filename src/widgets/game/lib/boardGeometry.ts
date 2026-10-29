import { GAME_CONFIG } from '../configs/GAME_CONFIG';

const { width: TILE_WIDTH, height: TILE_HEIGHT, spaceBetween: TILE_GAP } = GAME_CONFIG.tile.size;

/**
 * Геометрия сетки доски в дизайн-координатах её контейнера (ось `col` - X,
 * `row` - Y, как во всём рантайме).
 *
 * Одна формула на всё, что рисуется по клеткам: спрайты предметов и слоёв,
 * взрывы спецфишек, попапы каскада, оседание. Пока каждая из них держала свою
 * копию `col * (width + spaceBetween) + width / 2`, первая же правка размера
 * клетки развела бы эффекты со спрайтами.
 */

/** Шаг сетки по X, дизайн-px: клетка плюс зазор. */
export const TILE_STEP_X = TILE_WIDTH + TILE_GAP;

/** Шаг сетки по Y, дизайн-px. Клетки квадратные, но оси держим раздельно. */
export const TILE_STEP_Y = TILE_HEIGHT + TILE_GAP;

export interface IBoardPoint {
  x: number;
  y: number;
}

/** Центр клетки `{ col, row }`; `row: -1` - клетка над верхним краем поля. */
export const cellCenter = ({ col, row }: { col: number; row: number }): IBoardPoint => ({
  x: col * TILE_STEP_X + TILE_WIDTH / 2,
  y: row * TILE_STEP_Y + TILE_HEIGHT / 2,
});

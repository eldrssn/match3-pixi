import { GAME_CONFIG } from '../configs/GAME_CONFIG';
import { TILE_STEP_X } from './boardGeometry';

/**
 * Чистое правило слежения пары за пальцем: на сколько сдвинуть ведомую фишку и
 * её соседа при ходе пальца на `offset` дизайн-пикселей.
 *
 * Отдельно от `GameLogic` по тому же правилу, что `boardGravity`, `boardTempo` и
 * `reshuffleLayout`: здесь нет ни движка отрисовки, ни грида - только геометрия, и
 * именно её можно проверить тестом. Кто сосед и умеет ли он меняться местами,
 * решает вызывающий (грид знает только он) и приносит сюда одним булевым
 * признаком.
 */

/** Смещения обеих половин пары в локальных координатах контейнера доски. */
export interface ISwapDragOffsets {
  dragged: { x: number; y: number };
  partner: { x: number; y: number };
}

export interface ISwapDragInput {
  /** Ход пальца по доминирующей оси, в дизайн-пикселях. Знак - направление. */
  offset: number;
  /** Направление свайпа по колонкам (-1/0/1). */
  dCol: number;
  /** Направление свайпа по строкам (-1/0/1). */
  dRow: number;
  /**
   * Сосед существует и умеет меняться местами.
   *
   * `false` - край доски, дыра или блокер. Тогда ход укорочен до
   * `dragFollowTiles.blocked`: жест остаётся живым, но пара не изображает
   * обмен, которого не будет, и фишка не ложится поверх блокера.
   */
  hasSwappablePartner: boolean;
}

/**
 * Предел хода за пальцем в пикселях.
 *
 * Со свапаемым соседом это целая клетка: пара меняется местами прямо под
 * пальцем, и на отпускании доезжать уже нечего. Порог коммита
 * (`swipeThresholdTiles`) с этим числом намеренно не связан - он остаётся на
 * половине клетки, то есть середина пути это точка невозврата, а не конец
 * движения.
 */
const resolveLimitPx = (hasSwappablePartner: boolean): number =>
  TILE_STEP_X *
  (hasSwappablePartner
    ? GAME_CONFIG.dragFollowTiles.swappable
    : GAME_CONFIG.dragFollowTiles.blocked);

/**
 * Смещения пары под текущий ход пальца.
 *
 * Партнёр всегда уезжает навстречу ведомой фишке - на то же расстояние с
 * обратным знаком. Смещение партнёра возвращается и тогда, когда партнёра нет:
 * применять его в этом случае просто некому, а ветвление в правиле сделало бы
 * результат частичным.
 *
 * Ось одна: свайп квантован по секторам в 90° (`BoardEntity.resolveSwipeDirection`),
 * и по неведущей оси смещение строго нулевое - свободное перетаскивание по
 * диагонали не соответствует ни одному возможному ходу. Направление без оси
 * (`dCol === 0 && dRow === 0`) даёт нули: жеста ещё нет.
 */
export const resolveSwapDragOffset = ({
  offset,
  dCol,
  dRow,
  hasSwappablePartner,
}: ISwapDragInput): ISwapDragOffsets => {
  const limit = resolveLimitPx(hasSwappablePartner);
  const limited = Math.min(Math.max(offset, -limit), limit);

  return {
    dragged: {
      x: dCol !== 0 ? limited : 0,
      y: dRow !== 0 ? limited : 0,
    },
    partner: {
      // Именно `-limited`, а не `-x`: отрицание нуля даёт `-0`, и в смещение
      // спрайта уезжало бы значение, которое строгое сравнение отличает от
      // нуля.
      x: dCol !== 0 ? -limited : 0,
      y: dRow !== 0 ? -limited : 0,
    },
  };
};

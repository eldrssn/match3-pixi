import type { IBoardCellPos } from '@/entities/game';
import { cellCenter, type IBoardPoint } from './boardGeometry';

/**
 * Чистые правила эффектов доски (`fx/createBoardFx`): таблица ударов камеры,
 * тряска и вспышка по времени, залп креста, кольцо волны, дуга полёта
 * пропеллера. Числа - Phaser-эталона (`lib/boardFx`, `lib/specialFx` и
 * эффекты камеры Phaser `Shake`/`Flash`); отрисовки здесь нет - её держит
 * Pixi-обвязка, а правила проверяются тестом.
 */

/**
 * Удары камеры по событиям доски: длительность и сила (доля размера экрана)
 * одной таблицей - сила эффектов сравнивается между собой в одном месте.
 */
export const CAMERA_PUNCH = {
  /** Глубокий каскад (3+): цепочка ощущается мощью. */
  cascade: { durationMs: 90, intensity: 0.003 },
  /** Точечный урон по клетке/линии: лазер на доске и грави-луч. */
  strike: { durationMs: 120, intensity: 0.004 },
  /** Залп порталов: все фишки цвета уходят разом. */
  colorSweep: { durationMs: 180, intensity: 0.005 },
  /** Волна ball-бустера по трём строкам - самый сильный одиночный эффект. */
  shockwave: { durationMs: 250, intensity: 0.007 },
  /** Финал поражения: короткий глухой толчок под затемнение доски. */
  defeat: { durationMs: 90, intensity: 0.003 },
} as const;

/**
 * Смещение кадра тряски: случайное в `±intensity` размера экрана по каждой
 * оси, новое на каждый кадр - формула `Shake` эталона (камера Phaser
 * меряется в пикселях канваса, сцена Pixi - в CSS px, поэтому множитель
 * плотности сокращается).
 */
export const resolveShakeOffset = (
  intensity: number,
  size: { width: number; height: number },
  random: () => number = Math.random
): IBoardPoint => ({
  x: (random() * 2 - 1) * intensity * size.width,
  y: (random() * 2 - 1) * intensity * size.height,
});

/** Прозрачность вспышки кадра: линейно от 1 к 0 за длительность (`Flash` эталона). */
export const resolveFlashAlpha = (elapsedMs: number, durationMs: number): number =>
  durationMs <= 0 ? 0 : Math.max(0, 1 - elapsedMs / durationMs);

/** Луч залпа: точка и ось (0 - строка, 90 - колонка). */
export interface ICrossBeam {
  point: IBoardPoint;
  angleDeg: 0 | 90;
}

/**
 * Лучи залпа через клетку: крест ракета+ракета (`width: 1`) и по три линии
 * ракета+бомба (`width: 3`). Линии за краем поля не рисуются - пустой список
 * значит, что ждать нечего.
 */
export const listCrossBeams = (
  at: IBoardCellPos,
  width: number,
  bounds: { colCount: number; rowCount: number }
): ICrossBeam[] => {
  const reach = (width - 1) / 2;
  const beams: ICrossBeam[] = [];

  for (let offset = -reach; offset <= reach; offset++) {
    const row = at.row + offset;
    const col = at.col + offset;

    if (row >= 0 && row < bounds.rowCount) {
      beams.push({ point: cellCenter({ col: at.col, row }), angleDeg: 0 });
    }

    if (col >= 0 && col < bounds.colCount) {
      beams.push({ point: cellCenter({ col, row: at.row }), angleDeg: 90 });
    }
  }

  return beams;
};

/** Кольцо выходит чуть за край зоны: волна читается целиком, а не обрезанной. */
export const RING_OVERSHOOT = 1.15;

/** Конечный масштаб кольца волны диаметром `diameter` дизайн-px. */
export const resolveRingScale = (diameter: number, textureWidth: number): number =>
  (diameter * RING_OVERSHOOT) / textureWidth;

/** Высота дуги полёта пропеллера - доля пройденного пути. */
export const PROPELLER_FLIGHT_ARC = 0.35;

/** Точка дуги полёта пропеллера на доле пути `t` (0..1). */
export const resolveFlightPoint = (
  start: IBoardPoint,
  end: IBoardPoint,
  t: number
): IBoardPoint => {
  const arc = Math.hypot(end.x - start.x, end.y - start.y) * PROPELLER_FLIGHT_ARC;

  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t - Math.sin(Math.PI * t) * arc,
  };
};

/**
 * Подпись множителя каскада - одна цифра: «×10» рядом с фишкой уже не
 * читается, а такие каскады за пределами реальной партии.
 */
export const COMBO_MAX_LABEL = 9;

export const clampComboLabel = (iteration: number): number => Math.min(iteration, COMBO_MAX_LABEL);

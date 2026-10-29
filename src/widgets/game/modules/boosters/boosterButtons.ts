import type { IBoosterButtonConfig } from './BoosterButton';

/**
 * Три кнопки бустеров нижней панели: вид, текстура и место в ряду. Одна
 * таблица вместо трёх почти одинаковых классов - добавить бустер значит
 * добавить строку. Положение задаёт `offsetX` (панель симметрична
 * относительно центра); событие старта у всех одно - `boosterStart` с видом.
 */
export const BOOSTER_BUTTONS: readonly IBoosterButtonConfig[] = [
  { kind: 'beam', texture: 'boosterBeam', offsetX: 74 },
  { kind: 'laser', texture: 'boosterLaser', offsetX: 0 },
  { kind: 'ball', texture: 'boosterBall', offsetX: -74 },
];

/**
 * Ось и знак свайпа по его дельте. Квантование по секторам в 90°: у хода в
 * match-3 всего четыре направления, и диагональ обязана выбрать одно из них.
 * Границы секторов - как у Phaser-эталона (`CellInputController`): ровно 45°
 * уходит в горизонталь.
 */
export const resolveSwipeDirection = (dx: number, dy: number): { dirX: number; dirY: number } => {
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  if (angle >= -45 && angle <= 45) return { dirX: 1, dirY: 0 };
  if (angle >= 135 || angle <= -135) return { dirX: -1, dirY: 0 };
  if (angle > 45 && angle < 135) return { dirX: 0, dirY: 1 };

  return { dirX: 0, dirY: -1 };
};

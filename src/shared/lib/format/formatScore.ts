/**
 * Очки игры с разбивкой на тысячи узким пробелом: `12 340`. Узкий, а не
 * обычный - число не рвётся переносом и не расползается по ширине.
 */
export const formatScore = (value: number): string =>
  Math.max(0, Math.round(value))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

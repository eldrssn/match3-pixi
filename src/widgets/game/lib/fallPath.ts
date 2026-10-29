export interface IFallCell {
  col: number;
  row: number;
}

export interface IFallSegment {
  /** Куда ведёт отрезок. */
  to: IFallCell;
  /** Сколько строк он проходит - от этого считается длительность. */
  rows: number;
  /** Шаг по колонке: 0 - прямо вниз, ±1 - соскальзывание по диагонали. */
  dCol: number;
}

/**
 * Путь оседания (по клетке за такт гравитации) -> отрезки анимации.
 *
 * Подряд идущие шаги прямо вниз сливаются в один отрезок: колонка падает
 * одним движением с разгоном, а не ступеньками по клетке. Каждый шаг по
 * диагонали - свой отрезок: фишка соскальзывает под блокер и дальше падает
 * уже в новой колонке.
 */
export const resolveFallSegments = (
  from: IFallCell,
  path: readonly IFallCell[]
): IFallSegment[] => {
  const segments: IFallSegment[] = [];
  let previous = from;

  for (const cell of path) {
    const dCol = cell.col - previous.col;
    const rows = cell.row - previous.row;
    const last = segments[segments.length - 1];

    if (last && dCol === 0 && last.dCol === 0) {
      last.to = cell;
      last.rows += rows;
    } else {
      segments.push({ to: cell, rows, dCol });
    }

    previous = cell;
  }

  return segments;
};

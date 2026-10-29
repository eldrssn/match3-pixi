import type { IBoardCell, TBoardGrid, TIsMatchable } from './boardMatches';

/**
 * Классификатор фигур Match-3: какие клетки гаснут одним событием и какую
 * спецфишку за это дать.
 *
 * Сегменты фигуры - линии из трёх и больше по строке или колонке и квадраты
 * 2×2 одного цвета. Сегменты, делящие хотя бы одну клетку, - одна фигура
 * (клетка одна, значит и цвет один). Фигура получает вид по приоритету жанра:
 *
 * | Вид      | Признак                                   | Спецфишка |
 * | -------- | ----------------------------------------- | --------- |
 * | `line5`  | линия из 5+                               | радуга    |
 * | `lt`     | линия строки и линия колонки пересекаются | бомба     |
 * | `line4`  | линия из 4                                | ракета    |
 * | `square` | квадрат 2×2                               | пропеллер |
 * | `line3`  | всё остальное                             | -         |
 *
 * Правило ничего не знает о спецфишках и рождении: оно отдаёт вид, клетки и
 * опорные точки (ось четвёрки, клетку пересечения), а куда поставить награду,
 * решает движок. Ось та же, что во всём коре: `grid[col][row]`.
 */

export interface IShapeCell {
  col: number;
  row: number;
}

export type TShapeKind = 'line5' | 'lt' | 'line4' | 'square' | 'line3';

export type TShapeAxis = 'horizontal' | 'vertical';

export interface IBoardShape {
  kind: TShapeKind;
  /** Все клетки фигуры без повторов, сверху вниз и слева направо. */
  cells: IShapeCell[];
  /** Ось самой длинной линии фигуры; `null` - линий нет (голый квадрат). */
  axis: TShapeAxis | null;
  /** Клетка пересечения строки и колонки (`lt`), иначе `null`. */
  intersection: IShapeCell | null;
}

interface ISegment {
  cells: IShapeCell[];
  /** Ось линии; у квадрата - `null`. */
  axis: TShapeAxis | null;
}

const MIN_LINE = 3;
const ROCKET_LINE = 4;
const RAINBOW_LINE = 5;

/** Приоритет вида: больше - ценнее. */
const SHAPE_PRIORITY: Record<TShapeKind, number> = {
  line5: 4,
  lt: 3,
  line4: 2,
  square: 1,
  line3: 0,
};

const keyOf = (cell: IShapeCell): string => `${cell.col}:${cell.row}`;

const compareCells = (a: IShapeCell, b: IShapeCell): number => a.row - b.row || a.col - b.col;

/** Линии из трёх и больше: колонки сверху вниз, строки слева направо. */
const findLines = <TCell extends IBoardCell>(
  grid: TBoardGrid<TCell>,
  matchable: (cell: TCell | null | undefined) => cell is TCell
): ISegment[] => {
  const cols = grid.length;
  const rows = grid[0]?.length ?? 0;
  const lines: ISegment[] = [];

  const scan = (length: number, at: (index: number) => IShapeCell, axis: TShapeAxis): void => {
    let streak: IShapeCell[] = [];
    let streakId: string | null = null;

    const flush = (): void => {
      if (streak.length >= MIN_LINE) {
        lines.push({ cells: streak, axis });
      }
    };

    for (let index = 0; index < length; index++) {
      const pos = at(index);
      const cell = grid[pos.col]?.[pos.row];

      if (!matchable(cell)) {
        flush();
        streak = [];
        streakId = null;
        continue;
      }

      if (cell.id === streakId) {
        streak.push(pos);
        continue;
      }

      flush();
      streak = [pos];
      streakId = cell.id;
    }

    flush();
  };

  for (let col = 0; col < cols; col++) {
    scan(rows, (row) => ({ col, row }), 'vertical');
  }

  for (let row = 0; row < rows; row++) {
    scan(cols, (col) => ({ col, row }), 'horizontal');
  }

  return lines;
};

/** Квадраты 2×2 одного цвета, по левой верхней клетке. */
const findSquares = <TCell extends IBoardCell>(
  grid: TBoardGrid<TCell>,
  matchable: (cell: TCell | null | undefined) => cell is TCell
): ISegment[] => {
  const cols = grid.length;
  const rows = grid[0]?.length ?? 0;
  const squares: ISegment[] = [];

  for (let col = 0; col + 1 < cols; col++) {
    for (let row = 0; row + 1 < rows; row++) {
      const cells: IShapeCell[] = [
        { col, row },
        { col: col + 1, row },
        { col, row: row + 1 },
        { col: col + 1, row: row + 1 },
      ];
      const pieces = cells.map((pos) => grid[pos.col]?.[pos.row]);
      const first = pieces[0];

      if (pieces.every(matchable) && pieces.every((piece) => piece.id === first?.id)) {
        squares.push({ cells, axis: null });
      }
    }
  }

  return squares;
};

/** Сегменты, делящие клетку, сливаются в одну фигуру (union-find по индексам). */
const groupSegments = (segments: readonly ISegment[]): ISegment[][] => {
  const parent = segments.map((_, index) => index);
  const find = (index: number): number => {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]];
      index = parent[index];
    }

    return index;
  };
  const owner = new Map<string, number>();

  segments.forEach((segment, index) => {
    for (const cell of segment.cells) {
      const key = keyOf(cell);
      const other = owner.get(key);

      if (other === undefined) {
        owner.set(key, index);
      } else {
        parent[find(index)] = find(other);
      }
    }
  });

  const groups = new Map<number, ISegment[]>();

  segments.forEach((segment, index) => {
    const root = find(index);
    const group = groups.get(root) ?? [];

    group.push(segment);
    groups.set(root, group);
  });

  return [...groups.values()];
};

const findIntersection = (lines: readonly ISegment[]): IShapeCell | null => {
  const horizontal = lines.filter((line) => line.axis === 'horizontal');
  const vertical = lines.filter((line) => line.axis === 'vertical');

  for (const row of horizontal) {
    for (const column of vertical) {
      const shared = row.cells.find((cell) =>
        column.cells.some((other) => other.col === cell.col && other.row === cell.row)
      );

      if (shared) {
        return shared;
      }
    }
  }

  return null;
};

const classify = (segments: readonly ISegment[]): IBoardShape => {
  const unique = new Map<string, IShapeCell>();

  for (const segment of segments) {
    for (const cell of segment.cells) {
      unique.set(keyOf(cell), cell);
    }
  }

  const cells = [...unique.values()].sort(compareCells);
  const lines = segments.filter((segment) => segment.axis !== null);
  const longest = lines.reduce<ISegment | null>(
    (best, line) => (!best || line.cells.length > best.cells.length ? line : best),
    null
  );
  const longestLength = longest?.cells.length ?? 0;
  const axis = longest?.axis ?? null;
  const intersection = findIntersection(lines);

  if (longestLength >= RAINBOW_LINE) {
    return { kind: 'line5', cells, axis, intersection: null };
  }

  if (intersection) {
    return { kind: 'lt', cells, axis, intersection };
  }

  if (longestLength === ROCKET_LINE) {
    return { kind: 'line4', cells, axis, intersection: null };
  }

  if (segments.some((segment) => segment.axis === null)) {
    return { kind: 'square', cells, axis, intersection: null };
  }

  return { kind: 'line3', cells, axis, intersection: null };
};

/**
 * Все фигуры доски: ценные первыми, внутри одного вида - по первой клетке
 * (сверху вниз, слева направо). Пустой список - на доске нет ни одной фигуры.
 */
export const findBoardShapes = <TCell extends IBoardCell>(
  grid: TBoardGrid<TCell>,
  isMatchable: TIsMatchable<TCell>
): IBoardShape[] => {
  const matchable = (cell: TCell | null | undefined): cell is TCell =>
    Boolean(cell) && isMatchable(cell as TCell);
  const segments = [...findLines(grid, matchable), ...findSquares(grid, matchable)];

  return groupSegments(segments)
    .map(classify)
    .sort(
      (a, b) =>
        SHAPE_PRIORITY[b.kind] - SHAPE_PRIORITY[a.kind] || compareCells(a.cells[0], b.cells[0])
    );
};

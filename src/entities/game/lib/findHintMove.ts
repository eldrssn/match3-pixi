/**
 * Поиск хода для подсказки простоя (`widgets/game/modules/IdleHint`, через
 * `BoardEngine.findHint`). Без движка отрисовки и React -
 * только сетка цветов, поэтому правило покрывается тестами.
 */

/** Цвет фишки в клетке сетки; `null` - клетка без фишки (препятствие, дыра). */
export type THintCellColor = string | null;

export interface IHintCell {
  col: number;
  row: number;
}

/** Ровно две клетки, которые нужно поменять местами. */
export type THintSwapPair = readonly [IHintCell, IHintCell];

type THintSwapCandidate = Readonly<{
  col: number;
  row: number;
  dCol: 0 | 1;
  dRow: 0 | 1;
  order: number;
}>;

/** Минимальная линия, которую собирает ход. */
const MATCH_LENGTH = 3;

/**
 * Пара соседних клеток, свап которых собирает линию из трёх. Кандидатов
 * смотрим от центра поля наружу: подсказанный ход получается презентабельнее,
 * чем случайный верхний левый свап. Сетка - `grid[col][row]`, как в рантайме.
 */
/**
 * `canSwap` - можно ли сдвинуть клетку свапом. По умолчанию - любая клетка с
 * цветом; на слоистом поле фишка под цепью матчится, но стоит, а «опусти
 * вниз» без цвета ездит.
 */
export const findHintMove = (
  grid: readonly (readonly THintCellColor[])[],
  canSwap: (col: number, row: number) => boolean = (col, row) => grid[col]?.[row] != null
): THintSwapPair | null => {
  const cols = grid.length;
  const rows = grid[0]?.length ?? 0;

  for (const { col, row, dCol, dRow } of buildHintSwapCandidates(cols, rows)) {
    const target = { col: col + dCol, row: row + dRow };

    if (
      canSwap(col, row) &&
      canSwap(target.col, target.row) &&
      isMatchingSwap(grid, { col, row }, target)
    ) {
      return [{ col, row }, target];
    }
  }

  return null;
};

function buildHintSwapCandidates(cols: number, rows: number): THintSwapCandidate[] {
  const centerCol = (cols - 1) / 2;
  const centerRow = (rows - 1) / 2;
  const candidates: THintSwapCandidate[] = [];

  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      // Соседи справа и снизу: остальные пары повторяются.
      for (const [dCol, dRow] of [
        [1, 0],
        [0, 1],
      ] as const) {
        if (col + dCol >= cols || row + dRow >= rows) continue;

        candidates.push({ col, row, dCol, dRow, order: candidates.length });
      }
    }
  }

  return candidates.sort((a, b) => {
    const distanceDiff =
      getSwapCenterDistance(a, centerCol, centerRow) -
      getSwapCenterDistance(b, centerCol, centerRow);

    return distanceDiff || a.order - b.order;
  });
}

function getSwapCenterDistance(
  candidate: THintSwapCandidate,
  centerCol: number,
  centerRow: number
): number {
  const colDistance = candidate.col + candidate.dCol / 2 - centerCol;
  const rowDistance = candidate.row + candidate.dRow / 2 - centerRow;

  return colDistance * colDistance + rowDistance * rowDistance;
}

/** Собирает ли виртуальный свап пары линию через одну из её клеток. */
function isMatchingSwap(
  grid: readonly (readonly THintCellColor[])[],
  a: IHintCell,
  b: IHintCell
): boolean {
  const cols = grid.length;
  const rows = grid[0]?.length ?? 0;

  const colorAt = (col: number, row: number): THintCellColor => {
    if (col === a.col && row === a.row) return grid[b.col][b.row];
    if (col === b.col && row === b.row) return grid[a.col][a.row];

    return col >= 0 && col < cols && row >= 0 && row < rows ? grid[col][row] : null;
  };

  return [a, b].some(
    ({ col, row }) => hasRunThrough(colorAt, col, row) || hasSquareThrough(colorAt, col, row)
  );
}

/** Входит ли клетка в квадрат 2×2 своего цвета - он даёт пропеллер, то есть тоже ход. */
function hasSquareThrough(
  colorAt: (col: number, row: number) => THintCellColor,
  col: number,
  row: number
): boolean {
  const color = colorAt(col, row);

  if (!color) return false;

  return (
    [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ] as const
  ).some(
    ([dCol, dRow]) =>
      colorAt(col + dCol, row) === color &&
      colorAt(col, row + dRow) === color &&
      colorAt(col + dCol, row + dRow) === color
  );
}

/** Проходит ли через клетку горизонтальная или вертикальная линия (>=3). */
function hasRunThrough(
  colorAt: (col: number, row: number) => THintCellColor,
  col: number,
  row: number
): boolean {
  const color = colorAt(col, row);

  if (!color) return false;

  return (
    [
      [1, 0],
      [0, 1],
    ] as const
  ).some(([dCol, dRow]) => {
    let before = 0;
    while (colorAt(col - (before + 1) * dCol, row - (before + 1) * dRow) === color) before += 1;

    let after = 0;
    while (colorAt(col + (after + 1) * dCol, row + (after + 1) * dRow) === color) after += 1;

    return before + after + 1 >= MATCH_LENGTH;
  });
}

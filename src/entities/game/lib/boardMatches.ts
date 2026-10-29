/**
 * Чистые правила поиска комбинаций на доске.
 *
 * Правило не знает ни про движок отрисовки, ни про `BoardEntity`: клетка для него - это
 * что угодно с полем `id`, а «участвует ли клетка в матче» приходит предикатом
 * (в рантайме это `entity instanceof ChipEntity`). Поэтому поиск матчей можно
 * прочитать отдельно от твинов и спрайтов и проверить тестом, а не запуском
 * игры.
 *
 * Живёт в домене рядом с остальными правилами доски (`boardGravity`,
 * `reshuffleLayout`, `boardShapes`): «что такое комбинация» нужно и движку,
 * и генератору уровней в редакторе
 * (`minigameLevelGrid`). Виджет из entities импортировать может, обратно -
 * нет, поэтому второй копией правила это кончиться не должно.
 *
 * Ось доски здесь та же, что и во всём коре: `grid[col][row]`, первый индекс -
 * колонка (X, слева направо), второй - строка (Y, сверху вниз).
 */

/** Минимум, который правилам нужно знать о клетке. */
export interface IBoardCell {
  readonly id: string;
}

export type TBoardGrid<TCell> = readonly (readonly (TCell | null)[])[];

/** Клетка участвует в матчах (в рантайме - обычная фишка). */
export type TIsMatchable<TCell> = (cell: TCell) => boolean;

export interface IBoardMatches<TCell> {
  /** Все клетки под удаление, без повторов. */
  entities: TCell[];
  /** Комбинации из 4+ в одной строке - горизонталь на экране. */
  horizontal4: TCell[][] | null;
  /** Комбинации из 4+ в одной колонке - вертикаль на экране. */
  vertical4: TCell[][] | null;
  horizontal3: TCell[][] | null;
  vertical3: TCell[][] | null;
  /**
   * Квадраты 2×2 одного цвета (по левой верхней клетке). Квадрат - такая же
   * комбинация, как линия: он гаснет и даёт пропеллер (`boardShapes`), поэтому
   * и «есть ли ход», и «есть ли готовая комбинация» обязаны его видеть.
   */
  squares: TCell[][] | null;
}

const MIN_MATCH_LENGTH = 3;
const LASER_MATCH_LENGTH = 4;

const countColumns = <TCell>(grid: TBoardGrid<TCell>): number => grid.length;

const countRows = <TCell>(grid: TBoardGrid<TCell>): number => grid[0]?.length ?? 0;

const pushStreak = <TCell>(
  streak: TCell[],
  fourList: TCell[][],
  threeList: TCell[][],
  allCells: TCell[]
): void => {
  if (streak.length >= LASER_MATCH_LENGTH) {
    fourList.push([...streak]);
  } else if (streak.length === MIN_MATCH_LENGTH) {
    threeList.push([...streak]);
  }

  allCells.push(...streak);
};

/**
 * Все комбинации на доске.
 *
 * Горизонталь и вертикаль сканирует одна и та же функция: направление задаёт
 * колбэк `cellAt`. Две почти одинаковые копии обхода разъезжались бы от правки
 * в одной из них, и оси в результате перепутались бы местами.
 */
export const findBoardMatches = <TCell extends IBoardCell>(
  grid: TBoardGrid<TCell>,
  isMatchable: TIsMatchable<TCell>
): IBoardMatches<TCell> => {
  const horizontal4: TCell[][] = [];
  const vertical4: TCell[][] = [];
  const horizontal3: TCell[][] = [];
  const vertical3: TCell[][] = [];
  const allCells: TCell[] = [];

  const colCount = countColumns(grid);
  const rowCount = countRows(grid);

  const matchable = (cell: TCell | null | undefined): cell is TCell =>
    Boolean(cell) && isMatchable(cell as TCell);

  const scanLine = (
    length: number,
    cellAt: (index: number) => TCell | null | undefined,
    fourList: TCell[][],
    threeList: TCell[][]
  ): void => {
    let streak: TCell[] = [];
    let previousId: string | null = null;

    const flush = () => {
      if (streak.length >= MIN_MATCH_LENGTH) {
        pushStreak(streak, fourList, threeList, allCells);
      }
    };

    for (let index = 0; index < length; index++) {
      const cell = cellAt(index);

      if (!matchable(cell)) {
        flush();
        streak = [];
        previousId = null;
        continue;
      }

      if (cell.id === previousId) {
        streak.push(cell);
      } else {
        flush();
        streak = [cell];
      }

      previousId = cell.id;
    }

    flush();
  };

  // Вертикаль: фиксируем колонку, идём по строкам сверху вниз.
  for (let col = 0; col < colCount; col++) {
    scanLine(rowCount, (row) => grid[col]?.[row], vertical4, vertical3);
  }

  // Горизонталь: фиксируем строку, идём по колонкам слева направо.
  for (let row = 0; row < rowCount; row++) {
    scanLine(colCount, (col) => grid[col]?.[row], horizontal4, horizontal3);
  }

  const squares: TCell[][] = [];

  for (let col = 0; col + 1 < colCount; col++) {
    for (let row = 0; row + 1 < rowCount; row++) {
      const square = [
        grid[col]?.[row],
        grid[col + 1]?.[row],
        grid[col]?.[row + 1],
        grid[col + 1]?.[row + 1],
      ];
      const [first] = square;

      if (square.every(matchable) && square.every((cell) => cell.id === first?.id)) {
        squares.push(square);
        allCells.push(...square);
      }
    }
  }

  return {
    entities: Array.from(new Set(allCells)),
    horizontal4: horizontal4.length > 0 ? horizontal4 : null,
    vertical4: vertical4.length > 0 ? vertical4 : null,
    horizontal3: horizontal3.length > 0 ? horizontal3 : null,
    vertical3: vertical3.length > 0 ? vertical3 : null,
    squares: squares.length > 0 ? squares : null,
  };
};

/** Есть ли на доске хоть один матч. Дешевле, чем разбирать полный результат. */
export const hasBoardMatch = <TCell extends IBoardCell>(
  grid: TBoardGrid<TCell>,
  isMatchable: TIsMatchable<TCell>
): boolean => findBoardMatches(grid, isMatchable).entities.length > 0;

/**
 * Есть ли на доске ход: свап пары соседей, дающий комбинацию.
 *
 * Проверка идёт по собственной копии колонок, а не по переданному гриду: свап
 * прямо в живом `_grid` с возвратом обратно при любом выходе из середины
 * (исключение в предикате) оставил бы доску перевёрнутой. Копируются только сами массивы колонок - клетки те же объекты,
 * так что перебор не создаёт мусора на каждую пару.
 *
 * Хватает соседей справа и снизу: пара «слева» и «сверху» - это та же пара,
 * рассмотренная с другой стороны.
 *
 * `isSwappable` - можно ли сдвинуть клетку свапом. По умолчанию это те же
 * клетки, что матчатся; расходятся они на слоистом поле: фишка под цепью
 * матчится, но стоит, а «опусти вниз» ездит, но не матчится.
 */
export const hasPossibleMove = <TCell extends IBoardCell>(
  grid: TBoardGrid<TCell>,
  isMatchable: TIsMatchable<TCell>,
  isSwappable: TIsMatchable<TCell> = isMatchable
): boolean => {
  const colCount = countColumns(grid);
  const rowCount = countRows(grid);
  const probe: (TCell | null)[][] = grid.map((column) => [...column]);

  const wouldMatch = (col1: number, row1: number, col2: number, row2: number): boolean => {
    const first = probe[col1][row1];
    probe[col1][row1] = probe[col2][row2];
    probe[col2][row2] = first;

    const result = hasBoardMatch(probe, isMatchable);

    const swapped = probe[col1][row1];
    probe[col1][row1] = probe[col2][row2];
    probe[col2][row2] = swapped;

    return result;
  };

  const swappable = (cell: TCell | null | undefined): cell is TCell =>
    Boolean(cell) && isSwappable(cell as TCell);

  for (let col = 0; col < colCount; col++) {
    for (let row = 0; row < rowCount; row++) {
      if (!swappable(probe[col]?.[row])) {
        continue;
      }

      // Свап вправо: соседняя колонка, та же строка.
      if (col + 1 < colCount && swappable(probe[col + 1]?.[row])) {
        if (wouldMatch(col, row, col + 1, row)) {
          return true;
        }
      }

      // Свап вниз: та же колонка, соседняя строка.
      if (row + 1 < rowCount && swappable(probe[col]?.[row + 1])) {
        if (wouldMatch(col, row, col, row + 1)) {
          return true;
        }
      }
    }
  }

  return false;
};

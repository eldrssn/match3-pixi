import {
  getMinigamePaletteLayer,
  isMinigameChipId,
  isMinigameChipLikeId,
  MINIGAME_RANDOM_ID,
  MINIGAME_LAYER_LIMITS,
  type IMinigameLevelCell,
  type IMinigameLevelConfig,
  type TMinigamePaletteId,
} from '@/entities/game';

/**
 * Новая клетка поля. Ось уровня - `grid[col][row]`: первый индекс - колонка.
 *
 * Та же клетка (инструмент отказал: лёд на камень, подложка под дыру) отдаёт
 * тот же конфиг: по ссылке редактор понимает, что правки не было, и не пишет
 * пустой шаг в историю.
 */
export const replaceGridCell = (
  config: IMinigameLevelConfig,
  colIndex: number,
  rowIndex: number,
  cell: IMinigameLevelCell
): IMinigameLevelConfig => {
  if (config.grid[colIndex]?.[rowIndex] === cell) {
    return config;
  }

  return {
    ...config,
    grid: config.grid.map((column, nextColIndex) =>
      nextColIndex === colIndex
        ? column.map((currentCell, nextRowIndex) =>
            nextRowIndex === rowIndex ? cell : currentCell
          )
        : column
    ),
  };
};

const withoutOverlay = ({ overlay: _overlay, ...cell }: IMinigameLevelCell): IMinigameLevelCell =>
  cell;

const withoutFloor = ({ floor: _floor, ...cell }: IMinigameLevelCell): IMinigameLevelCell => cell;

/** Следующее значение по кругу `min..max`, после `max` - снова `min`. */
const cycle = (value: number, min: number, max: number): number =>
  value >= max || value < min ? min : value + 1;

/**
 * Во что превращается клетка, если на неё бросили элемент палитры. Клетка
 * слоистая (формат v2), поэтому бросок меняет только свой слой:
 *
 * - накладка (лёд, цепь) ложится поверх фишки (и случайной фишки «?»),
 *   повторный бросок той же её снимает; на не-фишку накладка не ложится вовсе;
 * - подложка листает слои 1 -> 2 -> нет; под дырой её не бывает;
 * - предмет заменяет предмет, сохраняя подложку (и накладку, если новый
 *   предмет - тоже фишка); ящик на ящик листает слои 1 -> 2 -> 3 -> 1;
 *   дыра стирает клетку целиком.
 */
export const resolveDroppedCell = (
  currentCell: IMinigameLevelCell,
  droppedId: TMinigamePaletteId
): IMinigameLevelCell => {
  const layer = getMinigamePaletteLayer(droppedId);

  if (layer === 'overlay') {
    if (!isMinigameChipLikeId(currentCell.id)) {
      return currentCell;
    }

    return currentCell.overlay === droppedId
      ? withoutOverlay(currentCell)
      : { ...currentCell, overlay: droppedId };
  }

  if (layer === 'floor') {
    if (currentCell.id === 'HOLE') {
      return currentCell;
    }

    const { max } = MINIGAME_LAYER_LIMITS.floor;
    const floor = currentCell.floor ?? 0;

    return floor >= max ? withoutFloor(currentCell) : { ...currentCell, floor: floor + 1 };
  }

  if (droppedId === 'HOLE') {
    return { id: 'HOLE' };
  }

  const { min, max, fallback } = MINIGAME_LAYER_LIMITS.cargo;
  const next: IMinigameLevelCell = { id: droppedId };

  if (droppedId === 'cargo') {
    next.layers =
      currentCell.id === 'cargo' ? cycle(currentCell.layers ?? fallback, min, max) : fallback;
  }

  if (currentCell.overlay && isMinigameChipLikeId(droppedId)) {
    next.overlay = currentCell.overlay;
  }

  if (currentCell.floor) {
    next.floor = currentCell.floor;
  }

  return next;
};

/**
 * Все фишки поля - в клетки «?»: форма поля, блокеры и слои остаются, а
 * раскладку фишек движок каждый раз выбирает сам (`resolveRandomCells`).
 * Так из сгенерированного или нарисованного поля получается уровень, который
 * не повторяется от партии к партии.
 */
export const randomizeGridChips = (
  grid: IMinigameLevelConfig['grid']
): IMinigameLevelConfig['grid'] =>
  grid.map((column) =>
    column.map((cell) => (isMinigameChipId(cell.id) ? { ...cell, id: MINIGAME_RANDOM_ID } : cell))
  );

/**
 * Двойной клик снимает верхний слой: накладку, затем предмет, затем
 * подложку - одним движением теряется ровно один слой.
 */
export const resolveClearedCell = (
  currentCell: IMinigameLevelCell | undefined
): IMinigameLevelCell => {
  if (!currentCell) {
    return { id: '' };
  }

  if (currentCell.overlay) {
    return withoutOverlay(currentCell);
  }

  if (currentCell.id) {
    return currentCell.floor ? { id: '', floor: currentCell.floor } : { id: '' };
  }

  // Пустая клетка без подложки - снимать нечего: та же клетка, правки нет.
  return currentCell.floor ? { id: '' } : currentCell;
};

/**
 * Клетки отрезка между двумя клетками поля, без начальной, включая конечную.
 *
 * Кисть получает вход в клетку, только если указатель в ней побывал: быстрое
 * движение мыши перескакивает клетки, и ряд закрашивался бы через одну.
 * Поэтому штрих красит весь отрезок от прошлой клетки до текущей (Брезенхем).
 */
export const listStrokeCells = (
  from: { col: number; row: number },
  to: { col: number; row: number }
): { col: number; row: number }[] => {
  const cells: { col: number; row: number }[] = [];
  const dCol = Math.abs(to.col - from.col);
  const dRow = Math.abs(to.row - from.row);
  const stepCol = Math.sign(to.col - from.col);
  const stepRow = Math.sign(to.row - from.row);
  let { col, row } = from;
  let error = dCol - dRow;

  while (col !== to.col || row !== to.row) {
    const doubled = error * 2;

    if (doubled > -dRow) {
      error -= dRow;
      col += stepCol;
    }

    if (doubled < dCol) {
      error += dCol;
      row += stepRow;
    }

    cells.push({ col, row });
  }

  return cells;
};

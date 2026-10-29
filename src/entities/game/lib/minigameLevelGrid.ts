import { hasBoardMatch, hasPossibleMove } from './boardMatches';
import {
  DEFAULT_LEVEL_COLORS,
  isMinigameChipId,
  isMinigameOverlayId,
  MIN_LEVEL_COLORS,
  MINIGAME_FLOOR_ID,
  MINIGAME_LAYER_LIMITS,
  type TMinigameChipId,
  type TMinigameOverlayId,
} from './minigameLevelConfig';
import type { IMinigameLevelCell, IMinigameLevelConfig, IMinigameLevelGoal } from '../types';

/**
 * Ось поля - та же, что во всём коре: `grid[col][row]`. Первый индекс -
 * колонка (X, слева направо), второй - строка (Y, сверху вниз).
 */

/** Размер поля, если в черновике его ещё нет (пустой импорт, битый JSON). */
export const DEFAULT_MINIGAME_GRID_COLS = 6;
export const DEFAULT_MINIGAME_GRID_ROWS = 6;

/**
 * Сколько фишек цвета цели сеем на стартовое поле.
 *
 * Ровно столько, чтобы комбинацию можно было собрать сразу, а не полный
 * `goal.count`: выпадающие фишки движок доски добирает равномерно по цветам
 * уровня (`engine/BoardEngine`), поэтому цель по фишкам
 * достижима и без запаса на поле - в отличие от блокеров, которые не выпадают
 * вовсе.
 */
const GOAL_CHIP_SEED = 3;

/**
 * Сколько клеток обязаны остаться под фишки.
 *
 * Цель вида «собрать 30 блокеров» на поле 6x6 забила бы почти всё поле, и
 * генератор вернул бы доску без единого хода. Лишние блокеры не ставим и
 * честно сообщаем об этом вызывающему через `skippedGoalCells`.
 */
const MIN_CHIP_CELLS = 12;

/**
 * Сколько раз пробуем случайную раскладку, прежде чем сдаться.
 *
 * Отсутствие стартовых комбинаций генератор гарантирует конструктивно (см.
 * `pickChipId`), а вот наличие хода - нет: доска, изрезанная блокерами под
 * цель, может его не иметь в принципе. На пяти цветах и свободном поле ход
 * находится с первой попытки, так что цикл - страховка, а не рабочий режим.
 */
const GENERATION_ATTEMPTS = 24;

const toCellKey = (col: number, row: number): string => `${col},${row}`;

/** Клетка идёт в матч: фишка не подо льдом. Блокер, лёд и дыра линию разрывают. */
const isChipCell = (cell: IMinigameLevelCell): boolean =>
  isMinigameChipId(cell.id) && cell.overlay !== 'ice';

/** Клетку можно сдвинуть свапом: фишка или «опусти вниз» без накладки. */
const isSwappableCell = (cell: IMinigameLevelCell): boolean =>
  (isMinigameChipId(cell.id) || cell.id === 'drop') && !cell.overlay;

/** Предметы-цели, которые встают на поле вместо фишки. */
const PIECE_GOAL_IDS: ReadonlySet<string> = new Set(['cargo', 'stone', 'slime', 'drop']);

export interface IMinigameGridSize {
  cols: number;
  rows: number;
}

/**
 * Размер поля черновика. Читается в одном месте: и «очистить», и
 * «сгенерировать» обязаны отдать поле того же размера, что было.
 */
export const readMinigameGridSize = (config: IMinigameLevelConfig): IMinigameGridSize => ({
  cols: config.grid.length || DEFAULT_MINIGAME_GRID_COLS,
  rows: config.grid[0]?.length || DEFAULT_MINIGAME_GRID_ROWS,
});

export interface IMinigameGridGeneration {
  grid: IMinigameLevelConfig['grid'];
  /** На стартовом поле есть ход. */
  hasMove: boolean;
  /** Клетки под цели, которые не поместились на поле. */
  skippedGoalCells: number;
}

/**
 * Цвет фишки для клетки: любой, который не достраивает тройку.
 *
 * Отсюда и берётся гарантия «поле без стартовых комбинаций». Обход идёт по
 * колонкам, поэтому в момент выбора обе предыдущие клетки строки
 * (`col-1`, `col-2`) и обе предыдущие клетки колонки (`row-1`, `row-2`) уже
 * стоят: если они одного цвета, этот цвет запрещён. Линия из трёх не может
 * появиться и позже - она обязана заканчиваться на какой-то клетке, а каждая
 * клетка проходит эту проверку. Запретов максимум два, цветов пять, поэтому
 * выбор никогда не пустой.
 *
 * `preferred` - цвета целей, которых ещё не хватает на поле: среди разрешённых
 * они идут первыми, поэтому цель начинает собираться с первого хода, а
 * инвариант «нет стартовых комбинаций» при этом не нарушается.
 */
const pickChipId = (
  grid: readonly (readonly IMinigameLevelCell[])[],
  col: number,
  row: number,
  colors: readonly TMinigameChipId[],
  preferred: ReadonlySet<string>,
  random: () => number
): TMinigameChipId => {
  const forbidden = new Set<string>();

  const forbid = (first?: IMinigameLevelCell | null, second?: IMinigameLevelCell | null): void => {
    if (first && second && isChipCell(first) && first.id === second.id) {
      forbidden.add(first.id);
    }
  };

  forbid(grid[col - 1]?.[row], grid[col - 2]?.[row]);
  forbid(grid[col]?.[row - 1], grid[col]?.[row - 2]);

  // Квадрат 2×2 - тоже готовая комбинация (пропеллер): цвет, замыкающий
  // любой из четырёх квадратов вокруг клетки, запрещён так же, как третий в
  // линии. Проверяются все четыре, а не только «сверху-слева»: фиксированные
  // клетки целей стоят на поле раньше, чем обход до них доходит.
  for (const [dCol, dRow] of [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ] as const) {
    const side = grid[col + dCol]?.[row];
    const vertical = grid[col]?.[row + dRow];
    const corner = grid[col + dCol]?.[row + dRow];

    if (
      side &&
      vertical &&
      corner &&
      isChipCell(side) &&
      side.id === vertical.id &&
      side.id === corner.id
    ) {
      forbidden.add(side.id);
    }
  }

  // На двух-трёх цветах линия и квадрат вместе могут запретить все цвета сразу.
  // Тогда клетка берёт любой: такое поле отбракует `generateMinigameLevelGrid`
  // по готовой комбинации и соберёт заново.
  const free = colors.filter((id) => !forbidden.has(id));
  const allowed = free.length > 0 ? free : colors;
  const wanted = allowed.filter((id) => preferred.has(id));
  const pool = wanted.length > 0 ? wanted : allowed;

  return pool[Math.floor(random() * pool.length)];
};

/**
 * Сколько клеток каждого элемента нужно положить на поле под цели уровня.
 *
 * Фишки и блокеры считаются по-разному, и разница не косметическая: блокер
 * на поле один раз и навсегда, поэтому цели по блокерам нужен весь `count`,
 * а фишки досыпаются рантаймом сами.
 */
const planGoalCells = (goals: readonly IMinigameLevelGoal[]): Map<string, number> => {
  const quota = new Map<string, number>();

  goals.forEach((goal) => {
    const needed = isMinigameChipId(goal.id) ? GOAL_CHIP_SEED : Math.max(0, Math.floor(goal.count));

    if (needed === 0) {
      return;
    }

    quota.set(goal.id, Math.max(quota.get(goal.id) ?? 0, needed));
  });

  return quota;
};

/**
 * Клетки под предметы-цели (ящик, камень, слизь, «опусти вниз»): случайные позиции
 * на поле. «Опусти вниз» встаёт только выше нижней строки - иначе он был бы
 * собран, не успев упасть.
 *
 * Ставятся до фишек, а не после: блокер в матче не участвует, поэтому он
 * только разрывает линии и сломать инвариант «нет стартовых комбинаций» не
 * может, а вот подмена уже разложенной фишки - может.
 */
const planFixedCells = (
  quota: ReadonlyMap<string, number>,
  size: IMinigameGridSize,
  random: () => number
): { fixed: Map<string, string>; skipped: number } => {
  const fixed = new Map<string, string>();
  const free: string[] = [];

  for (let col = 0; col < size.cols; col++) {
    for (let row = 0; row < size.rows; row++) {
      free.push(toCellKey(col, row));
    }
  }

  const capacity = Math.max(0, free.length - MIN_CHIP_CELLS);
  let skipped = 0;

  quota.forEach((count, id) => {
    if (!PIECE_GOAL_IDS.has(id)) {
      return;
    }

    for (let placed = 0; placed < count; placed++) {
      const candidates =
        id === 'drop' ? free.filter((key) => Number(key.split(',')[1]) < size.rows - 1) : free;

      if (fixed.size >= capacity || candidates.length === 0) {
        skipped += count - placed;
        break;
      }

      const key = candidates[Math.floor(random() * candidates.length)];

      free.splice(free.indexOf(key), 1);
      fixed.set(key, id);
    }
  });

  return { fixed, skipped };
};

/**
 * Цели-слои поверх готового поля: накладки (лёд, цепь) ложатся на фишки,
 * подложка - под любые клетки. Возвращает, сколько не поместилось.
 *
 * Слоям всё равно, где встать: накладка не меняет цвет фишки, поэтому
 * инвариант «нет стартовых комбинаций» она не ломает, а лёд его даже
 * усиливает - фишка подо льдом в линию не идёт.
 */
const placeLayerGoals = (
  grid: IMinigameLevelCell[][],
  quota: ReadonlyMap<string, number>,
  random: () => number
): number => {
  let skipped = 0;
  const cells = grid.flat();

  const take = (count: number, fits: (cell: IMinigameLevelCell) => boolean) => {
    const pool = cells.filter(fits);
    const picked: IMinigameLevelCell[] = [];

    for (let placed = 0; placed < count; placed++) {
      if (pool.length === 0) {
        skipped += count - placed;
        break;
      }

      picked.push(...pool.splice(Math.floor(random() * pool.length), 1));
    }

    return picked;
  };

  quota.forEach((count, id) => {
    if (isMinigameOverlayId(id)) {
      const overlay: TMinigameOverlayId = id;

      take(count, (cell) => isMinigameChipId(cell.id) && !cell.overlay).forEach((cell) => {
        cell.overlay = overlay;
      });
    }

    if (id === MINIGAME_FLOOR_ID) {
      take(count, (cell) => cell.id !== 'HOLE' && !cell.floor).forEach((cell) => {
        cell.floor = 1;
      });
    }
  });

  return skipped;
};

/** Сборка поля плюс признак, по которому генератор её бракует. */
interface IBuiltGrid extends IMinigameGridGeneration {
  hasReadyMatch: boolean;
}

/**
 * Цвета, из которых генератор кладёт фишки.
 *
 * Черновик с недобранными цветами валидация всё равно не пропустит в превью,
 * но генератору нужно на чём-то строить: на одном цвете тройку не обойти, и
 * `pickChipId` остался бы без кандидатов. Строит он на тех же цветах, что
 * получает уровень без поля `colors` (`DEFAULT_LEVEL_COLORS`): розовый
 * появляется на поле только тогда, когда автор выбрал его сам.
 */
const resolveGridColors = (config: IMinigameLevelConfig): readonly TMinigameChipId[] =>
  config.colors.length >= MIN_LEVEL_COLORS ? config.colors : DEFAULT_LEVEL_COLORS;

const buildGrid = (config: IMinigameLevelConfig, random: () => number): IBuiltGrid => {
  const size = readMinigameGridSize(config);
  const colors = resolveGridColors(config);
  const quota = planGoalCells(config.levelGoals);
  const { fixed, skipped } = planFixedCells(quota, size, random);

  const remaining = new Map<string, number>();
  quota.forEach((count, id) => {
    if (isMinigameChipId(id)) {
      remaining.set(id, count);
    }
  });

  // Колонка заполняется целиком до следующей, поэтому `pickChipId` всегда
  // видит уже готовых соседей слева и сверху - и грид не проходит через
  // промежуточное состояние с дырами.
  const grid: IMinigameLevelCell[][] = [];

  for (let col = 0; col < size.cols; col++) {
    const column: IMinigameLevelCell[] = [];
    grid.push(column);

    for (let row = 0; row < size.rows; row++) {
      const fixedId = fixed.get(toCellKey(col, row));

      if (fixedId) {
        column.push(
          fixedId === 'cargo'
            ? { id: fixedId, layers: MINIGAME_LAYER_LIMITS.cargo.fallback }
            : { id: fixedId }
        );
        continue;
      }

      const preferred = new Set<string>(
        [...remaining.entries()].filter(([, left]) => left > 0).map(([id]) => id)
      );
      const id = pickChipId(grid, col, row, colors, preferred, random);
      const left = remaining.get(id);

      if (left !== undefined && left > 0) {
        remaining.set(id, left - 1);
      }

      column.push({ id });
    }
  }

  const unseeded = [...remaining.values()].reduce((sum, left) => sum + left, 0);
  const layered = placeLayerGoals(grid, quota, random);

  return {
    grid,
    hasMove: hasPossibleMove(grid, isChipCell, isSwappableCell),
    hasReadyMatch: hasBoardMatch(grid, isChipCell),
    skippedGoalCells: skipped + unseeded + layered,
  };
};

const isPlayable = (generation: IBuiltGrid): boolean =>
  generation.hasMove && !generation.hasReadyMatch;

/**
 * Случайное поле под цели уровня.
 *
 * Что генератор обещает:
 * - размер тот же, что у поля черновика;
 * - на старте нет ни одной готовой комбинации - рантайм их не разбирает
 *   (`createBoard` собирает доску и сразу отдаёт ход игроку), поэтому уровень
 *   с тройкой «из коробки» начинался бы со стоячих матчей;
 * - элементы целей на поле есть: блокеры - в количестве `goal.count`, фишки -
 *   `GOAL_CHIP_SEED` штук на цвет;
 * - ход на поле есть - если он на такой доске возможен вообще.
 *
 * Чего не обещает: что уровень интересный и что цель проходится за
 * `config.moves` ходов. Это решает автор уровня, а не генератор.
 *
 * `random` параметром, а не `Math.random` внутри: правило должно быть
 * воспроизводимым в тестах.
 */
export const generateMinigameLevelGrid = (
  config: IMinigameLevelConfig,
  random: () => number = Math.random
): IMinigameGridGeneration => {
  let last = buildGrid(config, random);

  for (let attempt = 1; attempt < GENERATION_ATTEMPTS && !isPlayable(last); attempt++) {
    last = buildGrid(config, random);
  }

  const { grid, hasMove, skippedGoalCells } = last;

  return { grid, hasMove, skippedGoalCells };
};

/** Клетка, которую перекраска заполняет заново: обычная фишка или пустая. */
const isRecolorableCell = (cell: IMinigameLevelCell): boolean =>
  cell.id === '' || isMinigameChipId(cell.id);

/**
 * Перекраска фишек поверх готового поля: всё, кроме обычных фишек, остаётся
 * ровно как было.
 *
 * Сценарий - ручная раскладка: автор уровня сам расставил дыры, блокеры,
 * накладки и спецфишки и хочет перетасовать только цвета, не теряя своей
 * работы (полная `generateMinigameLevelGrid` строит поле с нуля по целям).
 *
 * Что сохраняется:
 * - размер поля;
 * - каждая клетка, которая не фишка и не пустая (`HOLE`, ящик со слоями,
 *   камень, слизь, «опусти вниз», «?», спецфишки с осью и т.д.), - со всеми
 *   полями, без изменений;
 * - накладка (`overlay`) и подложка (`floor`) перекрашиваемой клетки: меняется
 *   только `id` - цвет фишки.
 *
 * Пустые клетки становятся фишками (подложка, если была, остаётся). Цвета -
 * из `config.colors` с тем же запасным набором, что у полной генерации.
 *
 * Гарантии те же, что у `generateMinigameLevelGrid`: нет готовых комбинаций,
 * ход есть - если он на такой доске возможен вообще; иначе после
 * `GENERATION_ATTEMPTS` попыток отдаётся последняя. Матчи и ходы считаются
 * теми же правилами `isChipCell`/`isSwappableCell`, поэтому фишка подо льдом
 * линию не продолжает, а под цепью - не двигается.
 *
 * Фишки цветов целей не досеваются: раскладку задаёт автор, а цели по фишкам
 * движок добирает сам. Поэтому `skippedGoalCells` всегда `0`.
 */
export const regenerateMinigameGridChips = (
  config: IMinigameLevelConfig,
  random: () => number = Math.random
): IMinigameGridGeneration => {
  const size = readMinigameGridSize(config);
  const colors = resolveGridColors(config);
  const noPreferred: ReadonlySet<string> = new Set();

  const build = (): IBuiltGrid => {
    // Обход по колонкам, как в `buildGrid`: `pickChipId` видит уже готовых
    // соседей слева и сверху, а неперекрашиваемые клетки стоят с самого начала
    // и в матч не идут - инвариант «нет стартовых комбинаций» тот же.
    const grid: IMinigameLevelCell[][] = [];

    for (let col = 0; col < size.cols; col++) {
      const column: IMinigameLevelCell[] = [];
      grid.push(column);

      for (let row = 0; row < size.rows; row++) {
        const source = config.grid[col]?.[row] ?? { id: '' };

        column.push(
          isRecolorableCell(source)
            ? { ...source, id: pickChipId(grid, col, row, colors, noPreferred, random) }
            : { ...source }
        );
      }
    }

    return {
      grid,
      hasMove: hasPossibleMove(grid, isChipCell, isSwappableCell),
      hasReadyMatch: hasBoardMatch(grid, isChipCell),
      skippedGoalCells: 0,
    };
  };

  let last = build();

  for (let attempt = 1; attempt < GENERATION_ATTEMPTS && !isPlayable(last); attempt++) {
    last = build();
  }

  const { grid, hasMove, skippedGoalCells } = last;

  return { grid, hasMove, skippedGoalCells };
};

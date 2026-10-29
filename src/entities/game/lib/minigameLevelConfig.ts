import { LEVEL_VALIDATION_TEXTS } from '../texts';
import type { IMinigameLevelCell, IMinigameLevelConfig, IMinigameLevelGoal } from '../types';

/** Текущая версия формата уровня: v2 - клетка слоями (предмет, накладка, подложка). */
export const LEVEL_FORMAT_VERSION = 2;

export const MINIGAME_CHIP_IDS = ['yellow', 'red', 'pink', 'violet', 'green', 'blue'] as const;
/**
 * Цвета уровня, у которого они не заданы (уровень до появления цветов, новый
 * черновик редактора): классические пять, без розового. Не «все цвета»:
 * шестой цвет заметно усложняет доску, и старый уровень не должен молча
 * менять сложность оттого, что в игре появилась новая фишка.
 */
export const DEFAULT_LEVEL_COLORS: readonly TMinigameChipId[] = [
  'yellow',
  'red',
  'violet',
  'green',
  'blue',
];
/**
 * Случайная фишка («?»): цвет выбирает движок на старте партии из цветов
 * уровня, от зерна партии и без готовой фигуры (`lib/randomCells`). Автор
 * задаёт форму поля и блокеры, а раскладка фишек каждый раз своя.
 */
export const MINIGAME_RANDOM_ID = 'random';

/**
 * Предметы клетки (`IMinigameLevelCell.id`): фишки, случайная фишка, ящик,
 * камень, слизь, «опусти вниз», дыра.
 */
export const MINIGAME_PIECE_IDS = [
  ...MINIGAME_CHIP_IDS,
  MINIGAME_RANDOM_ID,
  'cargo',
  'stone',
  'slime',
  'drop',
  'HOLE',
] as const;
/**
 * Спецфишки, поставленные на поле заранее (ракета, бомба, пропеллер, радуга):
 * коды - те же, что у спецфишек движка. В палитру формата они не входят
 * (палитра - это ещё и цели, а целью спецфишка не бывает): редактор ставит
 * их своими инструментами (`widgets/levelConfigEditor/model/editorTools`).
 * Ракете нужна ось - `IMinigameLevelCell.direction`, без поля - горизонталь.
 */
export const MINIGAME_SPECIAL_IDS = ['laser', 'bomb', 'propeller', 'rainbow'] as const;
/** Ось ракеты (`laser`) на поле уровня. */
export const MINIGAME_LASER_DIRECTIONS = ['horizontal', 'vertical'] as const;
/** Накладки поверх фишки (`IMinigameLevelCell.overlay`). */
export const MINIGAME_OVERLAY_IDS = ['ice', 'chain'] as const;
/** Подложка (`IMinigameLevelCell.floor`) - в палитре и целях у неё свой id. */
export const MINIGAME_FLOOR_ID = 'floor';
/** Всё, что можно положить на поле из палитры редактора. */
export const MINIGAME_PALETTE_IDS = [
  ...MINIGAME_PIECE_IDS,
  ...MINIGAME_OVERLAY_IDS,
  MINIGAME_FLOOR_ID,
] as const;
/** Что может быть целью уровня: фишки цвета, блокеры, «опусти вниз», накладки, подложка. */
export const MINIGAME_GOAL_IDS = [
  ...MINIGAME_CHIP_IDS,
  'cargo',
  'stone',
  'slime',
  'drop',
  ...MINIGAME_OVERLAY_IDS,
  MINIGAME_FLOOR_ID,
] as const;

export type TMinigameChipId = (typeof MINIGAME_CHIP_IDS)[number];
export type TMinigamePieceId = (typeof MINIGAME_PIECE_IDS)[number];
export type TMinigameSpecialId = (typeof MINIGAME_SPECIAL_IDS)[number];
export type TMinigameLaserDirection = (typeof MINIGAME_LASER_DIRECTIONS)[number];
export type TMinigameOverlayId = (typeof MINIGAME_OVERLAY_IDS)[number];
export type TMinigamePaletteId = (typeof MINIGAME_PALETTE_IDS)[number];
export type TMinigameGoalId = (typeof MINIGAME_GOAL_IDS)[number];

/**
 * Все коды элементов, которые формат кладёт на поле: палитра и спецфишки.
 * По этим же кодам скин описывает вид и подписи элемента
 * (`entities/skin`, запись на каждый код) - сам формат о виде не знает.
 */
export const MINIGAME_ELEMENT_IDS = [...MINIGAME_PALETTE_IDS, ...MINIGAME_SPECIAL_IDS] as const;

export type TMinigameElementId = (typeof MINIGAME_ELEMENT_IDS)[number];

/**
 * Границы слоёв: ящик - 1-3 удара (по умолчанию 2),
 * подложка - 1-2 слоя.
 */
export const MINIGAME_LAYER_LIMITS = {
  cargo: { min: 1, max: 3, fallback: 2 },
  floor: { min: 1, max: 2 },
} as const;

/**
 * Меньше двух цветов на поле не бывает: на одном любой свап - готовая линия,
 * выбирать ход незачем. Два цвета - осознанный крайний случай (обучение,
 * уровень-«каскад»): добор почти после каждого хода сам собирает линии, а
 * раскладке «?» часто нужна не одна попытка (`BoardEngine.fromLevel`).
 */
export const MIN_LEVEL_COLORS = 2;

/**
 * Границы размера поля по каждой оси. Рантайм вписывает поле любого размера в
 * ту же область экрана (`widgets/game/lib/boardFit`), но на поле 10+ клеток
 * фишка на телефоне становится меньше пальца, а на поле меньше 3 не
 * собирается ни одна линия.
 */
export const MINIGAME_GRID_SIZE_LIMITS = { min: 3, max: 9 } as const;

/** Длиннее название не помещается в шапку карточки уровня одной строкой. */
export const LEVEL_TITLE_MAX_LENGTH = 32;

/** Какой слой клетки кладёт элемент палитры. */
export type TMinigamePaletteLayer = 'piece' | 'overlay' | 'floor';

const toIdSet = (ids: readonly string[]): ReadonlySet<string> => new Set<string>(ids);

const MINIGAME_CHIP_ID_SET = toIdSet(MINIGAME_CHIP_IDS);
const MINIGAME_PALETTE_ID_SET = toIdSet(MINIGAME_PALETTE_IDS);
const MINIGAME_ELEMENT_ID_SET = toIdSet(MINIGAME_ELEMENT_IDS);
const MINIGAME_PIECE_ID_SET = toIdSet(MINIGAME_PIECE_IDS);
const MINIGAME_SPECIAL_ID_SET = toIdSet(MINIGAME_SPECIAL_IDS);
const MINIGAME_LASER_DIRECTION_SET = toIdSet(MINIGAME_LASER_DIRECTIONS);
const MINIGAME_OVERLAY_ID_SET = toIdSet(MINIGAME_OVERLAY_IDS);
const MINIGAME_GOAL_ID_SET = toIdSet(MINIGAME_GOAL_IDS);

export const isMinigameChipId = (value: string): value is TMinigameChipId =>
  MINIGAME_CHIP_ID_SET.has(value);

export const isMinigamePaletteId = (value: string): value is TMinigamePaletteId =>
  MINIGAME_PALETTE_ID_SET.has(value);

export const isMinigameElementId = (value: string): value is TMinigameElementId =>
  MINIGAME_ELEMENT_ID_SET.has(value);

export const isMinigamePieceId = (value: string): value is TMinigamePieceId =>
  MINIGAME_PIECE_ID_SET.has(value);

export const isMinigameSpecialId = (value: string): value is TMinigameSpecialId =>
  MINIGAME_SPECIAL_ID_SET.has(value);

export const isMinigameLaserDirection = (value: string): value is TMinigameLaserDirection =>
  MINIGAME_LASER_DIRECTION_SET.has(value);

export const isMinigameOverlayId = (value: string): value is TMinigameOverlayId =>
  MINIGAME_OVERLAY_ID_SET.has(value);

export const isMinigameGoalId = (value: string): value is TMinigameGoalId =>
  MINIGAME_GOAL_ID_SET.has(value);

/**
 * Слой клетки, который кладёт элемент палитры: накладка (лёд, цепь) - поверх
 * фишки, подложка - под клеткой, всё остальное - предмет. Правило формата, а
 * не вид: по нему редактор решает, что станет с клеткой после броска.
 */
export const getMinigamePaletteLayer = (id: TMinigamePaletteId): TMinigamePaletteLayer => {
  if (id === MINIGAME_FLOOR_ID) {
    return 'floor';
  }

  return isMinigameOverlayId(id) ? 'overlay' : 'piece';
};

/** Клетка станет фишкой: фишка цвета или случайная. На неё ложится накладка. */
export const isMinigameChipLikeId = (value: string): boolean =>
  isMinigameChipId(value) || value === MINIGAME_RANDOM_ID;

export const INITIAL_MINIGAME_LEVEL_CONFIG: IMinigameLevelConfig = {
  formatVersion: LEVEL_FORMAT_VERSION,
  id: 1,
  moves: 15,
  colors: [...DEFAULT_LEVEL_COLORS],
  levelGoals: [
    { id: 'green', count: 10 },
    { id: 'red', count: 15 },
    { id: 'yellow', count: 5 },
  ],
  grid: [
    [
      { id: 'red', overlay: 'ice' },
      { id: 'red' },
      { id: 'yellow' },
      { id: 'green' },
      { id: 'red' },
      { id: 'red' },
    ],
    [
      { id: 'red' },
      { id: 'HOLE' },
      { id: 'red' },
      { id: 'red' },
      { id: 'green' },
      { id: 'yellow' },
    ],
    [
      { id: 'yellow' },
      { id: 'yellow' },
      { id: 'blue' },
      { id: 'green' },
      { id: 'yellow' },
      { id: 'red' },
    ],
    [
      { id: 'green' },
      { id: 'blue' },
      { id: 'green' },
      { id: 'yellow' },
      { id: 'green' },
      { id: 'yellow' },
    ],
    [
      { id: 'yellow' },
      { id: 'red' },
      { id: 'violet' },
      { id: 'blue' },
      { id: 'violet' },
      { id: 'yellow' },
    ],
    [
      { id: 'red' },
      { id: 'red' },
      { id: 'yellow' },
      { id: 'violet' },
      { id: 'green' },
      { id: 'green' },
    ],
  ],
};

export const cloneMinigameLevelConfig = (config: IMinigameLevelConfig): IMinigameLevelConfig => {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(config);
  }

  return JSON.parse(JSON.stringify(config)) as IMinigameLevelConfig;
};

const toPositiveInteger = (value: unknown, fallback: number): number => {
  const parsed = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const normalizeGoal = (value: Partial<IMinigameLevelGoal> | null | undefined) => ({
  id: typeof value?.id === 'string' ? value.id : '',
  count: toPositiveInteger(value?.count, 1),
});

const toInteger = (value: unknown): number | null => {
  const parsed = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;

  return Number.isFinite(parsed) ? Math.floor(parsed) : null;
};

/**
 * Клетка в формате v2. Формат v1 держал фишку подо льдом как
 * `{ id: 'ice', innerId }` - такая клетка становится фишкой с накладкой.
 * Остальное не подменяется: неизвестный предмет, слои вне границ или
 * накладка не на фишке - ошибки уровня, их показывает валидация.
 */
const normalizeCell = (value: Partial<IMinigameLevelCell> | null | undefined) => {
  const rawId = typeof value?.id === 'string' ? value.id : '';
  const isLegacyIce = rawId === 'ice';
  const cell: IMinigameLevelCell = {
    id: isLegacyIce ? (typeof value?.innerId === 'string' ? value.innerId : '') : rawId,
  };

  const layers = toInteger(value?.layers);

  if (layers !== null) {
    cell.layers = layers;
  } else if (cell.id === 'cargo') {
    cell.layers = MINIGAME_LAYER_LIMITS.cargo.fallback;
  }

  if (isLegacyIce) {
    cell.overlay = 'ice';
  } else if (typeof value?.overlay === 'string' && value.overlay.trim() !== '') {
    cell.overlay = value.overlay;
  }

  const floor = toInteger(value?.floor);

  if (floor !== null && floor !== 0) {
    cell.floor = floor;
  }

  if (typeof value?.direction === 'string') {
    cell.direction = value.direction;
  }

  return cell;
};

/**
 * Цвета уровня в каноническом виде: только фишки, без повторов, в порядке
 * `MINIGAME_CHIP_IDS`. Нет поля вовсе (уровень до появления цветов, битый
 * импорт) - `DEFAULT_LEVEL_COLORS`. Список короче `MIN_LEVEL_COLORS` намеренно не
 * подменяется: это ошибка уровня, и её показывает валидация, а не молча
 * исправляет нормализация.
 */
export const normalizeLevelColors = (value: unknown): TMinigameChipId[] => {
  if (!Array.isArray(value)) {
    return [...DEFAULT_LEVEL_COLORS];
  }

  const picked = new Set(value.filter((id): id is string => typeof id === 'string'));

  return MINIGAME_CHIP_IDS.filter((id) => picked.has(id));
};

/**
 * Пороги звёзд: пара чисел - как есть (ошибки покажет валидация), всё
 * остальное - поля нет, пороги по умолчанию.
 */
const normalizeStarScores = (value: unknown): [number, number] | undefined => {
  if (!Array.isArray(value) || value.length !== 2) {
    return undefined;
  }

  const [two, three] = value.map((item) => toInteger(item));

  return two !== null && three !== null ? [two, three] : undefined;
};

export const normalizeMinigameLevelConfig = (
  config: Partial<IMinigameLevelConfig> | null | undefined
): IMinigameLevelConfig => {
  const fallback = INITIAL_MINIGAME_LEVEL_CONFIG;
  const starScores = normalizeStarScores(config?.starScores);
  // Название не обрезается: редактор нормализует уровень на каждый символ, и
  // пробел между словами исчезал бы, не дождавшись следующего слова.
  const title =
    typeof config?.title === 'string' && config.title.trim() !== '' ? config.title : undefined;

  return {
    formatVersion: LEVEL_FORMAT_VERSION,
    id: toPositiveInteger(config?.id, fallback.id),
    ...(title ? { title } : {}),
    moves: toPositiveInteger(config?.moves, fallback.moves),
    colors: normalizeLevelColors(config?.colors),
    levelGoals:
      Array.isArray(config?.levelGoals) && config.levelGoals.length > 0
        ? config.levelGoals.map(normalizeGoal)
        : cloneMinigameLevelConfig(fallback).levelGoals,
    grid:
      Array.isArray(config?.grid) && config.grid.length > 0
        ? config.grid.map((row) => (Array.isArray(row) ? row.map(normalizeCell) : []))
        : cloneMinigameLevelConfig(fallback).grid,
    ...(starScores ? { starScores } : {}),
  };
};

/**
 * Пустое поле заданного размера.
 *
 * Ось - та же, что во всём коре: `grid[col][row]`, поэтому первым идёт число
 * колонок: `grid.length` - это колонки. Перепутанный порядок на квадратном
 * поле 6x6 не виден, а любое другое поле развернул бы.
 */
export const createEmptyMinigameGrid = (cols: number, rows: number): IMinigameLevelConfig['grid'] =>
  Array.from({ length: cols }, () => Array.from({ length: rows }, () => ({ id: '' })));

/**
 * Поле другого размера с сохранением уже расставленных клеток: то, что
 * помещается, остаётся на своих местах, новые клетки пустые - их заполняет
 * «Сгенерировать поле» или палитра редактора. Ось та же: `grid[col][row]`.
 */
export const resizeMinigameGrid = (
  grid: IMinigameLevelConfig['grid'],
  cols: number,
  rows: number
): IMinigameLevelConfig['grid'] =>
  Array.from({ length: cols }, (_, col) =>
    Array.from({ length: rows }, (_, row) => {
      const cell = grid[col]?.[row];

      return cell ? { ...cell } : { id: '' };
    })
  );

/** Клетка внизу своей колонки: ниже - только дыры или край поля. Сюда «опусти вниз» и едет. */
const isColumnExit = (column: readonly IMinigameLevelCell[], row: number): boolean =>
  column.slice(row + 1).every((cell) => cell.id === 'HOLE');

/** Сколько элементов цели стоит на поле: столько и можно собрать (они не выпадают). */
const countGoalOnField = (grid: IMinigameLevelConfig['grid'], goalId: string): number =>
  grid
    .flat()
    .filter((cell) =>
      goalId === MINIGAME_FLOOR_ID
        ? (cell.floor ?? 0) > 0
        : isMinigameOverlayId(goalId)
          ? cell.overlay === goalId
          : cell.id === goalId
    ).length;

const validateCell = (
  cell: IMinigameLevelCell,
  column: readonly IMinigameLevelCell[],
  rowIndex: number,
  position: string,
  colors: ReadonlySet<string>
): string[] => {
  const errors: string[] = [];

  if (!cell.id || !(isMinigamePieceId(cell.id) || isMinigameSpecialId(cell.id))) {
    errors.push(LEVEL_VALIDATION_TEXTS.cellInvalidElement(position));
  }

  if (cell.direction !== undefined) {
    if (cell.id !== 'laser') {
      errors.push(LEVEL_VALIDATION_TEXTS.directionNotLaser(position));
    } else if (!isMinigameLaserDirection(cell.direction)) {
      errors.push(LEVEL_VALIDATION_TEXTS.directionInvalid(position));
    }
  }

  if (isMinigameChipId(cell.id) && !colors.has(cell.id)) {
    errors.push(LEVEL_VALIDATION_TEXTS.chipColorMissing(position));
  }

  if (cell.layers !== undefined) {
    const { min, max } = MINIGAME_LAYER_LIMITS.cargo;

    if (cell.id !== 'cargo') {
      errors.push(LEVEL_VALIDATION_TEXTS.layersNotCargo(position));
    } else if (cell.layers < min || cell.layers > max) {
      errors.push(LEVEL_VALIDATION_TEXTS.cargoLayersRange(position, min, max));
    }
  }

  if (cell.overlay !== undefined) {
    if (!isMinigameOverlayId(cell.overlay)) {
      errors.push(LEVEL_VALIDATION_TEXTS.overlayUnknown(position));
    } else if (!isMinigameChipLikeId(cell.id)) {
      errors.push(LEVEL_VALIDATION_TEXTS.overlayNotOnChip(position));
    }
  }

  if (cell.floor !== undefined) {
    const { min, max } = MINIGAME_LAYER_LIMITS.floor;

    if (cell.id === 'HOLE') {
      errors.push(LEVEL_VALIDATION_TEXTS.floorUnderHole(position));
    } else if (cell.floor < min || cell.floor > max) {
      errors.push(LEVEL_VALIDATION_TEXTS.floorLayersRange(position, min, max));
    }
  }

  if (cell.id === 'drop' && isColumnExit(column, rowIndex)) {
    errors.push(LEVEL_VALIDATION_TEXTS.dropAtExit(position));
  }

  if (cell.innerId !== undefined) {
    errors.push(LEVEL_VALIDATION_TEXTS.legacyInnerId(position));
  }

  return errors;
};

/**
 * Как назвать элемент в сообщении валидации. Домен не знает подписей (они в
 * скине) и по умолчанию называет элемент кодом формата; редактор передаёт
 * подпись из скина (`getElementLabel`), `null` от неё - снова код.
 */
export interface IMinigameLevelValidationOptions {
  describeElement?: (id: string) => string | null | undefined;
}

export const validateMinigameLevelConfig = (
  config: IMinigameLevelConfig,
  options: IMinigameLevelValidationOptions = {}
): string[] => {
  const errors: string[] = [];
  const describeElement = (id: string) => options.describeElement?.(id) ?? id;

  if (!Number.isFinite(config.id) || config.id <= 0) {
    errors.push(LEVEL_VALIDATION_TEXTS.idInvalid);
  }

  if (!Number.isFinite(config.moves) || config.moves <= 0) {
    errors.push(LEVEL_VALIDATION_TEXTS.movesInvalid);
  }

  if (config.title !== undefined && config.title.length > LEVEL_TITLE_MAX_LENGTH) {
    errors.push(LEVEL_VALIDATION_TEXTS.titleTooLong(LEVEL_TITLE_MAX_LENGTH));
  }

  const colors = new Set<string>(config.colors);

  if (colors.size < MIN_LEVEL_COLORS) {
    errors.push(LEVEL_VALIDATION_TEXTS.tooFewColors(MIN_LEVEL_COLORS));
  }

  if (!Array.isArray(config.levelGoals) || config.levelGoals.length === 0) {
    errors.push(LEVEL_VALIDATION_TEXTS.noGoals);
  } else {
    config.levelGoals.forEach((goal, index) => {
      if (!isMinigameGoalId(goal.id)) {
        errors.push(LEVEL_VALIDATION_TEXTS.goalInvalidId(index + 1));
      } else if (isMinigameChipId(goal.id) && !colors.has(goal.id)) {
        errors.push(LEVEL_VALIDATION_TEXTS.goalColorMissing(index + 1, describeElement(goal.id)));
      } else if (!isMinigameChipId(goal.id) && Array.isArray(config.grid)) {
        // Нефишечные элементы не выпадают при доборе: цель «снять 10 ящиков»
        // на поле с восемью ящиками непроходима при любой игре.
        const placed = countGoalOnField(config.grid, goal.id);

        if (goal.count > placed) {
          errors.push(
            LEVEL_VALIDATION_TEXTS.goalNotEnoughOnField(
              index + 1,
              placed,
              describeElement(goal.id),
              goal.count
            )
          );
        }
      }
      if (!Number.isFinite(goal.count) || goal.count <= 0) {
        errors.push(LEVEL_VALIDATION_TEXTS.goalCountInvalid(index + 1));
      }
    });
  }

  if (config.starScores !== undefined) {
    const [two, three] = config.starScores;

    if (!(two > 0) || !(three > two)) {
      errors.push(LEVEL_VALIDATION_TEXTS.starScoresInvalid);
    }
  }

  // Ось - `grid[col][row]`: колонок столько, сколько внешних массивов, строк -
  // сколько клеток в колонке. Редактор рисует колонку вертикалью, и номера в
  // сообщениях обязаны совпадать с тем, что видит автор уровня.
  if (!Array.isArray(config.grid) || config.grid.length === 0) {
    errors.push(LEVEL_VALIDATION_TEXTS.noColumns);
    return errors;
  }

  const rows = config.grid[0]?.length ?? 0;
  if (rows === 0) {
    errors.push(LEVEL_VALIDATION_TEXTS.noRows);
  }

  const { min, max } = MINIGAME_GRID_SIZE_LIMITS;
  const isWithinLimits = (size: number) => size >= min && size <= max;

  if (!isWithinLimits(config.grid.length) || !isWithinLimits(rows)) {
    errors.push(LEVEL_VALIDATION_TEXTS.gridSizeRange(min, max));
  }

  config.grid.forEach((column, colIndex) => {
    if (!Array.isArray(column) || column.length !== rows) {
      errors.push(LEVEL_VALIDATION_TEXTS.columnLength(colIndex + 1));
      return;
    }

    column.forEach((cell, rowIndex) => {
      const position = LEVEL_VALIDATION_TEXTS.cellPosition(colIndex + 1, rowIndex + 1);

      errors.push(...validateCell(cell, column, rowIndex, position, colors));
    });
  });

  return errors;
};

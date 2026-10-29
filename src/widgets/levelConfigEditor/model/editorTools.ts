import {
  getMinigamePaletteLayer,
  isMinigameChipId,
  isMinigameChipLikeId,
  isMinigamePaletteId,
  MINIGAME_ELEMENT_IDS,
  MINIGAME_LASER_DIRECTIONS,
  type IMinigameLevelCell,
  type IMinigameLevelConfig,
  type TMinigameElementId,
  type TMinigameLaserDirection,
  type TMinigamePaletteId,
  type TMinigameSpecialId,
} from '@/entities/game';
import {
  getElementLabel,
  getSkinElement,
  type TEditorToolArea,
  type TEditorToolGroup,
} from '@/entities/skin';
import { replaceGridCell, resolveClearedCell, resolveDroppedCell } from './levelConfigGrid';
import { EDITOR_TEXTS } from './texts';

export type { TEditorToolArea, TEditorToolGroup };

/**
 * Инструменты редактора поля: элементы формата (палитра и спецфишки -
 * «хэлперы») и ластик.
 *
 * Подпись, группа, описание, фигура и схема удара - из описания элемента в
 * скине (`entities/skin`, `ISkinElement.editor`): новый элемент формата
 * появляется в палитре сам, как только у него есть запись в скине. Здесь
 * остаётся только то, что знает один редактор: инструменты по осям ракеты и
 * ластик.
 */
export type TEditorSpecialToolId =
  'laserHorizontal' | 'laserVertical' | Exclude<TMinigameSpecialId, 'laser'>;

export type TEditorToolId = TMinigamePaletteId | TEditorSpecialToolId | 'erase';

export interface IEditorTool {
  id: TEditorToolId;
  group: TEditorToolGroup;
  label: string;
  /** Слой клетки, который кладёт инструмент, человеческими словами. */
  layerLabel: string;
  description: string;
  /** Из какой фигуры спецфишка рождается в партии. */
  origin?: string;
  area?: TEditorToolArea;
}

export const EDITOR_TOOL_GROUP_LABELS: Record<TEditorToolGroup, string> = EDITOR_TEXTS.tools.groups;

/** Инструмент ракеты на каждую ось: на поле это `laser` с `direction`. */
const LASER_TOOL_IDS: Record<TMinigameLaserDirection, TEditorSpecialToolId> = {
  horizontal: 'laserHorizontal',
  vertical: 'laserVertical',
};

const ERASE_TOOL: IEditorTool = {
  id: 'erase',
  group: 'tools',
  ...EDITOR_TEXTS.tools.eraser,
};

/** Инструменты элемента: один, а у ракеты - по инструменту на ось. */
const listElementTools = (id: TMinigameElementId): IEditorTool[] => {
  if (id === 'laser') {
    const { editor, axes } = getSkinElement('laser');

    return MINIGAME_LASER_DIRECTIONS.map((direction) => ({
      id: LASER_TOOL_IDS[direction],
      group: editor.group,
      layerLabel: editor.layerLabel,
      ...axes[direction],
    }));
  }

  const { label, editor } = getSkinElement(id);

  return [
    {
      id,
      group: editor.group,
      label,
      layerLabel: editor.layerLabel,
      description: editor.description,
      ...(editor.origin ? { origin: editor.origin } : {}),
      ...(editor.area ? { area: editor.area } : {}),
    },
  ];
};

/**
 * Порядок - порядок кодов формата (`MINIGAME_ELEMENT_IDS`), группы палитры
 * берут из него свои элементы подряд; ластик - последним в «Инструментах».
 */
export const EDITOR_TOOLS: readonly IEditorTool[] = [
  ...MINIGAME_ELEMENT_IDS.flatMap(listElementTools),
  ERASE_TOOL,
];

export const EDITOR_TOOLS_BY_ID = Object.fromEntries(
  EDITOR_TOOLS.map((tool) => [tool.id, tool])
) as Record<TEditorToolId, IEditorTool>;

export const EDITOR_TOOL_GROUPS: readonly {
  group: TEditorToolGroup;
  tools: readonly IEditorTool[];
}[] = (['chips', 'helpers', 'blockers', 'tools'] as const).map((group) => ({
  group,
  tools: EDITOR_TOOLS.filter((tool) => tool.group === group),
}));

export const DEFAULT_EDITOR_TOOL_ID: TEditorToolId = 'red';

/** Фишка цвета, которого нет среди цветов уровня: на поле её ставить нельзя. */
const isUnusedChipTool = (toolId: TEditorToolId, colors: readonly string[]): boolean =>
  isMinigameChipId(toolId) && !colors.includes(toolId);

/**
 * Группы палитры для черновика: в «Фишках» - только цвета уровня
 * (`config.colors`). Фишка выключенного цвета на поле - ошибка валидации,
 * так что её плитка в палитре была бы ловушкой.
 */
export const listEditorToolGroups = (
  colors: readonly string[]
): readonly { group: TEditorToolGroup; tools: readonly IEditorTool[] }[] =>
  EDITOR_TOOL_GROUPS.map(({ group, tools }) => ({
    group,
    tools: tools.filter((tool) => !isUnusedChipTool(tool.id, colors)),
  }));

/**
 * Инструмент, которым рисует поле. Цвет выбранной фишки выключили в
 * настройках - кисть переходит на первый цвет уровня (без цветов - на «?»),
 * а не продолжает ставить фишку, которой на уровне нет. Выбор пользователя
 * при этом не теряется: включи цвет обратно - вернётся и он.
 */
export const resolveActiveToolId = (
  toolId: TEditorToolId,
  colors: readonly string[]
): TEditorToolId => {
  if (!isUnusedChipTool(toolId, colors)) {
    return toolId;
  }

  return colors.find((color) => isMinigameChipId(color)) ?? 'random';
};

/**
 * Что уронили на поле: id инструмента или `null`. На клетку можно уронить
 * что угодно - текст, файл, ссылку из другого окна; клетку меняет только
 * плитка палитры.
 */
export const parseEditorToolId = (value: string): TEditorToolId | null =>
  Object.hasOwn(EDITOR_TOOLS_BY_ID, value) ? (value as TEditorToolId) : null;

const SPECIAL_TOOL_CELLS: Record<TEditorSpecialToolId, IMinigameLevelCell> = {
  laserHorizontal: { id: 'laser', direction: 'horizontal' },
  laserVertical: { id: 'laser', direction: 'vertical' },
  bomb: { id: 'bomb' },
  propeller: { id: 'propeller' },
  rainbow: { id: 'rainbow' },
};

const isSpecialToolId = (id: TEditorToolId): id is TEditorSpecialToolId =>
  Object.hasOwn(SPECIAL_TOOL_CELLS, id);

/**
 * Элемент формата, который ставит инструмент: ракета по любой оси - `laser`.
 * У ластика элемента нет. По этому коду инструмент берёт иконку из скина.
 */
export const resolveToolElementId = (toolId: TEditorToolId): TMinigameElementId | null => {
  if (toolId === 'erase') {
    return null;
  }

  return toolId === 'laserHorizontal' || toolId === 'laserVertical' ? 'laser' : toolId;
};

/** Инструмент, которым поставлена спецфишка клетки: у ракеты он зависит от оси. */
export const resolveSpecialToolId = (cell: IMinigameLevelCell): TEditorSpecialToolId | null => {
  switch (cell.id) {
    case 'laser':
      return cell.direction === 'vertical' ? 'laserVertical' : 'laserHorizontal';
    case 'bomb':
    case 'propeller':
    case 'rainbow':
      return cell.id;
    default:
      return null;
  }
};

/**
 * Подпись предмета, накладки или подложки клетки. Спецфишка подписана тем же
 * инструментом, которым её ставят: подпись одна на палитру и подсказку поля.
 */
const describeCellLayer = (cell: IMinigameLevelCell, id: string): string => {
  if (isMinigamePaletteId(id)) {
    return getElementLabel(id) ?? id;
  }

  const specialToolId = resolveSpecialToolId({ ...cell, id });

  return specialToolId ? EDITOR_TOOLS_BY_ID[specialToolId].label : id;
};

/** Подпись клетки для подсказки: слои сверху вниз, человеческими словами. */
export const describeGridCell = (cell: IMinigameLevelCell): string => {
  const parts: string[] = [];

  if (cell.overlay) {
    parts.push(describeCellLayer(cell, cell.overlay));
  }

  if (cell.id) {
    const label = describeCellLayer(cell, cell.id);

    parts.push(cell.id === 'cargo' ? `${label} ×${cell.layers ?? 1}` : label);
  }

  if (cell.floor) {
    parts.push(`${describeCellLayer(cell, 'floor')} ×${cell.floor}`);
  }

  return parts.length > 0 ? parts.join(' / ') : EDITOR_TEXTS.tools.emptyCell;
};

/**
 * Как применяется инструмент: `click` - одиночный клик (и первая клетка
 * штриха), `stroke` - клетки, по которым провели зажатой кнопкой.
 *
 * Разница - в инструментах-переключателях: накладка повторным кликом
 * снимается, ящик и подложка листают слои. Кистью же провели, чтобы
 * поставить: проход по ряду, где на части клеток лёд уже лежит, не должен
 * его оттуда снимать.
 */
export type TEditorToolApplyMode = 'click' | 'stroke';

const strokeCell = (
  currentCell: IMinigameLevelCell,
  toolId: TMinigamePaletteId
): IMinigameLevelCell => {
  const layer = getMinigamePaletteLayer(toolId);

  if (layer === 'overlay' && currentCell.overlay === toolId) {
    return currentCell;
  }

  if (layer === 'floor' && currentCell.floor) {
    return currentCell;
  }

  if (toolId === 'cargo' && currentCell.id === 'cargo') {
    return currentCell;
  }

  return resolveDroppedCell(currentCell, toolId);
};

/**
 * Клетка после инструмента. Элементы палитры идут по правилам броска
 * (`resolveDroppedCell`), ластик - по правилу снятия слоя
 * (`resolveClearedCell`). Спецфишка - предмет: подложку сохраняет, а
 * накладку снимает - лёд и цепь лежат только на фишке.
 */
export const applyEditorTool = (
  currentCell: IMinigameLevelCell,
  toolId: TEditorToolId,
  mode: TEditorToolApplyMode = 'click'
): IMinigameLevelCell => {
  if (toolId === 'erase') {
    return resolveClearedCell(currentCell);
  }

  if (isSpecialToolId(toolId)) {
    const next: IMinigameLevelCell = { ...SPECIAL_TOOL_CELLS[toolId] };

    if (currentCell.floor) {
      next.floor = currentCell.floor;
    }

    return next;
  }

  return mode === 'stroke'
    ? strokeCell(currentCell, toolId)
    : resolveDroppedCell(currentCell, toolId);
};

/**
 * Почему инструмент на этой клетке ничего не сделает, или `null`. Накладка
 * на не-фишку не ложится, подложка - под дыру: подсказка у клетки говорит
 * об этом заранее, а не молча глотает клик.
 */
export const explainToolRefusal = (
  currentCell: IMinigameLevelCell,
  toolId: TEditorToolId
): string | null => {
  if (!isMinigamePaletteId(toolId)) {
    return null;
  }

  const layer = getMinigamePaletteLayer(toolId);
  const label = getElementLabel(toolId) ?? toolId;

  if (layer === 'overlay' && !isMinigameChipLikeId(currentCell.id)) {
    return EDITOR_TEXTS.tools.overlayRefusal(label);
  }

  if (layer === 'floor' && currentCell.id === 'HOLE') {
    return EDITOR_TEXTS.tools.floorRefusal;
  }

  return null;
};

/** Клетка поля: `col` - колонка (`grid[col]`), `row` - строка в ней. */
export interface IEditorCellPos {
  col: number;
  row: number;
}

/**
 * Поле после инструмента в клетке. Инструмент отказал - тот же конфиг
 * (`replaceGridCell`), и редактор не пишет пустой шаг истории.
 */
export const paintGridCell = (
  config: IMinigameLevelConfig,
  { col, row }: IEditorCellPos,
  toolId: TEditorToolId,
  mode: TEditorToolApplyMode
): IMinigameLevelConfig =>
  replaceGridCell(
    config,
    col,
    row,
    applyEditorTool(config.grid[col]?.[row] ?? { id: '' }, toolId, mode)
  );

/**
 * Строка под полем: координата и состав клетки под курсором, а если
 * выбранный инструмент на ней ничего не сделает - почему.
 */
export const describeCellInfo = (
  config: IMinigameLevelConfig,
  pos: IEditorCellPos | null,
  toolId: TEditorToolId
): { text: string; isRefusal: boolean } => {
  const cell = pos ? config.grid[pos.col]?.[pos.row] : undefined;

  if (!pos || !cell) {
    return { text: EDITOR_TEXTS.tools.cellInfoIdle, isRefusal: false };
  }

  const refusal = explainToolRefusal(cell, toolId);
  const text = `${pos.col}:${pos.row} · ${describeGridCell(cell)}`;

  return refusal ? { text: `${text} - ${refusal}`, isRefusal: true } : { text, isRefusal: false };
};

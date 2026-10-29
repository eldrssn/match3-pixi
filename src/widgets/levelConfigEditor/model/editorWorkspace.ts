import {
  cloneMinigameLevelConfig,
  INITIAL_MINIGAME_LEVEL_CONFIG,
  normalizeMinigameLevelConfig,
  type IMinigameLevelConfig,
} from '@/entities/game';
import {
  DEFAULT_LEVEL_PACK_ID,
  isLevelPackId,
  renumberPackLevels,
  type ILevelPack,
} from '@/entities/level';
import { EDITOR_TEXTS } from './texts';
import { STORAGE_KEYS } from '@/shared/constants';
import { isRecord } from '@/shared/lib/isRecord';
import { resolveStorage } from '@/shared/lib/storage';

/** Пак в работе у редактора: тот же пак, но с изменяемым списком уровней. */
export interface IEditorPack {
  id: string;
  title: string;
  levels: IMinigameLevelConfig[];
}

/**
 * Рабочее место редактора: черновики паков и что открыто.
 *
 * Черновик появляется у пака на первой правке. Пак репозитория без черновика
 * показывается как есть, поэтому новый уровень, пришедший в репозиторий, виден
 * сразу, пока автор его пак не трогал. Пак, которого в репозитории нет
 * (новый, импортированный), живёт только черновиком.
 */
export interface IEditorWorkspace {
  drafts: IEditorPack[];
  packId: string;
  levelIndex: number;
}

/** Черновики живут в браузере автора: бэкенда у шаблона нет, выгрузка - файлом пака. */
export const EDITOR_WORKSPACE_STORAGE_KEY = STORAGE_KEYS.editorWorkspace;

export const NEW_PACK_TITLE = EDITOR_TEXTS.workspace.newPackTitle;

const cloneLevels = (levels: readonly IMinigameLevelConfig[]): IMinigameLevelConfig[] =>
  levels.map((level) => cloneMinigameLevelConfig(level));

/** Новый уровень пака: шаблон редактора под номером позиции. */
export const createPackLevel = (id: number): IMinigameLevelConfig => ({
  ...cloneMinigameLevelConfig(INITIAL_MINIGAME_LEVEL_CONFIG),
  id,
});

export const toEditorPack = (pack: ILevelPack): IEditorPack => ({
  id: pack.id,
  title: pack.title,
  levels: cloneLevels(pack.levels),
});

export const createEditorWorkspace = (): IEditorWorkspace => ({
  drafts: [],
  packId: DEFAULT_LEVEL_PACK_ID,
  levelIndex: 0,
});

const parseEditorPack = (value: unknown): IEditorPack | null => {
  if (!isRecord(value) || typeof value.id !== 'string' || !Array.isArray(value.levels)) {
    return null;
  }

  const levels = value.levels.map((level) =>
    normalizeMinigameLevelConfig(isRecord(level) ? (level as Partial<IMinigameLevelConfig>) : {})
  );

  return {
    id: value.id,
    title: typeof value.title === 'string' ? value.title : '',
    levels: levels.length > 0 ? levels : [createPackLevel(1)],
  };
};

/**
 * Рабочее место из произвольного JSON: битая запись - пустое рабочее место,
 * а не упавший редактор. Уровни проходят нормализацию, как при импорте.
 */
export const parseEditorWorkspace = (value: unknown): IEditorWorkspace => {
  if (!isRecord(value)) {
    return createEditorWorkspace();
  }

  const drafts = Array.isArray(value.drafts)
    ? value.drafts.map(parseEditorPack).filter((pack): pack is IEditorPack => pack !== null)
    : [];
  const levelIndex = Number(value.levelIndex);

  return {
    drafts,
    packId: typeof value.packId === 'string' ? value.packId : DEFAULT_LEVEL_PACK_ID,
    levelIndex: Number.isInteger(levelIndex) && levelIndex >= 0 ? levelIndex : 0,
  };
};

export const readEditorWorkspace = (storage = resolveStorage()): IEditorWorkspace => {
  try {
    const raw = storage?.getItem(EDITOR_WORKSPACE_STORAGE_KEY);

    return raw ? parseEditorWorkspace(JSON.parse(raw)) : createEditorWorkspace();
  } catch {
    return createEditorWorkspace();
  }
};

export const writeEditorWorkspace = (
  workspace: IEditorWorkspace,
  storage = resolveStorage()
): void => {
  try {
    storage?.setItem(EDITOR_WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
  } catch {
    // Переполнение хранилища: черновик этой сессии остаётся в памяти.
  }
};

const findDraft = (workspace: IEditorWorkspace, packId: string): IEditorPack | null =>
  workspace.drafts.find((draft) => draft.id === packId) ?? null;

const findRepoPack = (repoPacks: readonly ILevelPack[], packId: string): ILevelPack | null =>
  repoPacks.find((pack) => pack.id === packId) ?? null;

/**
 * Открытый пак: черновик, иначе пак репозитория, иначе (черновик пропал,
 * пак удалили из репозитория) - пак главной.
 */
export const resolveActivePack = (
  workspace: IEditorWorkspace,
  repoPacks: readonly ILevelPack[]
): IEditorPack => {
  const draft = findDraft(workspace, workspace.packId);

  if (draft) {
    return draft;
  }

  const repoPack =
    findRepoPack(repoPacks, workspace.packId) ?? findRepoPack(repoPacks, DEFAULT_LEVEL_PACK_ID);

  return repoPack
    ? { id: repoPack.id, title: repoPack.title, levels: [...repoPack.levels] }
    : { id: DEFAULT_LEVEL_PACK_ID, title: NEW_PACK_TITLE, levels: [createPackLevel(1)] };
};

/** Индекс открытого уровня в границах пака. */
export const resolveActiveLevelIndex = (workspace: IEditorWorkspace, pack: IEditorPack): number =>
  Math.min(Math.max(workspace.levelIndex, 0), pack.levels.length - 1);

export interface IEditorPackOption {
  id: string;
  title: string;
  /** Пак есть в репозитории (`entities/level/packs`). */
  isInRepo: boolean;
  /** У пака есть несохранённый в репозиторий черновик. */
  hasDraft: boolean;
}

/** Пункты выбора пака: паки репозитория по порядку каталога, затем новые. */
export const listEditorPackOptions = (
  workspace: IEditorWorkspace,
  repoPacks: readonly ILevelPack[]
): IEditorPackOption[] => [
  ...repoPacks.map((pack) => {
    const draft = findDraft(workspace, pack.id);

    return { id: pack.id, title: draft?.title ?? pack.title, isInRepo: true, hasDraft: !!draft };
  }),
  ...workspace.drafts
    .filter((draft) => !findRepoPack(repoPacks, draft.id))
    .map((draft) => ({ id: draft.id, title: draft.title, isInRepo: false, hasDraft: true })),
];

/**
 * Правка открытого пака. Пак без черновика получает его здесь - копией
 * репозитория, чтобы правка не задела общие объекты каталога. Номера уровней
 * после правки - снова по позиции.
 */
export const updateActivePack = (
  workspace: IEditorWorkspace,
  repoPacks: readonly ILevelPack[],
  update: (pack: IEditorPack) => IEditorPack
): IEditorWorkspace => {
  const current = resolveActivePack(workspace, repoPacks);
  const hasDraft = findDraft(workspace, current.id) !== null;
  const base = hasDraft ? current : { ...current, levels: cloneLevels(current.levels) };
  const next = update(base);
  const nextPack = { ...next, levels: renumberPackLevels(next.levels) };

  return {
    ...workspace,
    packId: nextPack.id,
    drafts: hasDraft
      ? workspace.drafts.map((draft) => (draft.id === current.id ? nextPack : draft))
      : [...workspace.drafts, nextPack],
  };
};

/** Правка открытого уровня; номер уровня остаётся его позицией. */
export const replaceActiveLevel = (
  workspace: IEditorWorkspace,
  repoPacks: readonly ILevelPack[],
  level: IMinigameLevelConfig
): IEditorWorkspace =>
  updateActivePack(workspace, repoPacks, (pack) => {
    const index = resolveActiveLevelIndex(workspace, pack);

    return { ...pack, levels: pack.levels.map((item, i) => (i === index ? level : item)) };
  });

const insertAt = <T>(items: readonly T[], index: number, item: T): T[] => [
  ...items.slice(0, index),
  item,
  ...items.slice(index),
];

/** Новый уровень сразу после открытого - и он становится открытым. */
export const addPackLevel = (
  workspace: IEditorWorkspace,
  repoPacks: readonly ILevelPack[]
): IEditorWorkspace => {
  const index = resolveActiveLevelIndex(workspace, resolveActivePack(workspace, repoPacks)) + 1;

  return {
    ...updateActivePack(workspace, repoPacks, (pack) => ({
      ...pack,
      levels: insertAt(pack.levels, index, createPackLevel(index + 1)),
    })),
    levelIndex: index,
  };
};

/** Копия открытого уровня сразу за ним - основа для следующего уровня. */
export const duplicatePackLevel = (
  workspace: IEditorWorkspace,
  repoPacks: readonly ILevelPack[]
): IEditorWorkspace => {
  const active = resolveActivePack(workspace, repoPacks);
  const index = resolveActiveLevelIndex(workspace, active);
  const copy = cloneMinigameLevelConfig(active.levels[index]);

  return {
    ...updateActivePack(workspace, repoPacks, (pack) => ({
      ...pack,
      levels: insertAt(pack.levels, index + 1, copy),
    })),
    levelIndex: index + 1,
  };
};

/** Сдвиг открытого уровня на `delta` позиций; за край пака - без изменений. */
export const movePackLevel = (
  workspace: IEditorWorkspace,
  repoPacks: readonly ILevelPack[],
  delta: -1 | 1
): IEditorWorkspace => {
  const active = resolveActivePack(workspace, repoPacks);
  const index = resolveActiveLevelIndex(workspace, active);
  const target = index + delta;

  if (target < 0 || target >= active.levels.length) {
    return workspace;
  }

  return {
    ...updateActivePack(workspace, repoPacks, (pack) => {
      const levels = [...pack.levels];
      [levels[index], levels[target]] = [levels[target], levels[index]];

      return { ...pack, levels };
    }),
    levelIndex: target,
  };
};

/** Удаление открытого уровня. Последний уровень пака не удаляется: пак без уровней не играется. */
export const removePackLevel = (
  workspace: IEditorWorkspace,
  repoPacks: readonly ILevelPack[]
): IEditorWorkspace => {
  const active = resolveActivePack(workspace, repoPacks);

  if (active.levels.length <= 1) {
    return workspace;
  }

  const index = resolveActiveLevelIndex(workspace, active);

  return {
    ...updateActivePack(workspace, repoPacks, (pack) => ({
      ...pack,
      levels: pack.levels.filter((_, i) => i !== index),
    })),
    levelIndex: Math.min(index, active.levels.length - 2),
  };
};

/**
 * Можно ли дать открытому паку id `nextId`: id по формату пака
 * (`isLevelPackId`) и не занят ни репозиторием, ни другим черновиком. Пак
 * репозитория переименовать нельзя: его id - папка в репозитории и ключ
 * прогресса игроков.
 *
 * Открытый пак - разрешённый (`resolveActivePack`), а не сырой `packId`:
 * `packId` пропавшего пака показывает пак главной, и его «переименование»
 * создало бы копию главной под новым id.
 */
export const canRenamePack = (
  workspace: IEditorWorkspace,
  repoPacks: readonly ILevelPack[],
  nextId: string
): boolean => {
  const currentId = resolveActivePack(workspace, repoPacks).id;

  if (findRepoPack(repoPacks, currentId)) {
    return false;
  }

  return (
    nextId === currentId ||
    (isLevelPackId(nextId) && !findRepoPack(repoPacks, nextId) && !findDraft(workspace, nextId))
  );
};

/** Новый пак с одним уровнем-шаблоном: id `pack-N`, не занятый ни репозиторием, ни черновиками. */
export const createEditorPack = (
  workspace: IEditorWorkspace,
  repoPacks: readonly ILevelPack[]
): IEditorWorkspace => {
  const taken = new Set([
    ...repoPacks.map((pack) => pack.id),
    ...workspace.drafts.map((d) => d.id),
  ]);
  let number = 2;

  while (taken.has(`pack-${number}`)) {
    number += 1;
  }

  const pack: IEditorPack = {
    id: `pack-${number}`,
    title: NEW_PACK_TITLE,
    levels: [createPackLevel(1)],
  };

  return { drafts: [...workspace.drafts, pack], packId: pack.id, levelIndex: 0 };
};

/**
 * Импортированный пак - черновиком под своим id: черновик того же пака
 * заменяется, пак репозитория остаётся нетронутым до `levels:import`.
 */
export const importEditorPack = (
  workspace: IEditorWorkspace,
  pack: ILevelPack
): IEditorWorkspace => ({
  drafts: [...workspace.drafts.filter((draft) => draft.id !== pack.id), toEditorPack(pack)],
  packId: pack.id,
  levelIndex: 0,
});

/**
 * Отказ от черновика открытого пака: пак репозитория возвращается к версии из
 * репозитория, новый пак исчезает, и открывается пак главной.
 */
export const discardPackDraft = (
  workspace: IEditorWorkspace,
  repoPacks: readonly ILevelPack[]
): IEditorWorkspace => {
  const isInRepo = findRepoPack(repoPacks, workspace.packId) !== null;

  return {
    drafts: workspace.drafts.filter((draft) => draft.id !== workspace.packId),
    packId: isInRepo ? workspace.packId : DEFAULT_LEVEL_PACK_ID,
    levelIndex: isInRepo ? workspace.levelIndex : 0,
  };
};

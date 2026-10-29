import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { IMinigameLevelConfig } from '@/entities/game';
import {
  isLevelPackId,
  LEVEL_PACKS,
  parseLevelPackFile,
  toLevelPackFile,
  validateLevelPack,
} from '@/entities/level';
import { getElementLabel } from '@/entities/skin';
import {
  addPackLevel,
  canRenamePack,
  createEditorPack,
  discardPackDraft,
  duplicatePackLevel,
  importEditorPack,
  listEditorPackOptions,
  movePackLevel,
  readEditorWorkspace,
  removePackLevel,
  replaceActiveLevel,
  resolveActiveLevelIndex,
  resolveActivePack,
  updateActivePack,
  writeEditorWorkspace,
  type IEditorWorkspace,
} from './editorWorkspace';
import { downloadJsonFile, packFileName } from './jsonFile';
import { EDITOR_TEXTS } from './texts';
import type { TEditorNotify } from './useEditorToast';

/**
 * Пауза перед записью рабочего места в `localStorage`: штрих кисти - десятки
 * правок подряд, а запись - сериализация всех черновиков целиком.
 */
export const EDITOR_WORKSPACE_SAVE_DELAY_MS = 300;

/** Открыт другой уровень: `play` - сразу играть его в превью, если он валиден. */
export type TOpenLevelHandler = (level: IMinigameLevelConfig, options: { play: boolean }) => void;

/** Отложенная запись, если она есть: закрытие вкладки и размонтирование редактора. */
const flushPendingWorkspace = (pendingRef: RefObject<IEditorWorkspace | null>) => {
  if (pendingRef.current) {
    writeEditorWorkspace(pendingRef.current);
    pendingRef.current = null;
  }
};

/**
 * Рабочее место редактора (`editorWorkspace`): черновики паков, открытый пак
 * и уровень, их запись в `localStorage` и операции над паком.
 *
 * Запись отложена на `EDITOR_WORKSPACE_SAVE_DELAY_MS` после последней правки
 * и доводится немедленно на `pagehide` и размонтировании - правка не теряется.
 * Переход к другому уровню хук только сообщает (`onOpenLevel`): историю, поле
 * JSON и превью ведёт редактор.
 */
export const useEditorWorkspace = ({
  notify,
  onOpenLevel,
}: {
  notify: TEditorNotify;
  onOpenLevel: TOpenLevelHandler;
}) => {
  const [workspace, setWorkspace] = useState<IEditorWorkspace>(readEditorWorkspace);
  const pack = useMemo(() => resolveActivePack(workspace, LEVEL_PACKS), [workspace]);
  const levelIndex = resolveActiveLevelIndex(workspace, pack);
  const editConfig = pack.levels[levelIndex];
  const packOptions = useMemo(() => listEditorPackOptions(workspace, LEVEL_PACKS), [workspace]);
  const activePackOption = packOptions.find((option) => option.id === pack.id);
  const packErrors = useMemo(
    () => validateLevelPack(pack, { describeElement: getElementLabel }),
    [pack]
  );
  const pendingRef = useRef<IEditorWorkspace | null>(null);

  useEffect(() => {
    pendingRef.current = workspace;

    const timer = window.setTimeout(
      () => flushPendingWorkspace(pendingRef),
      EDITOR_WORKSPACE_SAVE_DELAY_MS
    );

    return () => window.clearTimeout(timer);
  }, [workspace]);

  useEffect(() => {
    const handlePageHide = () => flushPendingWorkspace(pendingRef);

    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      flushPendingWorkspace(pendingRef);
    };
  }, []);

  /** Уровень в черновик пака - без истории и без перехода. */
  const replaceLevel = (config: IMinigameLevelConfig) => {
    setWorkspace((current) => replaceActiveLevel(current, LEVEL_PACKS, config));
  };

  /** Переход к другому уровню или паку. */
  const navigate = (next: IEditorWorkspace) => {
    const nextPack = resolveActivePack(next, LEVEL_PACKS);

    setWorkspace(next);
    onOpenLevel(nextPack.levels[resolveActiveLevelIndex(next, nextPack)], { play: true });
  };

  const openLevel = (index: number) => {
    if (index !== levelIndex) {
      navigate({ ...workspace, levelIndex: index });
    }
  };

  const openPack = (packId: string) => {
    if (packId !== pack.id) {
      navigate({ ...workspace, packId, levelIndex: 0 });
    }
  };

  const addLevel = () => {
    navigate(addPackLevel(workspace, LEVEL_PACKS));
    notify('success', EDITOR_TEXTS.toasts.levelAdded(levelIndex + 2));
  };

  const duplicateLevel = () => {
    navigate(duplicatePackLevel(workspace, LEVEL_PACKS));
    notify('success', EDITOR_TEXTS.toasts.levelDuplicated(levelIndex + 1, levelIndex + 2));
  };

  const moveLevel = (delta: -1 | 1) => {
    const next = movePackLevel(workspace, LEVEL_PACKS, delta);

    // Сдвиг не трогает уровень, поэтому превью не перезапускается.
    if (next !== workspace) {
      setWorkspace(next);
      onOpenLevel({ ...editConfig, id: next.levelIndex + 1 }, { play: false });
    }
  };

  const removeLevel = () => {
    if (pack.levels.length <= 1) {
      notify('error', EDITOR_TEXTS.toasts.lastLevel);
      return;
    }

    navigate(removePackLevel(workspace, LEVEL_PACKS));
    notify('success', EDITOR_TEXTS.toasts.levelRemoved(levelIndex + 1));
  };

  const setPackTitle = (title: string) => {
    setWorkspace((current) =>
      updateActivePack(current, LEVEL_PACKS, (draft) => ({ ...draft, title }))
    );
  };

  /**
   * Новый id пака - по завершении ввода (blur, Enter). Неверный, занятый или
   * чужой id не принимается: тост, и поле возвращает прежний id.
   */
  const renamePack = (nextId: string) => {
    if (!isLevelPackId(nextId)) {
      notify('error', EDITOR_TEXTS.toasts.packIdInvalid(nextId));
      return;
    }

    if (!canRenamePack(workspace, LEVEL_PACKS, nextId)) {
      notify('error', EDITOR_TEXTS.toasts.packIdTaken(nextId));
      return;
    }

    setWorkspace((current) =>
      updateActivePack(current, LEVEL_PACKS, (draft) => ({ ...draft, id: nextId }))
    );
  };

  const createPack = () => {
    navigate(createEditorPack(workspace, LEVEL_PACKS));
    notify('success', EDITOR_TEXTS.toasts.packCreated);
  };

  const discardDraft = () => {
    const isInRepo = activePackOption?.isInRepo ?? false;

    navigate(discardPackDraft(workspace, LEVEL_PACKS));
    notify(
      'success',
      isInRepo ? EDITOR_TEXTS.toasts.packReverted : EDITOR_TEXTS.toasts.packRemoved
    );
  };

  /** Файл пака для `npm run levels:import`. С ошибками тоже: это ещё и бэкап работы. */
  const exportPack = () => {
    downloadJsonFile(packFileName(pack.id), toLevelPackFile(pack));

    if (packErrors.length > 0) {
      notify('error', EDITOR_TEXTS.toasts.packExportedWithErrors(packErrors.length));
    } else {
      notify('success', EDITOR_TEXTS.toasts.packExported(packFileName(pack.id)));
    }
  };

  /** Файл пака - в черновик под его id; пак репозитория меняет только `levels:import`. */
  const importPack = (text: string) => {
    let parsed: ReturnType<typeof parseLevelPackFile>;

    try {
      parsed = parseLevelPackFile(JSON.parse(text), { describeElement: getElementLabel });
    } catch (error) {
      notify('error', EDITOR_TEXTS.toasts.fileUnreadable((error as Error).message));
      return;
    }

    const { pack: imported, errors } = parsed;

    if (!imported || !isLevelPackId(imported.id)) {
      notify('error', errors[0] ?? EDITOR_TEXTS.toasts.notPackFile);
      return;
    }

    navigate(importEditorPack(workspace, imported));

    if (errors.length > 0) {
      notify('error', EDITOR_TEXTS.toasts.packImportedWithErrors(imported.title, errors.length));
    } else {
      notify('success', EDITOR_TEXTS.toasts.packImported(imported.title));
    }
  };

  return {
    pack,
    packOptions,
    activePackOption,
    packErrors,
    levelIndex,
    editConfig,
    replaceLevel,
    openLevel,
    openPack,
    addLevel,
    duplicateLevel,
    moveLevel,
    removeLevel,
    setPackTitle,
    renamePack,
    createPack,
    discardDraft,
    exportPack,
    importPack,
  };
};

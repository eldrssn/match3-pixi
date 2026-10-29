import { useMemo, useState } from 'react';
import {
  cloneMinigameLevelConfig,
  createEmptyMinigameGrid,
  generateMinigameLevelGrid,
  INITIAL_MINIGAME_LEVEL_CONFIG,
  normalizeMinigameLevelConfig,
  readMinigameGridSize,
  regenerateMinigameGridChips,
  validateMinigameLevelConfig,
  type IMinigameGridGeneration,
  type IMinigameLevelConfig,
} from '@/entities/game';
import { getElementLabel } from '@/entities/skin';
import { randomizeGridChips } from './levelConfigGrid';
import { EDITOR_TEXTS } from './texts';
import { useConfigHistory } from './useConfigHistory';
import { useEditorToast } from './useEditorToast';
import { useEditorWorkspace, type TOpenLevelHandler } from './useEditorWorkspace';
import { useLevelJson } from './useLevelJson';

/** Конфиг для превью - только валидный: на битом уровне партия не запускается. */
const toPlayableConfig = (config: IMinigameLevelConfig): IMinigameLevelConfig | null =>
  validateMinigameLevelConfig(config).length === 0 ? cloneMinigameLevelConfig(config) : null;

/**
 * Состояние редактора: пак целиком (`useEditorWorkspace`, черновики паков в
 * `localStorage`), открытый уровень, история его правок, поле JSON
 * (`useLevelJson`), тост (`useEditorToast`) и применённый к превью конфиг.
 * Сам хук - сборка этих частей и правки уровня поверх них.
 *
 * Правка уровня пишется прямо в черновик пака - отдельной копии «уровня в
 * работе» нет, поэтому переключение уровня ничего не теряет. История правок
 * у открытого уровня своя и при переключении забывается.
 *
 * `appliedConfig` - `null`, пока к превью не применён валидный уровень (черновик
 * из `localStorage` с ошибками): превью тогда не монтирует партию.
 */
export const useLevelConfigEditor = () => {
  const { toast, notify } = useEditorToast();
  // Переход зовут только обработчики событий, к тому времени вызов ниже уже
  // объявлен: обёртка разрывает цикл «рабочее место -> история -> рабочее место».
  const handleOpenLevel: TOpenLevelHandler = (level, options) => openLevelInEditor(level, options);
  const {
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
  } = useEditorWorkspace({ notify, onOpenLevel: handleOpenLevel });
  const json = useLevelJson(editConfig, notify);
  const [appliedConfig, setAppliedConfig] = useState<IMinigameLevelConfig | null>(() =>
    toPlayableConfig(editConfig)
  );
  const [appliedConfigRevision, setAppliedConfigRevision] = useState(0);

  const validationErrors = useMemo(
    () => validateMinigameLevelConfig(editConfig, { describeElement: getElementLabel }),
    [editConfig]
  );

  /** Уровень в черновик пака без записи в историю: сама отмена и повтор. */
  const showConfig = (config: IMinigameLevelConfig) => {
    replaceLevel(config);
    json.showJson({ ...config, id: levelIndex + 1 });
  };

  const { record, undo, redo, reset, canUndo, canRedo } = useConfigHistory(editConfig, showConfig);

  /**
   * Открыт другой уровень (или пак): история забывается, JSON показывает его,
   * а превью сразу играет его - если он валиден. Открыть уровень, чтобы
   * поиграть, - самый частый повод его открыть.
   */
  const openLevelInEditor: TOpenLevelHandler = (level, { play }) => {
    reset();
    json.showJson(level);

    const playable = play ? toPlayableConfig(level) : null;

    if (playable) {
      setAppliedConfig(playable);
      setAppliedConfigRevision((revision) => revision + 1);
    }
  };

  /**
   * Правка черновика. `merge` - продолжение предыдущей правки (следующая
   * клетка штриха кисти): отмена откатит весь штрих разом. Тот же конфиг -
   * правки не было (инструмент отказал), и шаг в историю не пишется.
   */
  const updateEditConfig = (
    nextConfig: IMinigameLevelConfig,
    { merge = false }: { merge?: boolean } = {}
  ) => {
    if (nextConfig === editConfig) {
      return;
    }

    record(merge);
    showConfig(normalizeMinigameLevelConfig(nextConfig));
  };

  const applyConfig = () => {
    if (json.jsonError) {
      notify('error', EDITOR_TEXTS.toasts.fixJson);
      return false;
    }

    if (validationErrors.length > 0) {
      notify('error', EDITOR_TEXTS.toasts.fixErrors);
      return false;
    }

    setAppliedConfig(cloneMinigameLevelConfig(editConfig));
    setAppliedConfigRevision((revision) => revision + 1);
    notify('success', EDITOR_TEXTS.toasts.applied);
    return true;
  };

  const restartPreview = () => {
    setAppliedConfigRevision((revision) => revision + 1);
  };

  /**
   * Что сказать про сгенерированное поле.
   *
   * Генератор не всегда может выполнить цели буквально: под «собрать 40
   * блокеров» на поле 6x6 просто нет места, а на доске, изрезанной блокерами,
   * может не остаться ни одного хода. Молчать об этом нельзя - автор уровня
   * увидит нормальное на вид поле и узнает о проблеме только в превью.
   */
  const notifyGeneratedGrid = (generation: IMinigameGridGeneration) => {
    if (!generation.hasMove) {
      notify('error', EDITOR_TEXTS.toasts.generatedNoMove);
      return;
    }

    if (generation.skippedGoalCells > 0) {
      notify('error', EDITOR_TEXTS.toasts.generatedSkippedGoals(generation.skippedGoalCells));
      return;
    }

    notify('success', EDITOR_TEXTS.toasts.generated);
  };

  const generateGrid = () => {
    const generation = generateMinigameLevelGrid(editConfig);

    updateEditConfig({ ...editConfig, grid: generation.grid });
    notifyGeneratedGrid(generation);
  };

  /** Новые цвета только обычным фишкам: дыры, блокеры, накладки и спецфишки на месте. */
  const regenerateChips = () => {
    const generation = regenerateMinigameGridChips(editConfig);

    updateEditConfig({ ...editConfig, grid: generation.grid });

    if (generation.hasMove) {
      notify('success', EDITOR_TEXTS.toasts.chipsRegenerated);
    } else {
      notify('error', EDITOR_TEXTS.toasts.chipsRegeneratedNoMove);
    }
  };

  const randomizeChips = () => {
    updateEditConfig({ ...editConfig, grid: randomizeGridChips(editConfig.grid) });
    notify('success', EDITOR_TEXTS.toasts.chipsRandomized);
  };

  const clearGrid = () => {
    const { cols, rows } = readMinigameGridSize(editConfig);

    updateEditConfig({ ...editConfig, grid: createEmptyMinigameGrid(cols, rows) });
  };

  /** Уровень - к шаблону редактора; название остаётся. */
  const resetDraft = () => {
    const { title } = editConfig;

    updateEditConfig({
      ...cloneMinigameLevelConfig(INITIAL_MINIGAME_LEVEL_CONFIG),
      id: editConfig.id,
      ...(title ? { title } : {}),
    });
    notify('success', EDITOR_TEXTS.toasts.levelReset);
  };

  /** Набор в поле JSON: разобравшийся текст - правка черновика, непрерывный набор - один шаг. */
  const importJson = (text: string) => {
    const edit = json.importJson(text);

    if (edit) {
      record(edit.merge);
      replaceLevel(edit.config);
    }
  };

  return {
    pack,
    packOptions,
    activePackOption,
    packErrors,
    levelIndex,
    editConfig,
    appliedConfig,
    appliedConfigRevision,
    jsonText: json.jsonText,
    jsonError: json.jsonError,
    validationErrors,
    toast,
    canUndo,
    canRedo,
    updateEditConfig,
    undo,
    redo,
    generateGrid,
    regenerateChips,
    randomizeChips,
    clearGrid,
    applyConfig,
    restartPreview,
    resetDraft,
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
    importJson,
    copyJson: json.copyJson,
    downloadJson: json.downloadJson,
  };
};

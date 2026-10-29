import clsx from 'clsx';
import { useRef, useState, type CSSProperties } from 'react';
import {
  DEFAULT_EDITOR_TOOL_ID,
  resolveActiveToolId,
  type TEditorToolId,
} from '../model/editorTools';
import { useEditorColumnWidths } from '../model/useEditorColumnWidths';
import { describeLevel } from '../model/levelLabels';
import { useLevelConfigEditor } from '../model/useLevelConfigEditor';
import { usePreviewSession } from '../model/usePreviewSession';
import { LevelConfigBasicsSection } from './LevelConfigBasicsSection';
import { LevelConfigBotSection } from './LevelConfigBotSection';
import { LevelConfigColumnSplitter } from './LevelConfigColumnSplitter';
import { LevelConfigGoalsSection } from './LevelConfigGoalsSection';
import { LevelConfigGridSection } from './LevelConfigGridSection';
import { LevelConfigJsonSection } from './LevelConfigJsonSection';
import { LevelConfigLevelList } from './LevelConfigLevelList';
import { LevelConfigPackSection } from './LevelConfigPackSection';
import { LevelConfigPaletteSection } from './LevelConfigPaletteSection';
import { LevelConfigPreview } from './LevelConfigPreview';
import { LevelConfigPreviewControls } from './LevelConfigPreviewControls';
import { LevelConfigStarsSection } from './LevelConfigStarsSection';
import { LevelConfigToolCard } from './LevelConfigToolCard';
import { EDITOR_TEXTS } from '../model/texts';
import styles from './LevelConfigEditor.module.scss';

/**
 * Конструктор паков уровней для геймдизайнера. Шапка - сводка открытого
 * уровня и главные действия; под ней три колонки: пак (выбор, экспорт и
 * импорт файлом, список уровней) и настройки уровня, рабочее место (палитра,
 * описание элемента, поле и под ним настройки превью) и превью - настоящий
 * экран партии на применённом конфиге. Палитра и поле
 * стоят рядом, чтобы расставлять элементы, не прокручивая страницу. Ширину
 * боковых колонок тянут разделители (`useEditorColumnWidths`), поле берёт
 * остаток.
 *
 * Сам компонент - только раскладка и проводка хука в секции; правки конфига
 * живут в секциях, состояние черновика - в `useLevelConfigEditor`, выбранный
 * инструмент и сессия превью - здесь: инструмент делят палитра, карточка и
 * поле, сессию - настройки превью под полем и партия в колонке превью.
 */
export const LevelConfigEditor = () => {
  const {
    pack,
    packOptions,
    activePackOption,
    packErrors,
    levelIndex,
    editConfig,
    appliedConfig,
    appliedConfigRevision,
    jsonText,
    jsonError,
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
    copyJson,
    downloadJson,
  } = useLevelConfigEditor();
  const previewSession = usePreviewSession(appliedConfigRevision);
  const [toolId, setToolId] = useState<TEditorToolId>(DEFAULT_EDITOR_TOOL_ID);
  const [hoveredToolId, setHoveredToolId] = useState<TEditorToolId | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const { widths, resizeColumn, resetColumn } = useEditorColumnWidths(rootRef);
  const columnStyle = {
    '--editor-settings-width': `${widths.settings}px`,
    '--editor-preview-width': `${widths.preview}px`,
  } as CSSProperties;

  const activeToolId = resolveActiveToolId(toolId, editConfig.colors);
  const errorCount = validationErrors.length;

  return (
    <main ref={rootRef} className={styles.root} style={columnStyle}>
      <header className={styles.header}>
        <h1 className={styles.title}>{EDITOR_TEXTS.header.title}</h1>
        <span className={styles.summary}>
          {pack.title || pack.id} · {describeLevel(levelIndex + 1, editConfig)}
        </span>
        {errorCount > 0 && (
          <a className={styles.errorBadge} href="#level-config-errors">
            {EDITOR_TEXTS.labels.errorCount(errorCount)}
          </a>
        )}
        <div className={styles.headerActions}>
          <button type="button" className={styles.buttonSecondary} onClick={resetDraft}>
            {EDITOR_TEXTS.header.resetLevel}
          </button>
          <button type="button" className={styles.button} onClick={applyConfig}>
            {EDITOR_TEXTS.header.apply}
          </button>
        </div>
      </header>

      <aside className={styles.settingsPane} aria-label={EDITOR_TEXTS.header.settingsAria}>
        <LevelConfigPackSection
          pack={pack}
          options={packOptions}
          activeOption={activePackOption}
          errors={packErrors}
          onOpen={openPack}
          onCreate={createPack}
          onTitleChange={setPackTitle}
          onRename={renamePack}
          onExport={exportPack}
          onImport={importPack}
          onDiscard={discardDraft}
        />
        <LevelConfigLevelList
          levels={pack.levels}
          activeIndex={levelIndex}
          onOpen={openLevel}
          onAdd={addLevel}
          onDuplicate={duplicateLevel}
          onMove={moveLevel}
          onRemove={removeLevel}
        />
        <LevelConfigBasicsSection config={editConfig} onChange={updateEditConfig} />
        <LevelConfigGoalsSection config={editConfig} onChange={updateEditConfig} />
        <LevelConfigStarsSection config={editConfig} onChange={updateEditConfig} />
        {/* Результат бота - одного уровня: другой уровень начинает с чистой секции. */}
        <LevelConfigBotSection
          key={`${pack.id}:${levelIndex}`}
          config={editConfig}
          onChange={updateEditConfig}
        />
        <LevelConfigJsonSection
          jsonText={jsonText}
          jsonError={jsonError}
          onImport={importJson}
          onCopy={copyJson}
          onDownload={downloadJson}
        />
      </aside>

      <LevelConfigColumnSplitter
        column="settings"
        className={styles.settingsSplitter}
        width={widths.settings}
        label={EDITOR_TEXTS.header.settingsSplitter}
        onResize={resizeColumn}
        onReset={resetColumn}
      />

      <section className={styles.workspace} aria-label={EDITOR_TEXTS.header.workspaceAria}>
        <LevelConfigPaletteSection
          colors={editConfig.colors}
          selectedToolId={activeToolId}
          onSelect={setToolId}
          onHover={setHoveredToolId}
        />
        <div className={styles.board}>
          <LevelConfigToolCard selectedToolId={activeToolId} hoveredToolId={hoveredToolId} />
          <LevelConfigGridSection
            config={editConfig}
            toolId={activeToolId}
            canUndo={canUndo}
            canRedo={canRedo}
            onChange={updateEditConfig}
            onUndo={undo}
            onRedo={redo}
            onRegenerateChips={regenerateChips}
            onGenerate={generateGrid}
            onRandomize={randomizeChips}
            onClear={clearGrid}
          />
          {errorCount > 0 && (
            <section
              id="level-config-errors"
              className={styles.errors}
              aria-label={EDITOR_TEXTS.header.errorsAria}
            >
              {validationErrors.map((error) => (
                <div key={error}>{error}</div>
              ))}
            </section>
          )}
          <LevelConfigPreviewControls
            options={previewSession.options}
            seedText={previewSession.seedText}
            onOptionsChange={previewSession.updateOptions}
            onSeedTextChange={previewSession.setSeedText}
            onSeedCommit={previewSession.commitSeed}
            onRestart={restartPreview}
          />
        </div>
      </section>

      <LevelConfigColumnSplitter
        column="preview"
        className={styles.previewSplitter}
        width={widths.preview}
        label={EDITOR_TEXTS.header.previewSplitter}
        onResize={resizeColumn}
        onReset={resetColumn}
      />

      <section className={styles.previewPane} aria-label={EDITOR_TEXTS.header.previewPaneAria}>
        <LevelConfigPreview config={appliedConfig} session={previewSession} />
      </section>

      {toast && (
        <div
          className={clsx(styles.toast, toast.type === 'error' && styles.toastError)}
          role="status"
        >
          {toast.text}
        </div>
      )}
    </main>
  );
};

export default LevelConfigEditor;

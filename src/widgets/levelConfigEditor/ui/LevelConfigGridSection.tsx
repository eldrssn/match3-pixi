import clsx from 'clsx';
import type { IMinigameLevelConfig } from '@/entities/game';
import { getElementIcon } from '@/entities/skin';
import {
  describeCellInfo,
  describeGridCell,
  EDITOR_TOOLS_BY_ID,
  resolveSpecialToolId,
  type TEditorToolId,
} from '../model/editorTools';
import { useGridBrush } from '../model/useGridBrush';
import { EditorToolIcon } from './EditorToolIcon';
import { LevelConfigGridActions } from './LevelConfigGridActions';
import { EDITOR_TEXTS } from '../model/texts';
import styles from './LevelConfigGridSection.module.scss';

type LevelConfigGridSectionProps = Readonly<{
  config: IMinigameLevelConfig;
  toolId: TEditorToolId;
  canUndo: boolean;
  canRedo: boolean;
  onChange: (config: IMinigameLevelConfig, options?: { merge?: boolean }) => void;
  onUndo: () => void;
  onRedo: () => void;
  onRegenerateChips: () => void;
  onGenerate: () => void;
  onRandomize: () => void;
  onClear: () => void;
}>;

/**
 * Поле уровня. Клик ставит выбранный инструмент, зажатая кнопка рисует
 * кистью, правый клик стирает верхний слой, плитку палитры можно и
 * перетащить на клетку (ввод - `useGridBrush`). Под полем - координата и
 * состав клетки под курсором.
 */
export const LevelConfigGridSection = ({
  config,
  toolId,
  onChange,
  ...actions
}: LevelConfigGridSectionProps) => {
  const {
    hovered,
    handlePointerDown,
    handlePointerEnter,
    handleGridPointerLeave,
    handleDragOver,
    handleDrop,
  } = useGridBrush({ config, toolId, onChange });
  const cellInfo = describeCellInfo(config, hovered, toolId);

  return (
    <section className={styles.section} aria-label={EDITOR_TEXTS.grid.aria}>
      <div className={styles.toolHint}>
        {EDITOR_TEXTS.grid.toolHintPrefix}
        <b>{EDITOR_TOOLS_BY_ID[toolId].label}</b>
        {EDITOR_TEXTS.grid.toolHintSuffix}
      </div>

      {/* Поле рисуется колонками, как в игре: `grid[col]` - вертикаль. */}
      <div
        className={styles.grid}
        onContextMenu={(event) => event.preventDefault()}
        onPointerLeave={handleGridPointerLeave}
      >
        {config.grid.map((column, colIndex) => (
          <div key={colIndex} className={styles.gridColumn}>
            {column.map((cell, rowIndex) => {
              const specialToolId = resolveSpecialToolId(cell);
              const imageUrl = getElementIcon(cell.id);
              const overlayUrl = getElementIcon(cell.overlay);

              return (
                <button
                  key={`${colIndex}-${rowIndex}`}
                  type="button"
                  className={clsx(
                    styles.gridCell,
                    !cell.id && styles.gridCellEmpty,
                    cell.id === 'HOLE' && styles.gridCellHole,
                    cell.floor === 1 && styles.gridCellFloor,
                    (cell.floor ?? 0) > 1 && styles.gridCellFloorDouble
                  )}
                  aria-label={`${colIndex}:${rowIndex} ${describeGridCell(cell)}`}
                  onPointerDown={(event) =>
                    handlePointerDown(event, { col: colIndex, row: rowIndex })
                  }
                  onPointerEnter={(event) =>
                    handlePointerEnter(event, { col: colIndex, row: rowIndex })
                  }
                  onDragOver={handleDragOver}
                  onDrop={(event) => handleDrop(event, { col: colIndex, row: rowIndex })}
                >
                  {specialToolId ? (
                    <EditorToolIcon toolId={specialToolId} className={styles.cellIcon} />
                  ) : (
                    imageUrl && (
                      <img className={styles.cellIcon} src={imageUrl} alt="" draggable={false} />
                    )
                  )}
                  {overlayUrl && (
                    <img className={styles.overlayIcon} src={overlayUrl} alt="" draggable={false} />
                  )}
                  {cell.id === 'cargo' && (
                    <span className={styles.layersBadge}>{cell.layers ?? 1}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div
        className={clsx(styles.cellInfo, cellInfo.isRefusal && styles.cellInfoRefusal)}
        aria-live="polite"
      >
        {cellInfo.text}
      </div>

      <LevelConfigGridActions {...actions} />
    </section>
  );
};

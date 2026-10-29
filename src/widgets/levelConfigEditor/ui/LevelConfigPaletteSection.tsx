import clsx from 'clsx';
import type { DragEvent } from 'react';
import {
  EDITOR_TOOL_GROUP_LABELS,
  listEditorToolGroups,
  type TEditorToolId,
} from '../model/editorTools';
import { EditorToolIcon } from './EditorToolIcon';
import { EDITOR_TEXTS } from '../model/texts';
import styles from './LevelConfigPaletteSection.module.scss';

type LevelConfigPaletteSectionProps = Readonly<{
  colors: readonly string[];
  selectedToolId: TEditorToolId;
  onSelect: (toolId: TEditorToolId) => void;
  onHover: (toolId: TEditorToolId | null) => void;
}>;

/**
 * Палитра по группам: фишки, хэлперы (спецфишки), блокеры и инструменты.
 * Клик выбирает инструмент для поля, наведение показывает его описание в
 * карточке, перетаскивание на клетку по-прежнему работает. Фишки - только
 * цвета уровня из «Основных настроек».
 */
export const LevelConfigPaletteSection = ({
  colors,
  selectedToolId,
  onSelect,
  onHover,
}: LevelConfigPaletteSectionProps) => {
  const handleDragStart = (event: DragEvent<HTMLElement>, toolId: TEditorToolId) => {
    event.dataTransfer.setData('text/plain', toolId);
  };

  return (
    <section className={styles.section} aria-label={EDITOR_TEXTS.palette.aria}>
      {listEditorToolGroups(colors).map(({ group, tools }) => (
        <div
          key={group}
          className={styles.group}
          role="group"
          aria-label={EDITOR_TOOL_GROUP_LABELS[group]}
        >
          <h2 className={styles.groupTitle}>
            {EDITOR_TOOL_GROUP_LABELS[group]}
            <span className={styles.count}>{tools.length}</span>
          </h2>
          <div className={styles.palette}>
            {tools.map((tool) => (
              <button
                key={tool.id}
                type="button"
                className={clsx(styles.paletteItem, tool.id === selectedToolId && styles.selected)}
                aria-pressed={tool.id === selectedToolId}
                aria-label={tool.label}
                draggable
                onClick={() => onSelect(tool.id)}
                onDragStart={(event) => handleDragStart(event, tool.id)}
                onPointerEnter={() => onHover(tool.id)}
                onPointerLeave={() => onHover(null)}
                onFocus={() => onHover(tool.id)}
                onBlur={() => onHover(null)}
              >
                <EditorToolIcon toolId={tool.id} />
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
};

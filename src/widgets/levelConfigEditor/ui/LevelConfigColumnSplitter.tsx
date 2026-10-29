import clsx from 'clsx';
import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import {
  EDITOR_COLUMN_KEY_STEP,
  EDITOR_COLUMN_LIMITS,
  type TEditorColumn,
} from '../model/editorColumns';
import styles from './LevelConfigColumnSplitter.module.scss';

interface ILevelConfigColumnSplitterProps {
  column: TEditorColumn;
  width: number;
  label: string;
  /** Место в гриде родителя: раскладка колонок - забота редактора. */
  className?: string;
  onResize: (column: TEditorColumn, width: number) => void;
  onReset: (column: TEditorColumn) => void;
}

/**
 * Разделитель колонок: тянется мышью, стрелками с фокуса, двойной клик
 * возвращает ширину по умолчанию. Настройки стоят слева от своего
 * разделителя и растут вправо, превью - справа и растёт влево.
 */
export const LevelConfigColumnSplitter = ({
  column,
  width,
  label,
  className,
  onResize,
  onReset,
}: ILevelConfigColumnSplitterProps) => {
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const direction = column === 'settings' ? 1 : -1;
  const { min, max } = EDITOR_COLUMN_LIMITS[column];

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startX: event.clientX, startWidth: width };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;

    if (!drag) {
      return;
    }

    onResize(column, drag.startWidth + (event.clientX - drag.startX) * direction);
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const sign = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;

    if (sign === 0) {
      return;
    }

    event.preventDefault();
    onResize(column, width + sign * direction * EDITOR_COLUMN_KEY_STEP);
  };

  return (
    <div
      className={clsx(styles.splitter, className)}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onLostPointerCapture={handlePointerUp}
      onKeyDown={handleKeyDown}
      onDoubleClick={() => onReset(column)}
    />
  );
};

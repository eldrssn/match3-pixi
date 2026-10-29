import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import type { IMinigameLevelConfig } from '@/entities/game';
import { describeLevelListItem } from '../model/levelLabels';
import { EDITOR_TEXTS } from '../model/texts';
import styles from './LevelConfigLevelList.module.scss';

type LevelConfigLevelListProps = Readonly<{
  levels: readonly IMinigameLevelConfig[];
  activeIndex: number;
  onOpen: (index: number) => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}>;

/**
 * Уровни пака по порядку: клик открывает уровень в редакторе и превью.
 * Действия - над открытым уровнем: новый и копия встают сразу за ним, сдвиг
 * меняет его с соседом, номера всегда по позиции (номер уровня - его место в
 * паке). Удаление - в два нажатия: отмена правок его не вернёт.
 */
export const LevelConfigLevelList = ({
  levels,
  activeIndex,
  onOpen,
  onAdd,
  onDuplicate,
  onMove,
  onRemove,
}: LevelConfigLevelListProps) => {
  const [isRemoveArmed, setIsRemoveArmed] = useState(false);
  const activeItemRef = useRef<HTMLButtonElement>(null);
  const activeNumber = activeIndex + 1;

  // Открытый уровень всегда в видимой части списка: после сдвига или
  // добавления в конце длинного пака он уехал бы за край прокрутки.
  useEffect(() => {
    activeItemRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex, levels.length]);

  return (
    <section className={styles.section} aria-label={EDITOR_TEXTS.levelList.aria}>
      <h2 className={styles.sectionTitle}>
        {EDITOR_TEXTS.levelList.title} <span className={styles.count}>{levels.length}</span>
      </h2>

      <ol className={styles.list}>
        {levels.map((level, index) => {
          const title = describeLevelListItem(level);
          const isActive = index === activeIndex;

          return (
            <li key={index}>
              <button
                ref={isActive ? activeItemRef : undefined}
                type="button"
                className={clsx(styles.item, isActive && styles.itemActive)}
                aria-current={isActive ? 'true' : undefined}
                onClick={() => onOpen(index)}
              >
                <span className={styles.number}>{index + 1}</span>
                <span className={clsx(styles.title, !level.title && styles.titleEmpty)}>
                  {title}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={onAdd}>
          {EDITOR_TEXTS.levelList.add}
        </button>
        <button type="button" className={styles.buttonSecondary} onClick={onDuplicate}>
          {EDITOR_TEXTS.levelList.duplicate}
        </button>
        <button
          type="button"
          className={styles.buttonSecondary}
          aria-label={EDITOR_TEXTS.levelList.moveUp(activeNumber)}
          disabled={activeIndex === 0}
          onClick={() => onMove(-1)}
        >
          ↑
        </button>
        <button
          type="button"
          className={styles.buttonSecondary}
          aria-label={EDITOR_TEXTS.levelList.moveDown(activeNumber)}
          disabled={activeIndex === levels.length - 1}
          onClick={() => onMove(1)}
        >
          ↓
        </button>
        <button
          type="button"
          className={styles.buttonDanger}
          disabled={levels.length <= 1}
          onClick={() => {
            if (isRemoveArmed) {
              setIsRemoveArmed(false);
              onRemove();
            } else {
              setIsRemoveArmed(true);
            }
          }}
          onBlur={() => setIsRemoveArmed(false)}
        >
          {isRemoveArmed
            ? EDITOR_TEXTS.levelList.removeConfirm(activeNumber)
            : EDITOR_TEXTS.levelList.remove}
        </button>
      </div>
    </section>
  );
};

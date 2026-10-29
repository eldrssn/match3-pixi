import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { TMinigameGoalId } from '@/entities/game';
import styles from './LevelConfigGoalPicker.module.scss';

/** Пункт списка целей: код, подпись и иконка элемента из скина. */
export interface IGoalPickerItem {
  id: TMinigameGoalId;
  label: string;
  icon: string;
}

type LevelConfigGoalPickerProps = Readonly<{
  items: readonly IGoalPickerItem[];
  value: TMinigameGoalId;
  labelId: string;
  onChange: (id: TMinigameGoalId) => void;
}>;

/**
 * Выбор элемента цели с иконкой палитры у каждого пункта. Нативный `<select>`
 * картинку в `<option>` не покажет, поэтому это listbox по паттерну ARIA:
 * фокус держит сам список, активный пункт - `aria-activedescendant`.
 * Список закрывается на потере фокуса: клик по пункту фокус не уводит
 * (пункты не фокусируемы, ближайший фокусируемый предок - сам список).
 */
export const LevelConfigGoalPicker = ({
  items,
  value,
  labelId,
  onChange,
}: LevelConfigGoalPickerProps) => {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const selectedItem = items.find((item) => item.id === value) ?? items[0];
  const optionId = (index: number) => `${listId}-option-${index}`;

  useEffect(() => {
    if (isOpen) {
      listRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: 'nearest' });
    }
  });

  const open = () => {
    setActiveIndex(Math.max(0, items.indexOf(selectedItem)));
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const select = (index: number) => {
    onChange(items[index].id);
    close();
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      open();
    }
  };

  const handleListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const lastIndex = items.length - 1;
    const nextIndexByKey: Partial<Record<string, number>> = {
      ArrowDown: Math.min(lastIndex, activeIndex + 1),
      ArrowUp: Math.max(0, activeIndex - 1),
      Home: 0,
      End: lastIndex,
    };
    const nextIndex = nextIndexByKey[event.key];

    if (nextIndex !== undefined) {
      event.preventDefault();
      setActiveIndex(nextIndex);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      select(activeIndex);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      setIsOpen(false);
    }
  };

  return (
    <div className={styles.picker}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-labelledby={`${labelId} ${listId}-value`}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={handleTriggerKeyDown}
      >
        <img className={styles.icon} src={selectedItem.icon} alt="" />
        <span id={`${listId}-value`} className={styles.label}>
          {selectedItem.label}
        </span>
        <span className={styles.chevron} aria-hidden />
      </button>
      {isOpen && (
        <ul
          ref={listRef}
          id={listId}
          className={styles.list}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={labelId}
          aria-activedescendant={optionId(activeIndex)}
          onKeyDown={handleListKeyDown}
          onBlur={() => setIsOpen(false)}
        >
          {items.map((item, index) => (
            <li
              key={item.id}
              id={optionId(index)}
              className={styles.option}
              role="option"
              aria-selected={item.id === value}
              data-active={index === activeIndex || undefined}
              onPointerEnter={() => setActiveIndex(index)}
              onClick={() => select(index)}
            >
              <img className={styles.icon} src={item.icon} alt="" />
              <span className={styles.label}>{item.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

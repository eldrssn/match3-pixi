import { useState, type KeyboardEvent } from 'react';
import { MINIGAME_GRID_SIZE_LIMITS } from '@/entities/game';
import { parseGridSizeInput, settleGridSizeInput } from '../model/levelConfigBasics';
import { EDITOR_TEXTS } from '../model/texts';
import styles from './LevelConfigGridSizeField.module.scss';

type LevelConfigGridSizeFieldProps = Readonly<{
  label: string;
  value: number;
  onCommit: (value: number) => void;
}>;

/**
 * Число колонок или строк поля.
 *
 * Ввод живёт строкой, а размер применяется, только когда он допустим как есть
 * (`parseGridSizeInput`) или когда фокус уходит из поля (`settleGridSizeInput`).
 * Иначе стёртая цифра на пути к новому числу обрезала бы поле до минимума и
 * выбросила расставленные клетки. Кнопки −/+ меняют размер на клетку сразу,
 * в границах `MINIGAME_GRID_SIZE_LIMITS`.
 */
export const LevelConfigGridSizeField = ({
  label,
  value,
  onCommit,
}: LevelConfigGridSizeFieldProps) => {
  const [draft, setDraft] = useState(String(value));
  const [syncedValue, setSyncedValue] = useState(value);

  // Размер поменялся снаружи (уровень каталога, импорт, сброс черновика) -
  // ввод догоняет его прямо в рендере, без эффекта и лишнего кадра.
  if (value !== syncedValue) {
    setSyncedValue(value);
    setDraft(String(value));
  }

  const commit = (next: number | null) => {
    if (next !== null && next !== value) {
      onCommit(next);
    }
  };

  const handleChange = (raw: string) => {
    setDraft(raw);
    commit(parseGridSizeInput(raw));
  };

  const settle = () => {
    const next = settleGridSizeInput(draft);

    setDraft(String(next ?? value));
    commit(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      settle();
    }
  };

  const { min, max } = MINIGAME_GRID_SIZE_LIMITS;

  return (
    <label className={styles.field}>
      {label}
      <span className={styles.stepper}>
        <button
          type="button"
          className={styles.stepButton}
          aria-label={EDITOR_TEXTS.gridSize.decrease(label)}
          disabled={value <= min}
          onClick={() => commit(Math.max(min, value - 1))}
        >
          −
        </button>
        <input
          className={styles.input}
          type="number"
          min={min}
          max={max}
          value={draft}
          onChange={(event) => handleChange(event.target.value)}
          onBlur={settle}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className={styles.stepButton}
          aria-label={EDITOR_TEXTS.gridSize.increase(label)}
          disabled={value >= max}
          onClick={() => commit(Math.min(max, value + 1))}
        >
          +
        </button>
      </span>
    </label>
  );
};

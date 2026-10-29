import clsx from 'clsx';
import {
  LEVEL_TITLE_MAX_LENGTH,
  MIN_LEVEL_COLORS,
  MINIGAME_CHIP_IDS,
  readMinigameGridSize,
  resizeMinigameGrid,
  type IMinigameLevelConfig,
  type TMinigameChipId,
} from '@/entities/game';
import { getElementIcon, getElementLabel } from '@/entities/skin';
import { describeLevelColors, toggleLevelColor } from '../model/levelConfigBasics';
import { LevelConfigGridSizeField } from './LevelConfigGridSizeField';
import { EDITOR_TEXTS } from '../model/texts';
import styles from './LevelConfigBasicsSection.module.scss';

type LevelConfigBasicsSectionProps = Readonly<{
  config: IMinigameLevelConfig;
  onChange: (config: IMinigameLevelConfig) => void;
}>;

/**
 * Основные настройки уровня: название, запас ходов, размер поля и цвета
 * фишек. Номера здесь нет: номер уровня - его позиция в паке, его меняет
 * список уровней.
 *
 * Размер меняет поле с сохранением расставленного (`resizeMinigameGrid`):
 * новые клетки пустые, и превью их не пропустит, пока их не заполнит
 * генератор или палитра. Цвета - главный рычаг сложности: на четырёх цветах
 * каскады случаются заметно чаще, чем на пяти.
 */
export const LevelConfigBasicsSection = ({ config, onChange }: LevelConfigBasicsSectionProps) => {
  const { cols, rows } = readMinigameGridSize(config);

  const updateMoves = (moves: number) => {
    onChange({ ...config, moves });
  };

  // Пустое название нормализация снимает с уровня целиком (`normalizeMinigameLevelConfig`).
  const updateTitle = (title: string) => {
    onChange({ ...config, title });
  };

  const updateSize = (nextCols: number, nextRows: number) => {
    onChange({
      ...config,
      grid: resizeMinigameGrid(config.grid, nextCols, nextRows),
    });
  };

  const toggleColor = (id: TMinigameChipId) => {
    onChange({ ...config, colors: toggleLevelColor(config.colors, id) });
  };

  const colorCount = config.colors.length;
  const { missingColors, hint } = describeLevelColors(colorCount);

  return (
    <section className={styles.section} aria-label={EDITOR_TEXTS.basics.title}>
      <h2 className={styles.sectionTitle}>{EDITOR_TEXTS.basics.title}</h2>
      <div className={styles.fields}>
        <label className={clsx(styles.field, styles.fieldWide)}>
          {EDITOR_TEXTS.basics.levelTitle}
          <input
            className={styles.input}
            value={config.title ?? ''}
            maxLength={LEVEL_TITLE_MAX_LENGTH}
            placeholder={EDITOR_TEXTS.basics.levelTitlePlaceholder}
            onChange={(event) => updateTitle(event.target.value)}
          />
        </label>
        <label className={clsx(styles.field, styles.fieldWide)}>
          {EDITOR_TEXTS.basics.moves}
          <input
            className={styles.input}
            type="number"
            min="1"
            value={String(config.moves)}
            onChange={(event) => updateMoves(Number(event.target.value))}
          />
        </label>
        <LevelConfigGridSizeField
          label={EDITOR_TEXTS.basics.cols}
          value={cols}
          onCommit={(nextCols) => updateSize(nextCols, rows)}
        />
        <LevelConfigGridSizeField
          label={EDITOR_TEXTS.basics.rows}
          value={rows}
          onCommit={(nextRows) => updateSize(cols, nextRows)}
        />
      </div>
      <div className={styles.field} role="group" aria-label={EDITOR_TEXTS.basics.colors}>
        <span className={styles.colorsHeader}>
          {EDITOR_TEXTS.basics.colors}
          <span className={clsx(styles.colorCount, missingColors > 0 && styles.colorCountError)}>
            {EDITOR_TEXTS.basics.colorUsage(colorCount, MINIGAME_CHIP_IDS.length, MIN_LEVEL_COLORS)}
          </span>
        </span>
        <div className={styles.colors}>
          {MINIGAME_CHIP_IDS.map((id) => {
            const label = getElementLabel(id) ?? id;
            const iconUrl = getElementIcon(id);
            const isActive = config.colors.includes(id);

            return (
              <button
                key={id}
                type="button"
                className={clsx(styles.colorToggle, isActive && styles.colorToggleActive)}
                aria-pressed={isActive}
                title={EDITOR_TEXTS.basics.colorToggle(label, isActive)}
                onClick={() => toggleColor(id)}
              >
                {iconUrl ? <img className={styles.colorIcon} src={iconUrl} alt={label} /> : null}
                {isActive && (
                  <span className={styles.colorCheck} aria-hidden>
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className={clsx(styles.colorsHint, missingColors > 0 && styles.colorsHintError)}>
          {hint}
        </p>
      </div>
    </section>
  );
};

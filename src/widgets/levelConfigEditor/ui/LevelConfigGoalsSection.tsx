import clsx from 'clsx';
import { useId, useState } from 'react';
import {
  MINIGAME_GOAL_IDS,
  type IMinigameLevelConfig,
  type TMinigameGoalId,
} from '@/entities/game';
import { getElementIcon, getElementLabel } from '@/entities/skin';
import { LevelConfigGoalPicker, type IGoalPickerItem } from './LevelConfigGoalPicker';
import { EDITOR_TEXTS } from '../model/texts';
import styles from './LevelConfigGoalsSection.module.scss';

// Целью может быть всё из палитры, кроме «?» и дыры: фишки цвета, блокеры,
// «опусти вниз», накладки и подложка (`MINIGAME_GOAL_IDS`). Подпись и иконка -
// из скина.
const GOAL_ITEMS: readonly IGoalPickerItem[] = MINIGAME_GOAL_IDS.map((id) => ({
  id,
  label: getElementLabel(id) ?? id,
  icon: getElementIcon(id) ?? '',
}));
const DEFAULT_GOAL_ID: TMinigameGoalId = 'yellow';
const DEFAULT_GOAL_COUNT = 10;

type LevelConfigGoalsSectionProps = Readonly<{
  config: IMinigameLevelConfig;
  onChange: (config: IMinigameLevelConfig) => void;
}>;

/**
 * Цели уровня: конструктор новой цели плюс список уже добавленных.
 * Черновик новой цели - локальный view state секции, в конфиг он попадает
 * только по «Добавить».
 */
export const LevelConfigGoalsSection = ({ config, onChange }: LevelConfigGoalsSectionProps) => {
  const [selectedGoalId, setSelectedGoalId] = useState<TMinigameGoalId>(DEFAULT_GOAL_ID);
  const [goalCount, setGoalCount] = useState(DEFAULT_GOAL_COUNT);
  const goalLabelId = useId();

  const handleAddGoal = () => {
    onChange({
      ...config,
      levelGoals: [...config.levelGoals, { id: selectedGoalId, count: goalCount }],
    });
    setSelectedGoalId(DEFAULT_GOAL_ID);
    setGoalCount(DEFAULT_GOAL_COUNT);
  };

  const handleRemoveGoal = (goalIndex: number) => {
    onChange({
      ...config,
      levelGoals: config.levelGoals.filter((_, index) => index !== goalIndex),
    });
  };

  return (
    <section className={styles.section} aria-label={EDITOR_TEXTS.goals.title}>
      <h2 className={styles.sectionTitle}>{EDITOR_TEXTS.goals.title}</h2>
      <div className={styles.goalBuilder}>
        <div className={clsx(styles.field, styles.goalField)}>
          <span id={goalLabelId}>{EDITOR_TEXTS.goals.element}</span>
          <LevelConfigGoalPicker
            items={GOAL_ITEMS}
            value={selectedGoalId}
            labelId={goalLabelId}
            onChange={setSelectedGoalId}
          />
        </div>
        <label className={styles.field}>
          {EDITOR_TEXTS.goals.count}
          <input
            className={styles.input}
            type="number"
            min="1"
            value={String(goalCount)}
            onChange={(event) => setGoalCount(Number(event.target.value))}
          />
        </label>
        <button type="button" className={styles.button} onClick={handleAddGoal}>
          {EDITOR_TEXTS.goals.add}
        </button>
      </div>

      <div className={styles.goalsList}>
        {config.levelGoals.map((goal, index) => {
          const iconUrl = getElementIcon(goal.id);

          return (
            <div key={`${goal.id}-${index}`} className={styles.goalItem}>
              {iconUrl && <img className={styles.goalIcon} src={iconUrl} alt="" />}
              <span>{goal.count}</span>
              <button
                type="button"
                className={styles.iconButton}
                aria-label={EDITOR_TEXTS.goals.remove}
                onClick={() => handleRemoveGoal(index)}
              >
                x
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
};

import { getElementIcon, getElementLabel } from '@/entities/skin';
import styles from './GoalChips.module.scss';

interface IGoalChipsProps {
  /** Цели: код (`red`, `cargo`, `floor`, ...) и число в бейдже. */
  goals: readonly { id: string; count: number }[];
}

/**
 * Цели уровня кружками с числом: иконка и подпись - из описания элемента в
 * скине (`entities/skin`), те же, что в палитре редактора.
 * Общий блок карточки старта уровня и near-miss «ещё чуть-чуть».
 *
 * У иконки подпись палитры вместо пустого `alt`: без неё скринридер прочитал
 * бы одни числа («12, 5, 3»), не сказав, что именно собирать.
 */
export const GoalChips = ({ goals }: IGoalChipsProps) => (
  <ul className={styles.goals}>
    {goals.map((goal) => {
      const iconUrl = getElementIcon(goal.id);

      return (
        <li key={goal.id} className={styles.goal}>
          {iconUrl ? (
            <img className={styles.icon} src={iconUrl} alt={getElementLabel(goal.id) ?? goal.id} />
          ) : null}
          <span className={styles.count}>{goal.count}</span>
        </li>
      );
    })}
  </ul>
);

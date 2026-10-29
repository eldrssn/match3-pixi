import { useId } from 'react';
import { getElementIcon, getElementLabel } from '@/entities/skin';
import { formatMoves } from '@/shared/lib/format';
import type { IGameGoalLeft } from '@/widgets/game';
import { EDITOR_TEXTS } from '../model/texts';
import styles from './LevelConfigPreviewContinue.module.scss';

type LevelConfigPreviewContinueProps = Readonly<{
  goalsLeft: readonly IGameGoalLeft[];
  extraMoves: number;
  onContinue: () => void;
  onGiveUp: () => void;
}>;

/**
 * Near-miss превью: ходы кончились, цели - нет. Своя плашка поверх доски, а
 * не карточка `outOfMoves` из `widgets/modals`: те модалки - часть примера
 * хоста (главной), и копия шаблона, удалившая их, не должна ломать редактор.
 * Автору уровня нужна развилка «продолжить / сдаться», а не подача игроку.
 */
export const LevelConfigPreviewContinue = ({
  goalsLeft,
  extraMoves,
  onContinue,
  onGiveUp,
}: LevelConfigPreviewContinueProps) => {
  const titleId = useId();

  return (
    <div className={styles.overlay} role="dialog" aria-labelledby={titleId}>
      <div className={styles.card}>
        <strong id={titleId} className={styles.title}>
          {EDITOR_TEXTS.preview.outOfMoves}
        </strong>
        <ul className={styles.goals} aria-label={EDITOR_TEXTS.preview.goalsLeftAria}>
          {goalsLeft.map((goal) => {
            const iconUrl = getElementIcon(goal.id);
            const label = getElementLabel(goal.id) ?? goal.id;

            return (
              <li key={goal.id} className={styles.goal}>
                {iconUrl ? <img className={styles.icon} src={iconUrl} alt={label} /> : label}
                <span>{goal.left}</span>
              </li>
            );
          })}
        </ul>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={onContinue}>
            +{formatMoves(extraMoves)}
          </button>
          <button type="button" className={styles.secondary} onClick={onGiveUp}>
            {EDITOR_TEXTS.preview.giveUp}
          </button>
        </div>
      </div>
    </div>
  );
};

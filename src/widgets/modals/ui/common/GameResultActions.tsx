import { ModalButton } from '@/shared/ui/modalButton';
import type { IGameResultAction } from '../../model/useGameResultActions';
import styles from './GameResultActions.module.scss';

interface IGameResultActionsProps {
  actions: readonly IGameResultAction[];
}

/**
 * Низ карточки результата партии - один и тот же у победы и поражения.
 * Какой набор кнопок показать, решает `useGameResultActions`.
 */
export const GameResultActions = ({ actions }: IGameResultActionsProps) => (
  <div className={styles.actions}>
    {actions.map((action) => (
      <ModalButton key={action.id} variant={action.variant} onClick={action.onClick}>
        {action.label}
      </ModalButton>
    ))}
  </div>
);

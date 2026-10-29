import { useId } from 'react';
import { formatMoves } from '@/shared/lib/format';
import { Modal } from '@/shared/modals';
import { ModalButton } from '@/shared/ui/modalButton';
import { MODAL_KEYS } from '../../../model/modal-registry';
import { useHideModal, useModalProps } from '../../../model/useModalsStore';
import { MODAL_TEXTS } from '../../../texts';
import { GoalChips } from '../../common/GoalChips';
import styles from './ModalOutOfMoves.module.scss';

interface IModalOutOfMovesProps {
  isOpened: boolean;
}

/**
 * Near-miss: ходы кончились, а цели - нет. Карточка показывает, сколько
 * осталось собрать, и предлагает добавочные ходы. Доска под ней стоит на
 * паузе и ждёт решения; что делают кнопки и сколько ходов даёт «Продолжить»,
 * решает хост партии (`pages/main`), карточка только рисует.
 */
export const ModalOutOfMoves = ({ isOpened }: IModalOutOfMovesProps) => {
  const titleId = useId();
  const descriptionId = useId();
  const hideModal = useHideModal();
  const props = useModalProps(MODAL_KEYS.OUT_OF_MOVES);

  const run = (action?: () => void) => () => {
    hideModal(MODAL_KEYS.OUT_OF_MOVES);
    action?.();
  };

  return (
    <Modal
      isOpened={isOpened}
      onClose={run(props?.onGiveUp)}
      closeOnOverlayClick={false}
      backdrop="dim"
      surface="dark"
      titleId={titleId}
      descriptionId={descriptionId}
    >
      <div className={styles.text}>
        <h2 id={titleId} className={styles.title}>
          {MODAL_TEXTS.outOfMoves.title}
        </h2>
        <p id={descriptionId} className={styles.description}>
          {MODAL_TEXTS.outOfMoves.description}
        </p>
      </div>

      <GoalChips
        goals={(props?.goalsLeft ?? []).map((goal) => ({ id: goal.id, count: goal.left }))}
      />

      <div className={styles.actions}>
        <ModalButton variant="primary" onClick={run(props?.onContinue)}>
          {MODAL_TEXTS.outOfMoves.continue(formatMoves(props?.extraMoves ?? 0))}
        </ModalButton>
        <ModalButton variant="secondary" onClick={run(props?.onGiveUp)}>
          {MODAL_TEXTS.outOfMoves.giveUp}
        </ModalButton>
      </div>
    </Modal>
  );
};

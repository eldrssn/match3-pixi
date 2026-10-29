import { useId } from 'react';
import { Modal } from '@/shared/modals';
import { MODAL_KEYS } from '../../../model/modal-registry';
import { useGameResultActions } from '../../../model/useGameResultActions';
import { MODAL_TEXTS } from '../../../texts';
import { GameResultActions } from '../../common/GameResultActions';
import styles from './ModalDefeat.module.scss';

interface IModalDefeatProps {
  isOpened: boolean;
}

/**
 * Модалка поражения «Ходы закончились» (Figma 16448-13976): тёмная карточка с
 * нейтральной обводкой, заголовок, описание и кнопки флоу. Без арта и призов.
 * Открывает хост партии (`pages/main`) по исходу партии.
 */
export const ModalDefeat = ({ isOpened }: IModalDefeatProps) => {
  const titleId = useId();
  const descriptionId = useId();
  const { actions, close } = useGameResultActions(MODAL_KEYS.DEFEAT);

  return (
    <Modal
      isOpened={isOpened}
      onClose={close}
      closeOnOverlayClick={false}
      backdrop="dim"
      surface="dark"
      titleId={titleId}
      descriptionId={descriptionId}
    >
      <div className={styles.text}>
        <h2 id={titleId} className={styles.title}>
          {MODAL_TEXTS.defeat.title}
        </h2>
        <p id={descriptionId} className={styles.description}>
          {MODAL_TEXTS.defeat.description}
        </p>
      </div>

      <GameResultActions actions={actions} />
    </Modal>
  );
};

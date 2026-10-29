import { useId } from 'react';
import { Modal } from '@/shared/modals';
import { gameVictoryArtUrl } from '@/shared/lib/assets';
import { MODAL_KEYS } from '../../../model/modal-registry';
import { useGameResultActions } from '../../../model/useGameResultActions';
import { useModalProps } from '../../../model/useModalsStore';
import { MODAL_TEXTS } from '../../../texts';
import { GameResultActions } from '../../common/GameResultActions';
import { ModalHeroArt } from '../../common/ModalHeroArt';
import { ResultStars } from '../../common/ResultStars';
import styles from './ModalVictory.module.scss';

interface IModalVictoryProps {
  isOpened: boolean;
}

/**
 * Модалка победы. Открывает хост партии (`pages/main`) по исходу партии.
 * Арт, звёзды и очки партии, заголовок и две кнопки («Дальше» / «На
 * главную») - без наград и рекламы. Арт остаётся плейсхолдером.
 */
export const ModalVictory = ({ isOpened }: IModalVictoryProps) => {
  const titleId = useId();
  const descriptionId = useId();
  const { actions, close } = useGameResultActions(MODAL_KEYS.VICTORY);
  const result = useModalProps(MODAL_KEYS.VICTORY);

  return (
    <Modal
      isOpened={isOpened}
      onClose={close}
      closeOnOverlayClick={false}
      backdrop="dim"
      surface="dark"
      contentOverflow="visible"
      titleId={titleId}
      descriptionId={descriptionId}
    >
      <ModalHeroArt src={gameVictoryArtUrl} />

      {result ? <ResultStars stars={result.stars} score={result.score} /> : null}

      <div className={styles.text}>
        <h2 id={titleId} className={styles.title}>
          {MODAL_TEXTS.victory.title}
        </h2>
        <p id={descriptionId} className={styles.description}>
          {MODAL_TEXTS.victory.description}
        </p>
      </div>

      <GameResultActions actions={actions} />
    </Modal>
  );
};

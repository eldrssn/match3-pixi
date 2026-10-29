import clsx from 'clsx';
import { useId, useState } from 'react';
import type { TPreLevelBoosterKind } from '@/entities/game';
import { getElementIcon, getElementLabel } from '@/entities/skin';
import { formatMoves } from '@/shared/lib/format';
import { Modal } from '@/shared/modals';
import { ModalButton } from '@/shared/ui/modalButton';
import { MODAL_KEYS } from '../../../model/modal-registry';
import { useHideModal, useModalProps } from '../../../model/useModalsStore';
import { MODAL_TEXTS } from '../../../texts';
import { GoalChips } from '../../common/GoalChips';
import { ResultStars } from '../../common/ResultStars';
import styles from './ModalLevelStart.module.scss';

interface IModalLevelStartProps {
  isOpened: boolean;
}

/**
 * Карточка уровня перед партией: номер, цели, ходы и предуровневые бустеры -
 * спецфишки, которые встанут на стартовую доску. Выбор живёт в карточке до
 * «Играть»; что будет дальше, решает хост (`ILevelStartModalProps`).
 */
export const ModalLevelStart = ({ isOpened }: IModalLevelStartProps) => {
  const titleId = useId();
  const descriptionId = useId();
  const hideModal = useHideModal();
  const props = useModalProps(MODAL_KEYS.LEVEL_START);
  // Выбор принадлежит показу карточки, а не экземпляру вью: открытая заново,
  // пока прошлый показ доигрывает exit-анимацию, карточка - тот же экземпляр,
  // и выбор прошлого уровня перешёл бы на новый. Каждый показ приходит новым
  // объектом пропсов (`show`), по нему выбор и сверяется.
  const [selection, setSelection] = useState<{
    owner: typeof props;
    kinds: TPreLevelBoosterKind[];
  }>({ owner: props, kinds: [] });
  const selected = selection.owner === props ? selection.kinds : [];

  const toggle = (kind: TPreLevelBoosterKind) => {
    setSelection((current) => {
      const kinds = current.owner === props ? current.kinds : [];

      return {
        owner: props,
        kinds: kinds.includes(kind) ? kinds.filter((item) => item !== kind) : [...kinds, kind],
      };
    });
  };

  const close = () => {
    hideModal(MODAL_KEYS.LEVEL_START);
    props?.onClose();
  };

  const start = () => {
    hideModal(MODAL_KEYS.LEVEL_START);
    props?.onStart(props.preBoosterOptions.filter((kind) => selected.includes(kind)));
  };

  const moves = props?.moves ?? 0;

  return (
    <Modal
      isOpened={isOpened}
      onClose={close}
      backdrop="dim"
      surface="dark"
      titleId={titleId}
      descriptionId={descriptionId}
    >
      <div className={styles.text}>
        <h2 id={titleId} className={styles.title}>
          {MODAL_TEXTS.levelStart.title(props?.levelNumber)}
        </h2>
        {props?.name ? <p className={styles.name}>{props.name}</p> : null}
        <p id={descriptionId} className={styles.description}>
          {MODAL_TEXTS.levelStart.description(formatMoves(moves))}
        </p>
      </div>

      <GoalChips goals={props?.goals ?? []} />

      {props?.bestStars ? <ResultStars stars={props.bestStars} /> : null}

      {props && props.preBoosterOptions.length > 0 ? (
        <div className={styles.boosters}>
          <p className={styles.boostersTitle}>{MODAL_TEXTS.levelStart.boostersTitle}</p>
          <div className={styles.boosterRow}>
            {props.preBoosterOptions.map((kind) => {
              const isSelected = selected.includes(kind);
              // Предуровневый бустер - спецфишка на стартовой доске: подпись и
              // иконка - её описание в скине, та же иконка, что в редакторе.
              const iconUrl = getElementIcon(kind);

              return (
                <button
                  key={kind}
                  type="button"
                  className={clsx(styles.booster, isSelected && styles.boosterSelected)}
                  aria-pressed={isSelected}
                  onClick={() => toggle(kind)}
                >
                  <span className={styles.boosterIcon}>
                    {iconUrl ? <img src={iconUrl} alt="" /> : null}
                  </span>
                  <span className={styles.boosterLabel}>{getElementLabel(kind)}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className={styles.actions}>
        <ModalButton variant="primary" onClick={start}>
          {MODAL_TEXTS.levelStart.play}
        </ModalButton>
      </div>
    </Modal>
  );
};

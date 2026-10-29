import { motion } from 'motion/react';
import { useEffect, useId, useRef } from 'react';
import type { TLevelMechanic } from '@/entities/game';
import { getElementIcon, getMechanicTip } from '@/entities/skin';
import { motionSpring } from '@/shared/lib/motion';
import { GAME_TEXTS } from '../texts';
import styles from './MechanicTip.module.scss';

interface IMechanicTipProps {
  mechanic: TLevelMechanic;
  onDismiss: () => void;
}

/**
 * Подсказка механики при первой встрече: карточка поверх доски с иконкой
 * элемента, правилом в одну фразу и «Понятно». Текст и иконка - из описания
 * элемента в скине (`entities/skin`); хост решает только, какие механики игрок
 * ещё не видел (`IGameScreenProps.tutorial`). Пока карточка видна, партия
 * стоит на паузе (`GameScreen`).
 */
export const MechanicTip = ({ mechanic, onDismiss }: IMechanicTipProps) => {
  const titleId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tip = getMechanicTip(mechanic);
  const iconUrl = getElementIcon(mechanic);

  // Карточка модальна для доски: фокус переходит на её единственное действие,
  // иначе с клавиатуры «Понятно» не достать - канвас под ней фокуса не держит.
  useEffect(() => {
    buttonRef.current?.focus({ preventScroll: true });
  }, [mechanic]);

  return (
    <div className={styles.root}>
      <motion.div
        key={mechanic}
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={motionSpring.mechanical}
      >
        {iconUrl ? <img className={styles.icon} src={iconUrl} alt="" /> : null}
        <h2 id={titleId} className={styles.title}>
          {tip.title}
        </h2>
        <p className={styles.text}>{tip.text}</p>
        <button ref={buttonRef} type="button" className={styles.button} onClick={onDismiss}>
          {GAME_TEXTS.mechanicTip.dismiss}
        </button>
      </motion.div>
    </div>
  );
};

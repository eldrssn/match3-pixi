import clsx from 'clsx';
import { motion } from 'motion/react';
import type { TLevelStars } from '@/entities/game';
import { motionSpring } from '@/shared/lib/motion';
import { formatScore } from '@/shared/lib/format';
import StarIcon from '@/assets/icons/game/star.svg?react';
import { MODAL_TEXTS } from '../../texts';
import styles from './ResultStars.module.scss';

interface IResultStarsProps {
  /** Звёзды: 0-3; `null` - у уровня звёзд нет, остаются только очки. */
  stars: TLevelStars | null;
  /** Очки партии; без них - только звёзды (лучший результат на карточке уровня). */
  score?: number;
}

/** Пауза перед первой звездой: карточка успевает встать на место. */
const FIRST_STAR_DELAY_S = 0.25;
const STAR_STEP_S = 0.18;

/** Три звезды: заработанные выскакивают по очереди, средняя крупнее и выше. */
const StarRow = ({ stars }: { stars: TLevelStars }) => (
  <div className={styles.stars} role="img" aria-label={MODAL_TEXTS.result.starsLabel(stars)}>
    {[0, 1, 2].map((index) => {
      const isLit = index < stars;

      return (
        <motion.span
          key={index}
          className={clsx(styles.star, index === 1 && styles.starMiddle, isLit && styles.starLit)}
          initial={isLit ? { scale: 0, rotate: -30 } : false}
          animate={{ scale: 1, rotate: 0 }}
          transition={{
            ...motionSpring.mechanical,
            delay: FIRST_STAR_DELAY_S + index * STAR_STEP_S,
          }}
        >
          <StarIcon className={styles.icon} aria-hidden />
        </motion.span>
      );
    })}
  </div>
);

/**
 * Три звезды и очки партии на карточке результата (и лучший результат на
 * карточке уровня). Заработанные звёзды
 * выскакивают по очереди, незаработанные стоят тусклыми - игрок видит, куда
 * ещё тянуться. Средняя звезда крупнее и выше, как в жанре. Уровень без
 * звёзд (`stars: null`) оставляет одни очки.
 */
export const ResultStars = ({ stars, score }: IResultStarsProps) => (
  <div className={styles.result}>
    {stars === null ? null : <StarRow stars={stars} />}
    {score === undefined ? null : (
      <p className={styles.score}>{MODAL_TEXTS.result.score(formatScore(score))}</p>
    )}
  </div>
);

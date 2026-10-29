import clsx from 'clsx';
import VictoryLineIcon from '@/assets/icons/game/victory-lines.svg?react';
import styles from './DecorativeLines.module.scss';

/** Количество полосок-лучей в одной группе по бокам от арта. */
const LINE_TILES = 3;

interface IDecorativeLinesProps {
  /** Правая группа зеркальна левой (scaleX(-1)) — по дизайну. */
  mirrored?: boolean;
}

/**
 * Декоративные полоски-лучи по бокам от иллюстрации. Общий блок для `victory`
 * (Figma `16448-14184`) и `collection-complete` (Figma `16680-45568`) - в
 * обоих макетах геометрия совпадает один в один (25×54, 3 тайла по 18px).
 */
export const DecorativeLines = ({ mirrored = false }: IDecorativeLinesProps) => (
  <div className={clsx(styles.lines, mirrored && styles.linesMirrored)} aria-hidden="true">
    {Array.from({ length: LINE_TILES }, (_, index) => (
      <VictoryLineIcon
        className={styles.lineTile}
        key={index}
        aria-hidden="true"
        focusable="false"
      />
    ))}
  </div>
);

import clsx from 'clsx';
import { useId, useState } from 'react';
import { levelHasStars } from '@/entities/level';
import StarIcon from '@/assets/icons/game/star.svg?react';
import { isLevelUnlocked } from '@/features/match3Host';
import { HOST_LEVEL_PACK, selectCurrentLevel, useMainFlowStore } from '../model/useMainFlowStore';
import { MAIN_TEXTS } from '../texts';
import styles from './LevelMap.module.scss';

/**
 * Карта уровней: весь пак хоста плиткой - открытые с лучшими звёздами (у уровня
 * без звёзд, `starScores`, - только номер), текущий
 * подсвечен, закрытые заперты. Тап по открытому уровню - его карточка
 * (`openLevelStart`). Сброс прогресса - в два нажатия: одно случайное касание
 * не должно стирать всё пройденное.
 */
export const LevelMap = () => {
  const progress = useMainFlowStore((state) => state.progress);
  const currentLevel = useMainFlowStore(selectCurrentLevel);
  const openLevelStart = useMainFlowStore((state) => state.openLevelStart);
  const closeMap = useMainFlowStore((state) => state.closeMap);
  const resetProgress = useMainFlowStore((state) => state.resetProgress);
  const [isResetArmed, setIsResetArmed] = useState(false);
  const titleId = useId();

  return (
    <section className={styles.map} aria-labelledby={titleId}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={closeMap}>
          {MAIN_TEXTS.back}
        </button>
        <h2 id={titleId} className={styles.title}>
          {MAIN_TEXTS.map.title}
        </h2>
      </header>

      <ol className={styles.grid}>
        {HOST_LEVEL_PACK.levels.map((config) => {
          const level = config.id;
          const isUnlocked = isLevelUnlocked(progress, level);
          const stars = progress.stars[level] ?? 0;
          const hasStars = levelHasStars(config);

          return (
            <li key={level}>
              <button
                type="button"
                className={clsx(
                  styles.level,
                  level === currentLevel && styles.levelCurrent,
                  !isUnlocked && styles.levelLocked
                )}
                disabled={!isUnlocked}
                aria-label={
                  isUnlocked
                    ? MAIN_TEXTS.map.levelLabel(level, hasStars ? stars : null)
                    : MAIN_TEXTS.map.lockedLevelLabel(level)
                }
                onClick={() => openLevelStart(level)}
              >
                <span className={styles.number}>{level}</span>
                {hasStars ? (
                  <span className={styles.stars} aria-hidden>
                    {[0, 1, 2].map((index) => (
                      <StarIcon
                        key={index}
                        className={clsx(styles.star, index < stars && styles.starLit)}
                      />
                    ))}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        className={styles.reset}
        onClick={() => {
          if (isResetArmed) {
            resetProgress();
            setIsResetArmed(false);
          } else {
            setIsResetArmed(true);
          }
        }}
        onBlur={() => setIsResetArmed(false)}
      >
        {isResetArmed ? MAIN_TEXTS.map.resetConfirm : MAIN_TEXTS.map.reset}
      </button>
    </section>
  );
};

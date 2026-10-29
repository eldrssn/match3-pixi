import type { IMinigameLevelConfig } from '@/entities/game';
import { disableStarScores, enableStarScores, updateStarScore } from '../model/levelStarScores';
import { EDITOR_TEXTS } from '../model/texts';
import styles from './LevelConfigStarsSection.module.scss';

type LevelConfigStarsSectionProps = Readonly<{
  config: IMinigameLevelConfig;
  onChange: (config: IMinigameLevelConfig) => void;
}>;

/**
 * Звёзды за очки - необязательная оценка победы. Выключены: победа просто
 * засчитывается, под доской подпись «Очки: N», на карточке результата и карте
 * звёзд нет. Включены: первая звезда за победу, вторая и третья - за очки
 * сверх порогов (`starScores`); пороги подбирает и «Проверка ботом».
 */
export const LevelConfigStarsSection = ({ config, onChange }: LevelConfigStarsSectionProps) => {
  const { starScores } = config;

  return (
    <section className={styles.section} aria-label={EDITOR_TEXTS.stars.title}>
      <label className={styles.toggle}>
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={Boolean(starScores)}
          onChange={(event) =>
            onChange(event.target.checked ? enableStarScores(config) : disableStarScores(config))
          }
        />
        <span className={styles.sectionTitle}>{EDITOR_TEXTS.stars.title}</span>
      </label>

      {starScores ? (
        <>
          <p className={styles.hint}>{EDITOR_TEXTS.stars.hint}</p>
          <div className={styles.fields}>
            <label className={styles.field}>
              {EDITOR_TEXTS.stars.twoStars}
              <input
                className={styles.input}
                type="number"
                min="1"
                step="100"
                value={String(starScores[0])}
                onChange={(event) =>
                  onChange(updateStarScore(config, 0, Number(event.target.value)))
                }
              />
            </label>
            <label className={styles.field}>
              {EDITOR_TEXTS.stars.threeStars}
              <input
                className={styles.input}
                type="number"
                min="1"
                step="100"
                value={String(starScores[1])}
                onChange={(event) =>
                  onChange(updateStarScore(config, 1, Number(event.target.value)))
                }
              />
            </label>
          </div>
        </>
      ) : (
        <p className={styles.hint}>{EDITOR_TEXTS.stars.disabled}</p>
      )}
    </section>
  );
};

import type { IMinigameLevelConfig } from '@/entities/game';
import { formatScore } from '@/shared/lib/format';
import {
  BOT_CHECK_RUNS,
  describeBotPlayer,
  describeDifficulty,
  isBotCheckStale,
  isTooHardForCatalog,
  resolveStarScoreSuggestion,
} from '../model/levelBotCheck';
import { LEVEL_DIFFICULTY_WIN_RATE } from '@/entities/level';
import { enableStarScores } from '../model/levelStarScores';
import { useLevelBotCheck } from '../model/useLevelBotCheck';
import { EDITOR_TEXTS } from '../model/texts';
import styles from './LevelConfigBotSection.module.scss';

type LevelConfigBotSectionProps = Readonly<{
  config: IMinigameLevelConfig;
  onChange: (config: IMinigameLevelConfig) => void;
}>;

/**
 * Проверка черновика ботом-солвером (`entities/game/bot`): сложность, итог
 * обычного и сильного игрока и, если звёзды за очки включены, пороги по очкам
 * обычного игрока - их можно подставить в блок «Звёзды за очки» одной кнопкой.
 * Высыхания поля здесь нет: недостижимые клетки движок добирает на месте
 * (`planBoardGravity`), и пустых клеток после хода не бывает.
 *
 * Результат принадлежит одному уровню: редактор монтирует секцию с `key`
 * пака и уровня, и при переключении уровня проверка начинается заново.
 */
export const LevelConfigBotSection = ({ config, onChange }: LevelConfigBotSectionProps) => {
  const { state, run } = useLevelBotCheck();
  const isStale = state.status === 'done' && isBotCheckStale(state.checkedConfig, config);
  const starSuggestion =
    state.status === 'done'
      ? resolveStarScoreSuggestion(config, state.result.suggestedStars)
      : null;

  return (
    <section className={styles.section} aria-label={EDITOR_TEXTS.bot.title}>
      <h2 className={styles.sectionTitle}>{EDITOR_TEXTS.bot.title}</h2>
      <p className={styles.hint}>{EDITOR_TEXTS.bot.intro(BOT_CHECK_RUNS)}</p>

      <button
        type="button"
        className={styles.button}
        disabled={state.status === 'running'}
        onClick={() => run(config)}
      >
        {state.status === 'running'
          ? EDITOR_TEXTS.bot.running(state.done, state.total)
          : EDITOR_TEXTS.bot.run}
      </button>

      {state.status === 'invalid' ? (
        <p className={styles.warning}>{EDITOR_TEXTS.bot.invalid}</p>
      ) : null}

      {state.status === 'done' ? (
        <div className={styles.result}>
          {isStale ? <p className={styles.warning}>{EDITOR_TEXTS.bot.stale}</p> : null}
          <p>
            {EDITOR_TEXTS.bot.difficulty}
            <strong>{describeDifficulty(state.result.casual.winRate)}</strong>
          </p>
          {isTooHardForCatalog(state.result.casual.winRate) ? (
            <p className={styles.warning}>
              {EDITOR_TEXTS.bot.tooHard(Math.round(LEVEL_DIFFICULTY_WIN_RATE.hard * 100))}
            </p>
          ) : null}
          <p>
            <strong>{EDITOR_TEXTS.bot.casualPlayer}</strong>
            {EDITOR_TEXTS.bot.casualPlayerNote} {describeBotPlayer(state.result.casual)}
          </p>
          <p>
            <strong>{EDITOR_TEXTS.bot.greedyPlayer}</strong>
            {EDITOR_TEXTS.bot.greedyPlayerNote} {describeBotPlayer(state.result.greedy)}
          </p>
          {starSuggestion ? (
            <div className={styles.stars}>
              <p>
                {EDITOR_TEXTS.bot.starSuggestion(
                  formatScore(starSuggestion.thresholds[0]),
                  formatScore(starSuggestion.thresholds[1])
                )}
              </p>
              {/*
                Пороги устаревшего результата посчитаны на другом черновике:
                подставлять их нельзя - сначала новая проверка.
              */}
              {starSuggestion.isApplied ? (
                <p className={styles.hint}>{EDITOR_TEXTS.bot.starsApplied}</p>
              ) : isStale ? null : (
                <button
                  type="button"
                  className={styles.buttonSecondary}
                  onClick={() => onChange(enableStarScores(config, starSuggestion.thresholds))}
                >
                  {EDITOR_TEXTS.bot.applyStars}
                </button>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};

import type { IMinigameLevelConfig } from '@/entities/game';

/**
 * Правила блока «Звёзды за очки»: звёзды у уровня необязательны. Без
 * `starScores` победа просто засчитывается, с ними первая звезда - за победу,
 * вторая и третья - за очки сверх порогов.
 */

/**
 * Стартовые пороги на ход уровня, когда автор только включил звёзды: грубая
 * прикидка, чтобы поля не стояли пустыми. Точнее подберёт «Проверка ботом».
 */
const STARTER_POINTS_PER_MOVE = { two: 400, three: 700 } as const;

/**
 * Ставит уровню пороги звёзд: включает звёзды (без порогов - стартовые) или
 * заменяет уже стоящие, как подстановка порогов «Проверки ботом».
 */
export const enableStarScores = (
  config: IMinigameLevelConfig,
  starScores: [number, number] = [
    config.moves * STARTER_POINTS_PER_MOVE.two,
    config.moves * STARTER_POINTS_PER_MOVE.three,
  ]
): IMinigameLevelConfig => ({ ...config, starScores });

export const disableStarScores = ({
  starScores: _removed,
  ...config
}: IMinigameLevelConfig): IMinigameLevelConfig => config;

/** Порог одной звезды: `0` - вторая, `1` - третья. Включённые звёзды обязательны. */
export const updateStarScore = (
  config: IMinigameLevelConfig,
  index: 0 | 1,
  value: number
): IMinigameLevelConfig => {
  const next: [number, number] = [...(config.starScores ?? [0, 0])];

  next[index] = value;

  return { ...config, starScores: next };
};

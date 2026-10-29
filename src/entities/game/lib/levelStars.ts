/** Звёзды партии: 0 - поражение, 1-3 - победа. */
export type TLevelStars = 0 | 1 | 2 | 3;

/**
 * Звёзды за партию: первая - за победу (цели закрыты), вторая и третья - за
 * очки сверх порогов уровня. Поражение звёзд не даёт, сколько бы очков ни
 * набралось. Уровень без порогов (`starScores` не задан) звёзд не ведёт
 * вовсе - `null`: победа просто победа.
 */
export const resolveLevelStars = (
  isVictory: boolean,
  score: number,
  starScores: readonly [number, number] | undefined
): TLevelStars | null => {
  if (!starScores) {
    return null;
  }

  if (!isVictory) {
    return 0;
  }

  const [twoStars, threeStars] = starScores;

  if (score >= threeStars) {
    return 3;
  }

  return score >= twoStars ? 2 : 1;
};

/**
 * Пороги по очкам победных партий бота (`measureLevelWithBot().winScores`):
 * вторая звезда - средний бот, третья - лучшая пятая часть партий. Округление
 * до сотни - чтобы автор видел в JSON круглые числа.
 */
export const suggestStarScores = (winScores: readonly number[]): [number, number] | null => {
  if (winScores.length === 0) {
    return null;
  }

  const sorted = [...winScores].sort((a, b) => a - b);
  const at = (share: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))];
  const round = (value: number) => Math.max(100, Math.round(value / 100) * 100);
  const two = round(at(0.4));

  return [two, Math.max(two + 100, round(at(0.8)))];
};

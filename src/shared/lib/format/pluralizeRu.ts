/**
 * Русская плюрализация: выбирает нужную форму слова по числу.
 * pluralizeRu(1, ['день', 'дня', 'дней']) -> 'день'
 * pluralizeRu(3, ['день', 'дня', 'дней']) -> 'дня'
 * pluralizeRu(11, ['день', 'дня', 'дней']) -> 'дней'
 */
export const pluralizeRu = (
  count: number,
  [one, few, many]: readonly [string, string, string]
): string => {
  const remainder100 = Math.abs(count) % 100;
  const remainder10 = remainder100 % 10;

  if (remainder100 > 10 && remainder100 < 20) {
    return many;
  }

  if (remainder10 > 1 && remainder10 < 5) {
    return few;
  }

  if (remainder10 === 1) {
    return one;
  }

  return many;
};

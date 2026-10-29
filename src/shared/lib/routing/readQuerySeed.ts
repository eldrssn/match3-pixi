import { MAX_SEED } from '@/shared/lib/random';

/**
 * Dev/QA переключатель `?seed=N`: зерно случайности партии.
 *
 * Добор фишек и перемешка тупика детерминированы зерном (`shared/lib/random`):
 * партия с тем же зерном и теми же ходами повторяется до клетки. Без флага
 * виджет берёт случайное зерно на каждую партию; с флагом QA воспроизводит
 * раскладку, на которой поймали баг.
 *
 * Флаг со значением: пустой, нечисловой, отрицательный или дробный `?seed`
 * игнорируется - молча подменять зерно из-за опечатки нельзя. Верхняя граница -
 * `MAX_SEED` самого генератора.
 */
export const readQuerySeed = (search = window.location.search): number | null => {
  const raw = new URLSearchParams(search).get('seed');

  if (raw === null || raw.trim() === '') {
    return null;
  }

  const seed = Number(raw.trim());

  return Number.isInteger(seed) && seed >= 0 && seed <= MAX_SEED ? seed : null;
};

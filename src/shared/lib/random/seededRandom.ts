/**
 * Детерминированный генератор случайных чисел с зерном.
 *
 * Тот же контракт, что у `Math.random`: функция без аргументов, отдающая число
 * из `[0, 1)`, - поэтому её можно передать в любое правило, которое принимает
 * `random`, не меняя самого правила. Одно и то же зерно даёт одну и ту же
 * последовательность: партия с тем же зерном и теми же ходами воспроизводится
 * до клетки, а баг «на доске выпала странная раскладка» можно повторить.
 *
 * Алгоритм - mulberry32: 32-битное состояние, хорошее распределение для игровой
 * случайности и ноль зависимостей. Криптостойкость здесь не нужна.
 */
export type TRandom = () => number;

/** Зерно - беззнаковое 32-битное целое. */
const SEED_MODULO = 0x1_0000_0000;

/** Наибольшее допустимое зерно - граница и для QA-флага `?seed=`. */
export const MAX_SEED = SEED_MODULO - 1;

/** Приводит любое число к допустимому зерну (беззнаковое 32-битное целое). */
export const normalizeSeed = (seed: number): number => {
  if (!Number.isFinite(seed)) {
    return 0;
  }

  return Math.floor(Math.abs(seed)) % SEED_MODULO;
};

export const createSeededRandom = (seed: number): TRandom => {
  let state = normalizeSeed(seed);

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;

    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / SEED_MODULO;
  };
};

/**
 * Новое зерно для партии без заданного. Само зерно случайно - иначе каждая
 * партия была бы одной и той же; детерминированным становится всё, что после.
 */
export const createRandomSeed = (): number => Math.floor(Math.random() * SEED_MODULO);

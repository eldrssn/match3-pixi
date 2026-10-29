import { BOARD_TIMING } from '../configs/timing';
import { GAME_TEXTS } from '../texts';

/** Хайп-фразы каскада; формулировки - `GAME_TEXTS.comboPhrases`. */
export const COMBO_PHRASES = GAME_TEXTS.comboPhrases;

export type TComboPhrase = (typeof COMBO_PHRASES)[number];

/**
 * Случайная фраза из пула, гарантированно не совпадающая с прошлой показанной
 * - иначе повтор подряд читался бы как баг, а не как «повезло выпасть дважды».
 * На пуле из одного элемента совпадение неизбежно и возвращается как есть.
 */
export const pickNextComboPhrase = <TPhrase extends string>(
  pool: readonly TPhrase[],
  lastPhrase: string | null,
  random: () => number = Math.random
): TPhrase => {
  const candidates = pool.length > 1 ? pool.filter((phrase) => phrase !== lastPhrase) : pool;

  return candidates[Math.floor(random() * candidates.length)];
};

/**
 * Показывать ли фразу на этой итерации каскада.
 *
 * Порог совпадает с порогом попапа «×N» (итерация, на которой множитель уже
 * виден), но фраза - более редкий акцент: вероятностный ролл плюс кулдаун от
 * прошлого показа, иначе длинная цепочка сыпала бы фразами на каждом звене.
 */
export const shouldShowComboPhrase = (
  iteration: number,
  comboFromIteration: number,
  now: number,
  lastShownAt: number | null,
  random: () => number = Math.random
): boolean => {
  if (iteration < comboFromIteration) {
    return false;
  }

  if (lastShownAt !== null && now - lastShownAt < BOARD_TIMING.comboPhrase.cooldownMs) {
    return false;
  }

  return random() < BOARD_TIMING.comboPhrase.chance;
};

import { formatScore } from '@/shared/lib/format';
import { GAME_TEXTS } from '../texts';

/**
 * Геометрия полосы очков (`modules/ScoreMeter`) в долях её длины - чистое
 * правило, чтобы раскладка звёзд не жила в модуле рантайма.
 *
 * Полоса заканчивается чуть дальше третьей звезды: заполненная до упора
 * полоса на самом пороге читалась бы как «больше набирать незачем».
 */
const METER_HEADROOM = 1.15;

/** Полная длина полосы в очках. */
const resolveMeterMax = ([, three]: readonly [number, number]): number =>
  Math.max(1, three * METER_HEADROOM);

/**
 * Где стоят три звезды: первая (за победу) - в начале полосы, вторая и третья
 * - на порогах очков уровня. Уровень без порогов полосы не рисует вовсе.
 */
export const resolveScoreMeterMarks = (thresholds: readonly [number, number]): number[] => {
  const max = resolveMeterMax(thresholds);
  const mark = (threshold: number) => Math.min(1, threshold / max);

  return [0, mark(thresholds[0]), mark(thresholds[1])];
};

/** Заполнение полосы под счёт, 0..1. */
export const resolveScoreMeterFill = (
  score: number,
  thresholds: readonly [number, number]
): number => Math.min(1, Math.max(0, score / resolveMeterMax(thresholds)));

/**
 * Подпись счёта. Рядом с полосой - голое число: что это очки, говорят звёзды.
 * Без порогов полосы нет, и одинокое число под доской не читалось бы - оно
 * подписано: «Очки: 1 250».
 */
export const formatScoreMeterText = (
  score: number,
  thresholds: readonly [number, number] | undefined
): string => (thresholds ? formatScore(score) : GAME_TEXTS.hud.scoreLabel(formatScore(score)));

import type { TBoardStep } from '../engine/boardSteps';
import {
  isMinigameChipId,
  isMinigameSpecialId,
  type TMinigameSpecialId,
} from './minigameLevelConfig';

/**
 * Очки партии - чистое правило по протоколу хода, как и прогресс целей
 * (`boardProgress`): движок не знает очков, рантайм и бот считают их по одним
 * и тем же шагам.
 *
 * Шкала в духе Candy Crush: фишка в фигуре стоит больше с каждым звеном
 * каскада, взрыв спецфишки платит за каждую снятую клетку, блокеры и слои
 * дороже фишек, рождённая спецфишка - отдельная награда, а оставшиеся к победе
 * ходы конвертируются в бонус.
 */
export const SCORE_POINTS = {
  /** Фишка, собранная в фигуру; умножается на номер звена каскада. */
  matchChip: 20,
  /** Фишка, снятая взрывом спецфишки, бустером или превращённая радугой. */
  blastChip: 30,
  /** Удар по блокеру или слою: ящик, камень, слизь, лёд, цепь, подложка. */
  blockerHit: 50,
  /** Собранное «опусти вниз». */
  drop: 500,
  /** Рождённая спецфишка - по её виду. */
  special: { laser: 120, propeller: 120, bomb: 180, rainbow: 300 } satisfies Record<
    TMinigameSpecialId,
    number
  >,
  /** Каждый ход, оставшийся к победе (финальный бонус), - сверх взрыва его ракеты. */
  bonusMove: 250,
} as const;

/**
 * Очки за каждый шаг протокола - тем же порядком, что сами шаги: рантайм
 * прибавляет их по мере проигрывания, и счётчик растёт вместе с анимацией.
 *
 * Звено каскада удар узнаёт по следующему шагу: движок пишет урон фигур и
 * сразу за ним `matches` с номером звена. Урон без `matches` следом - взрыв
 * спецфишки или бустер.
 */
export const scoreBoardSteps = (steps: readonly TBoardStep[]): number[] =>
  steps.map((step, index) => {
    switch (step.type) {
      case 'damage': {
        const next = steps[index + 1];
        const iteration = next?.type === 'matches' ? next.iteration : 0;

        return step.hits.reduce((sum, hit) => {
          if (isMinigameChipId(hit.id)) {
            if (!hit.destroyed) {
              return sum;
            }

            return (
              sum + (iteration > 0 ? SCORE_POINTS.matchChip * iteration : SCORE_POINTS.blastChip)
            );
          }

          return isMinigameSpecialId(hit.id) ? sum : sum + SCORE_POINTS.blockerHit;
        }, 0);
      }

      case 'special':
        return SCORE_POINTS.special[step.placement.piece.id];

      case 'transform':
        return step.changes.length * SCORE_POINTS.blastChip;

      case 'collect':
        return step.uids.length * SCORE_POINTS.drop;

      case 'bonus':
        return step.moves * SCORE_POINTS.bonusMove;

      default:
        return 0;
    }
  });

/** Сумма очков протокола целиком. */
export const scoreBoardStepsTotal = (steps: readonly TBoardStep[]): number =>
  scoreBoardSteps(steps).reduce((sum, points) => sum + points, 0);

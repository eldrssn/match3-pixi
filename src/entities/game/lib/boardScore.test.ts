import { describe, expect, it } from 'vitest';
import type { TBoardStep } from '../engine/boardSteps';
import { SCORE_POINTS, scoreBoardSteps, scoreBoardStepsTotal } from './boardScore';

const hit = (id: string, destroyed = true) => ({
  uid: 1,
  id,
  layer: 'piece' as const,
  hp: destroyed ? 0 : 1,
  destroyed,
});

describe('scoreBoardSteps', () => {
  it('фишка в фигуре дорожает со звеном каскада', () => {
    const steps: TBoardStep[] = [
      { type: 'damage', hits: [hit('red'), hit('red'), hit('red')] },
      { type: 'matches', iteration: 1, groups: [] },
      { type: 'damage', hits: [hit('blue'), hit('blue'), hit('blue')] },
      { type: 'matches', iteration: 2, groups: [] },
    ];

    expect(scoreBoardSteps(steps)).toEqual([
      3 * SCORE_POINTS.matchChip,
      0,
      3 * SCORE_POINTS.matchChip * 2,
      0,
    ]);
  });

  it('взрыв платит за фишки по своей цене, блокеры дороже, спецфишки - ноль', () => {
    const steps: TBoardStep[] = [
      {
        type: 'damage',
        hits: [hit('red'), hit('laser'), hit('cargo', false), { ...hit('ice'), layer: 'overlay' }],
      },
    ];

    expect(scoreBoardStepsTotal(steps)).toBe(SCORE_POINTS.blastChip + 2 * SCORE_POINTS.blockerHit);
  });

  it('спецфишка, «опусти вниз» и финальный бонус - свои награды', () => {
    const steps: TBoardStep[] = [
      {
        type: 'special',
        placement: { col: 0, row: 0, piece: { uid: 2, id: 'rainbow', hp: 1 } },
      },
      { type: 'collect', uids: [3, 4] },
      { type: 'bonus', moves: 5 },
    ];

    expect(scoreBoardStepsTotal(steps)).toBe(
      SCORE_POINTS.special.rainbow + 2 * SCORE_POINTS.drop + 5 * SCORE_POINTS.bonusMove
    );
  });
});

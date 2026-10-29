import { describe, expect, it } from 'vitest';
import type { TBoardStep } from '../engine/boardSteps';
import { countGoalProgress, listGoalEvents } from './boardProgress';

const special = { uid: 90, id: 'laser', hp: 1, direction: 'horizontal' } as const;

describe('listGoalEvents', () => {
  it('засчитывает только разрушенные слои удара', () => {
    const step: TBoardStep = {
      type: 'damage',
      hits: [
        { uid: 1, id: 'red', layer: 'piece', hp: 0, destroyed: true },
        { uid: 2, id: 'cargo', layer: 'piece', hp: 1, destroyed: false },
        { uid: 3, id: 'ice', layer: 'overlay', hp: 0, destroyed: true },
      ],
    };

    expect(listGoalEvents(step)).toEqual([
      { id: 'red', uid: 1 },
      { id: 'ice', uid: 3 },
    ]);
  });

  it('превращённая радугой фишка и собранный кристалл идут в цель', () => {
    expect(
      listGoalEvents({
        type: 'transform',
        changes: [{ uid: 5, id: 'blue', placement: { col: 0, row: 0, piece: special } }],
      })
    ).toEqual([{ id: 'blue', uid: 5 }]);
    expect(listGoalEvents({ type: 'collect', uids: [7, 8] })).toEqual([
      { id: 'drop', uid: 7 },
      { id: 'drop', uid: 8 },
    ]);
  });

  it('поглощённая слизью фишка и уступившая клетку предбустеру - нет', () => {
    expect(
      listGoalEvents({
        type: 'preBoost',
        replaced: [4],
        placements: [{ col: 0, row: 0, piece: special }],
      })
    ).toEqual([]);
  });
});

describe('countGoalProgress', () => {
  it('суммирует события шагов по кодам целей', () => {
    const steps: TBoardStep[] = [
      { type: 'damage', hits: [{ uid: 1, id: 'red', layer: 'piece', hp: 0, destroyed: true }] },
      { type: 'damage', hits: [{ uid: 2, id: 'red', layer: 'piece', hp: 0, destroyed: true }] },
      { type: 'collect', uids: [3] },
    ];

    expect(Object.fromEntries(countGoalProgress(steps))).toEqual({ red: 2, drop: 1 });
  });
});

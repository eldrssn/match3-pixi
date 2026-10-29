import { describe, expect, it } from 'vitest';
import type { TBoardStep } from '@/entities/game';
import { diffStoreBoardEvents, listStepBoardEvents, type IBoardEventSource } from './boardEvents';

const laser = { uid: 7, id: 'laser', hp: 1, direction: 'horizontal' } as const;

const source = (patch: Partial<IBoardEventSource> = {}): IBoardEventSource => ({
  movesMade: 0,
  movesCount: 20,
  score: 0,
  goals: [{ id: 'red', current: 0, target: 3, isCompleted: false }],
  boosters: [{ kind: 'ball', quantity: 2 }],
  ...patch,
});

describe('listStepBoardEvents', () => {
  it('звено каскада - событие с номером и числом фигур', () => {
    const step: TBoardStep = {
      type: 'matches',
      iteration: 2,
      groups: [[{ col: 0, row: 0 }], [{ col: 1, row: 1 }]],
    };

    expect(listStepBoardEvents(step)).toEqual([{ type: 'cascade', iteration: 2, groups: 2 }]);
  });

  it('спецфишка за фигуру, превращение и предуровневый бустер различаются источником', () => {
    const placement = { col: 2, row: 3, piece: laser };

    expect(listStepBoardEvents({ type: 'special', placement })).toEqual([
      { type: 'specialCreated', kind: 'laser', col: 2, row: 3, source: 'match' },
    ]);
    expect(
      listStepBoardEvents({ type: 'transform', changes: [{ uid: 1, id: 'red', placement }] })
    ).toEqual([{ type: 'specialCreated', kind: 'laser', col: 2, row: 3, source: 'transform' }]);
    expect(
      listStepBoardEvents({ type: 'preBoost', replaced: [1], placements: [placement] })
    ).toEqual([{ type: 'specialCreated', kind: 'laser', col: 2, row: 3, source: 'preBoost' }]);
  });

  it('у остальных шагов своих событий нет: цели и очки идут из стора', () => {
    expect(listStepBoardEvents({ type: 'cascadePause', iteration: 1 })).toEqual([]);
    expect(listStepBoardEvents({ type: 'damage', hits: [] })).toEqual([]);
  });
});

describe('diffStoreBoardEvents', () => {
  it('ход игрока - по счётчику сделанных ходов, с остатком', () => {
    expect(diffStoreBoardEvents(source(), source({ movesMade: 1, movesCount: 19 }))).toEqual([
      { type: 'moveMade', movesMade: 1, movesLeft: 19 },
    ]);
  });

  it('пересчёт ходов в бонус и добавочные ходы - не ход', () => {
    expect(diffStoreBoardEvents(source(), source({ movesCount: 19 }))).toEqual([]);
    expect(diffStoreBoardEvents(source(), source({ movesCount: 25 }))).toEqual([]);
  });

  it('шаг цели, а на последнем шаге - ещё и закрытие', () => {
    const step = source({ goals: [{ id: 'red', current: 1, target: 3, isCompleted: false }] });
    const last = source({ goals: [{ id: 'red', current: 3, target: 3, isCompleted: true }] });

    expect(diffStoreBoardEvents(source(), step)).toEqual([
      { type: 'goalProgress', id: 'red', current: 1, target: 3 },
    ]);
    expect(diffStoreBoardEvents(step, last)).toEqual([
      { type: 'goalProgress', id: 'red', current: 3, target: 3 },
      { type: 'goalCompleted', id: 'red' },
    ]);
  });

  it('бустер - по списанному заряду', () => {
    expect(
      diffStoreBoardEvents(source(), source({ boosters: [{ kind: 'ball', quantity: 1 }] }))
    ).toEqual([{ type: 'boosterUsed', kind: 'ball', left: 1 }]);
  });

  it('очки - с приростом шага', () => {
    expect(diffStoreBoardEvents(source({ score: 100 }), source({ score: 160 }))).toEqual([
      { type: 'scoreChanged', score: 160, delta: 60 },
    ]);
  });

  it('сброс стора между партиями событий не даёт', () => {
    const played = source({
      movesMade: 5,
      score: 900,
      goals: [{ id: 'red', current: 3, target: 3, isCompleted: true }],
    });

    expect(
      diffStoreBoardEvents(played, source({ goals: [], boosters: [], movesCount: 0 }))
    ).toEqual([]);
  });
});

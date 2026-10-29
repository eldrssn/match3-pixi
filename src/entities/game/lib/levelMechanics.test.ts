import { describe, expect, it } from 'vitest';
import { listLevelMechanics } from './levelMechanics';

describe('listLevelMechanics', () => {
  it('находит предметы, накладки и подложку поля в каноническом порядке', () => {
    expect(
      listLevelMechanics({
        grid: [
          [{ id: 'drop' }, { id: 'red', overlay: 'chain' }],
          [
            { id: 'cargo', layers: 2 },
            { id: 'green', floor: 1 },
          ],
          [{ id: 'HOLE' }, { id: 'random', overlay: 'ice' }],
        ],
      })
    ).toEqual(['cargo', 'ice', 'chain', 'floor', 'drop']);
  });

  it('поле из одних фишек механик не содержит', () => {
    expect(listLevelMechanics({ grid: [[{ id: 'red' }, { id: 'blue' }]] })).toEqual([]);
  });
});

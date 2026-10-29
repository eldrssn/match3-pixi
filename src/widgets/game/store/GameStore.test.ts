import { beforeEach, describe, expect, it } from 'vitest';

import { useGameStore } from './GameStore';

const read = () => useGameStore.getState();

describe('GameStore.useBooster', () => {
  beforeEach(() => {
    read().resetStore();
  });

  it('spends the inventory', () => {
    read().initBoosters([{ kind: 'ball', quantity: 2 }]);

    expect(read().useBooster('ball')).toBe(true);
    expect(read().getBoosterQuantity('ball')).toBe(1);
  });

  it('refuses to spend an exhausted booster', () => {
    read().initBoosters([{ kind: 'ball', quantity: 0 }]);

    expect(read().useBooster('ball')).toBe(false);
    expect(read().getBoosterQuantity('ball')).toBe(0);
  });

  it('keeps every kind in the layout even when the party omits it', () => {
    read().initBoosters([{ kind: 'ball', quantity: 1 }]);

    expect(read().boosters.map((booster) => booster.kind)).toEqual(['beam', 'laser', 'ball']);
    expect(read().getBoosterQuantity('laser')).toBe(0);
    expect(read().useBooster('laser')).toBe(false);
  });
});

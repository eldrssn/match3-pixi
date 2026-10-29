import { describe, expect, it } from 'vitest';
import { INITIAL_MINIGAME_LEVEL_CONFIG } from '@/entities/game';
import {
  listStrokeCells,
  randomizeGridChips,
  resolveClearedCell,
  replaceGridCell,
  resolveDroppedCell,
} from './levelConfigGrid';

describe('resolveDroppedCell', () => {
  it('an overlay lands on a chip, the same overlay again removes it', () => {
    const chained = resolveDroppedCell({ id: 'red' }, 'chain');

    expect(chained).toEqual({ id: 'red', overlay: 'chain' });
    expect(resolveDroppedCell(chained, 'chain')).toEqual({ id: 'red' });
    expect(resolveDroppedCell({ id: 'cargo', layers: 2 }, 'ice')).toEqual({
      id: 'cargo',
      layers: 2,
    });
  });

  it('a random «?» cell holds an overlay like a chip', () => {
    expect(resolveDroppedCell({ id: 'random' }, 'ice')).toEqual({ id: 'random', overlay: 'ice' });
    expect(resolveDroppedCell({ id: 'red', overlay: 'chain' }, 'random')).toEqual({
      id: 'random',
      overlay: 'chain',
    });
  });

  it('floor cycles 1 -> 2 -> none and never goes under a hole', () => {
    const once = resolveDroppedCell({ id: 'red' }, 'floor');
    const twice = resolveDroppedCell(once, 'floor');

    expect(once).toEqual({ id: 'red', floor: 1 });
    expect(twice).toEqual({ id: 'red', floor: 2 });
    expect(resolveDroppedCell(twice, 'floor')).toEqual({ id: 'red' });
    expect(resolveDroppedCell({ id: 'HOLE' }, 'floor')).toEqual({ id: 'HOLE' });
  });

  it('a piece keeps the floor, a chip keeps the overlay, a box cycles its layers', () => {
    expect(resolveDroppedCell({ id: 'red', overlay: 'ice', floor: 1 }, 'blue')).toEqual({
      id: 'blue',
      overlay: 'ice',
      floor: 1,
    });
    expect(resolveDroppedCell({ id: 'red', overlay: 'ice' }, 'stone')).toEqual({ id: 'stone' });
    expect(resolveDroppedCell({ id: 'red' }, 'cargo')).toEqual({ id: 'cargo', layers: 2 });
    expect(resolveDroppedCell({ id: 'cargo', layers: 3 }, 'cargo')).toEqual({
      id: 'cargo',
      layers: 1,
    });
    expect(resolveDroppedCell({ id: 'red', floor: 2 }, 'HOLE')).toEqual({ id: 'HOLE' });
  });
});

describe('resolveClearedCell', () => {
  it('removes one layer at a time: overlay, then piece, then floor', () => {
    const full = { id: 'red', overlay: 'ice', floor: 1 };
    const noOverlay = resolveClearedCell(full);
    const noPiece = resolveClearedCell(noOverlay);

    expect(noOverlay).toEqual({ id: 'red', floor: 1 });
    expect(noPiece).toEqual({ id: '', floor: 1 });
    expect(resolveClearedCell(noPiece)).toEqual({ id: '' });
  });

  it('keeps an already empty cell as is', () => {
    const empty = { id: '' };

    expect(resolveClearedCell(empty)).toBe(empty);
  });
});

describe('replaceGridCell', () => {
  it('returns the same config when the cell did not change', () => {
    const cell = { id: 'stone' };
    const config = { ...INITIAL_MINIGAME_LEVEL_CONFIG, grid: [[cell]] };

    expect(replaceGridCell(config, 0, 0, cell)).toBe(config);
    expect(replaceGridCell(config, 0, 0, resolveDroppedCell(cell, 'ice'))).toBe(config);
    expect(replaceGridCell(config, 0, 0, { id: 'red' }).grid).toEqual([[{ id: 'red' }]]);
  });
});

describe('randomizeGridChips', () => {
  it('turns chips into «?» cells and keeps blockers and layers', () => {
    expect(
      randomizeGridChips([
        [{ id: 'red', overlay: 'ice', floor: 1 }, { id: 'cargo', layers: 2 }, { id: 'HOLE' }],
      ])
    ).toEqual([
      [{ id: 'random', overlay: 'ice', floor: 1 }, { id: 'cargo', layers: 2 }, { id: 'HOLE' }],
    ]);
  });
});

describe('listStrokeCells', () => {
  it('fills the cells the pointer skipped, without the start cell', () => {
    expect(listStrokeCells({ col: 0, row: 3 }, { col: 3, row: 3 })).toEqual([
      { col: 1, row: 3 },
      { col: 2, row: 3 },
      { col: 3, row: 3 },
    ]);
    expect(listStrokeCells({ col: 2, row: 2 }, { col: 0, row: 0 })).toEqual([
      { col: 1, row: 1 },
      { col: 0, row: 0 },
    ]);
    expect(listStrokeCells({ col: 1, row: 1 }, { col: 1, row: 1 })).toEqual([]);
  });
});

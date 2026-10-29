import { describe, expect, it } from 'vitest';
import { MINIGAME_ELEMENT_IDS } from '@/entities/game';
import { getElementView, type TSkinCellViewKind } from '@/entities/skin';
import { CELL_VIEW_KINDS } from './cellViewKinds';

describe('CELL_VIEW_KINDS', () => {
  it('у каждого вида клетки скина есть фабрика', () => {
    const kinds = Object.keys({
      sprite: true,
      frames: true,
      spine: true,
    } satisfies Record<TSkinCellViewKind, true>) as TSkinCellViewKind[];

    expect(kinds.filter((kind) => typeof CELL_VIEW_KINDS[kind] !== 'function')).toEqual([]);
  });

  it('элемент без своего вида в скине рисуется спрайтом', () => {
    expect(getElementView('red')).toEqual({ kind: 'sprite' });
    expect(getElementView('unknown')).toEqual({ kind: 'sprite' });
  });

  it('скин ссылается только на виды из реестра', () => {
    const unknown = MINIGAME_ELEMENT_IDS.map((id) => getElementView(id).kind).filter(
      (kind) => !(kind in CELL_VIEW_KINDS)
    );

    expect(unknown).toEqual([]);
  });
});

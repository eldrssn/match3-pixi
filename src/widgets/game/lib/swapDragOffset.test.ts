import { describe, expect, it } from 'vitest';

import { GAME_CONFIG } from '../configs/GAME_CONFIG';
import { resolveSwapDragOffset } from './swapDragOffset';

const TILE_STEP_PX = GAME_CONFIG.tile.size.width + GAME_CONFIG.tile.size.spaceBetween;
const SWAPPABLE_LIMIT_PX = TILE_STEP_PX * GAME_CONFIG.dragFollowTiles.swappable;
const BLOCKED_LIMIT_PX = TILE_STEP_PX * GAME_CONFIG.dragFollowTiles.blocked;

const moveRight = (offset: number, hasSwappablePartner = true) =>
  resolveSwapDragOffset({ offset, dCol: 1, dRow: 0, hasSwappablePartner });

describe('resolveSwapDragOffset', () => {
  it('follows the finger while the move is short of a whole tile', () => {
    expect(moveRight(12)).toEqual({ dragged: { x: 12, y: 0 }, partner: { x: -12, y: 0 } });
  });

  it('stops the pair at one tile: the swap has already happened under the finger', () => {
    expect(moveRight(SWAPPABLE_LIMIT_PX * 3).dragged.x).toBe(SWAPPABLE_LIMIT_PX);
  });

  it('clamps a backwards move by the same limit', () => {
    expect(moveRight(-SWAPPABLE_LIMIT_PX * 3).dragged.x).toBe(-SWAPPABLE_LIMIT_PX);
  });

  it('shortens the move to a quarter tile when the neighbour cannot swap', () => {
    // Целая клетка положила бы фишку ровно поверх блокера - картинка обмена,
    // которого не будет.
    expect(moveRight(TILE_STEP_PX, false).dragged.x).toBe(BLOCKED_LIMIT_PX);
    expect(BLOCKED_LIMIT_PX).toBeLessThan(SWAPPABLE_LIMIT_PX);
  });

  it('keeps the blocked move alive below its own limit', () => {
    expect(moveRight(4, false).dragged.x).toBe(4);
  });

  it('moves along the swipe axis only', () => {
    expect(
      resolveSwapDragOffset({ offset: 20, dCol: 0, dRow: -1, hasSwappablePartner: true })
    ).toEqual({ dragged: { x: 0, y: 20 }, partner: { x: 0, y: -20 } });
  });

  it('sends the partner the opposite way: the pair meets under the finger', () => {
    const { dragged, partner } = moveRight(30);

    expect(partner.x).toBe(-dragged.x);
    expect(partner.y).toBe(0);
  });

  it('stands still while the gesture has no axis yet', () => {
    expect(
      resolveSwapDragOffset({ offset: 40, dCol: 0, dRow: 0, hasSwappablePartner: true })
    ).toEqual({ dragged: { x: 0, y: 0 }, partner: { x: 0, y: 0 } });
  });
});

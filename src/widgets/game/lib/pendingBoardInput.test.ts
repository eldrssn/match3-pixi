import { describe, expect, it } from 'vitest';

import {
  canReplayPendingInput,
  canReplayPendingSwap,
  type IPendingInputGate,
} from './pendingBoardInput';

const LIVE_BOARD: IPendingInputGate = {
  isEntityOnBoard: true,
  isGameEnded: false,
  hasRuntimeFailure: false,
};

describe('canReplayPendingInput', () => {
  it('replays the buffered input on a live board', () => {
    expect(canReplayPendingInput(LIVE_BOARD)).toBe(true);
  });

  it('drops the input when its entity left the board', () => {
    // Фишку/лазер снесло матчем или чужим лазером, пока запрос ждал очереди.
    expect(canReplayPendingInput({ ...LIVE_BOARD, isEntityOnBoard: false })).toBe(false);
  });

  it('drops the input after the outcome is decided or the runtime failed', () => {
    expect(canReplayPendingInput({ ...LIVE_BOARD, isGameEnded: true })).toBe(false);
    expect(canReplayPendingInput({ ...LIVE_BOARD, hasRuntimeFailure: true })).toBe(false);
  });
});

describe('canReplayPendingSwap', () => {
  const ORIGIN = { col: 3, row: 5 };

  it('replays the swipe from the very cell it was made on', () => {
    expect(canReplayPendingSwap(LIVE_BOARD, ORIGIN, { col: 3, row: 5 })).toBe(true);
  });

  it('drops the swipe once gravity moved the chip', () => {
    // Ход на новой клетке игрок не выбирал, а списался бы он с него.
    expect(canReplayPendingSwap(LIVE_BOARD, ORIGIN, { col: 3, row: 8 })).toBe(false);
    expect(canReplayPendingSwap(LIVE_BOARD, ORIGIN, { col: 4, row: 5 })).toBe(false);
  });

  it('keeps every gate of the shared rule', () => {
    expect(canReplayPendingSwap({ ...LIVE_BOARD, isGameEnded: true }, ORIGIN, ORIGIN)).toBe(false);
    expect(canReplayPendingSwap({ ...LIVE_BOARD, isEntityOnBoard: false }, ORIGIN, ORIGIN)).toBe(
      false
    );
  });
});

import { describe, expect, it } from 'vitest';

import { canShowIdleHint, type IIdleHintGate } from './canShowIdleHint';

const FREE_BOARD: IIdleHintGate = {
  isBoardBusy: false,
  isGameEnded: false,
  hasRuntimeFailure: false,
  isAwaitingContinue: false,
};

describe('canShowIdleHint', () => {
  it('allows the hint on a free board of a running party', () => {
    expect(canShowIdleHint(FREE_BOARD)).toBe(true);
  });

  it('keeps quiet while the board is busy', () => {
    // Пара, найденная посреди каскада, к моменту пульса уже уехала бы.
    expect(canShowIdleHint({ ...FREE_BOARD, isBoardBusy: true })).toBe(false);
  });

  it('keeps quiet after the party is over', () => {
    expect(canShowIdleHint({ ...FREE_BOARD, isGameEnded: true })).toBe(false);
    expect(canShowIdleHint({ ...FREE_BOARD, hasRuntimeFailure: true })).toBe(false);
  });

  it('keeps quiet while the party waits for the host to offer more moves', () => {
    expect(canShowIdleHint({ ...FREE_BOARD, isAwaitingContinue: true })).toBe(false);
  });
});

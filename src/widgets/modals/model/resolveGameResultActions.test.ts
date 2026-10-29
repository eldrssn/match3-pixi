import { describe, expect, it } from 'vitest';
import { MODAL_KEYS } from './modal-registry';
import { resolveGameResultActions } from './resolveGameResultActions';

describe('resolveGameResultActions', () => {
  it('offers the next level and home on victory', () => {
    expect(resolveGameResultActions(MODAL_KEYS.VICTORY)).toEqual([
      { id: 'next', label: 'Дальше', variant: 'primary' },
      { id: 'go-home', label: 'На главную', variant: 'secondary' },
    ]);
  });

  it('offers a retry of the same level and home on defeat', () => {
    expect(resolveGameResultActions(MODAL_KEYS.DEFEAT)).toEqual([
      { id: 'retry', label: 'Ещё раз', variant: 'primary' },
      { id: 'go-home', label: 'На главную', variant: 'secondary' },
    ]);
  });
});

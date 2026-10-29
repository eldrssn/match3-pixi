import { describe, expect, it } from 'vitest';
import { MODAL_KEYS } from './modal-registry';
import { resolveActiveLayer } from './resolveActiveLayer';

describe('resolveActiveLayer', () => {
  it('returns nothing when no modal is open', () => {
    expect(resolveActiveLayer([])).toEqual({ layer: null, topKey: null, visibleKeys: [] });
  });

  it('shows a single base modal', () => {
    expect(resolveActiveLayer([MODAL_KEYS.VICTORY])).toEqual({
      layer: 'global',
      topKey: MODAL_KEYS.VICTORY,
      visibleKeys: [MODAL_KEYS.VICTORY],
    });
  });

  it('breaks a priority tie by the most recently opened modal', () => {
    const { visibleKeys } = resolveActiveLayer([MODAL_KEYS.VICTORY, MODAL_KEYS.DEFEAT]);

    expect(visibleKeys).toEqual([MODAL_KEYS.DEFEAT]);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { MODAL_KEYS } from './modal-registry';
import { useModalsStore, type IGameResultModalProps } from './useModalsStore';

const resetStore = () =>
  useModalsStore.setState({
    modals: {},
    openKeys: [],
  });

const noop = () => undefined;
const RESULT_PROPS: IGameResultModalProps = { onPlay: noop, onHome: noop, score: 0, stars: 0 };

describe('useModalsStore', () => {
  beforeEach(resetStore);

  it('opens a modal and remembers the order of opening', () => {
    const { show } = useModalsStore.getState();

    show(MODAL_KEYS.DEFEAT, RESULT_PROPS);
    show(MODAL_KEYS.VICTORY, RESULT_PROPS);

    expect(useModalsStore.getState().openKeys).toEqual([MODAL_KEYS.DEFEAT, MODAL_KEYS.VICTORY]);
  });

  it('does not duplicate an already opened modal with the same props', () => {
    const { show } = useModalsStore.getState();

    show(MODAL_KEYS.VICTORY, RESULT_PROPS);
    const stateAfterFirstShow = useModalsStore.getState();
    show(MODAL_KEYS.VICTORY, { ...RESULT_PROPS });

    expect(useModalsStore.getState().modals).toBe(stateAfterFirstShow.modals);
    expect(useModalsStore.getState().openKeys).toEqual([MODAL_KEYS.VICTORY]);
  });

  it('keeps props after hide so the exit animation does not flash defaults', () => {
    const { show, hide } = useModalsStore.getState();

    show(MODAL_KEYS.VICTORY, RESULT_PROPS);
    hide(MODAL_KEYS.VICTORY);

    const entry = useModalsStore.getState().modals[MODAL_KEYS.VICTORY];

    expect(entry?.isOpen).toBe(false);
    expect(entry?.props).toEqual(RESULT_PROPS);
    expect(useModalsStore.getState().openKeys).toEqual([]);
  });

  it('forgets the entry on purge', () => {
    const { show, hide, purge } = useModalsStore.getState();

    show(MODAL_KEYS.VICTORY, RESULT_PROPS);
    hide(MODAL_KEYS.VICTORY);
    purge(MODAL_KEYS.VICTORY);

    expect(useModalsStore.getState().modals[MODAL_KEYS.VICTORY]).toBeUndefined();
  });

  it('closes several modals in a single update', () => {
    const { show, hideMany } = useModalsStore.getState();

    show(MODAL_KEYS.DEFEAT, RESULT_PROPS);
    show(MODAL_KEYS.VICTORY, RESULT_PROPS);
    hideMany([MODAL_KEYS.VICTORY, MODAL_KEYS.DEFEAT]);

    const state = useModalsStore.getState();

    expect(state.openKeys).toEqual([]);
    expect(state.modals[MODAL_KEYS.DEFEAT]?.isOpen).toBe(false);
    expect(state.modals[MODAL_KEYS.VICTORY]?.isOpen).toBe(false);
  });

  it('ignores hideMany for modals that are already closed', () => {
    const { show, hideMany } = useModalsStore.getState();

    show(MODAL_KEYS.DEFEAT, RESULT_PROPS);
    hideMany([MODAL_KEYS.DEFEAT]);
    const stateAfterHide = useModalsStore.getState();
    hideMany([MODAL_KEYS.DEFEAT, MODAL_KEYS.VICTORY]);

    expect(useModalsStore.getState().modals).toBe(stateAfterHide.modals);
  });
});

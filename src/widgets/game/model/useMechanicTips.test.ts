import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameStore } from '../store/GameStore';
import { useMechanicTips } from './useMechanicTips';

beforeEach(() => {
  useGameStore.getState().resetStore();
});

describe('useMechanicTips', () => {
  it('молчит до конца интро, потом показывает подсказки по одной', () => {
    const onTutorialSeen = vi.fn();
    const { result } = renderHook(() => useMechanicTips(['ice', 'cargo'], onTutorialSeen));

    expect(result.current).toMatchObject({ currentTip: undefined, isBlocking: false });

    act(() => useGameStore.getState().setIntroFinished());
    expect(result.current).toMatchObject({ currentTip: 'ice', isBlocking: true });

    act(() => result.current.dismiss());
    expect(onTutorialSeen).toHaveBeenCalledWith('ice');
    expect(result.current.currentTip).toBe('cargo');

    act(() => result.current.dismiss());
    expect(onTutorialSeen).toHaveBeenLastCalledWith('cargo');
    expect(result.current).toMatchObject({ currentTip: undefined, isBlocking: false });
  });

  it('без обучения доску не держит', () => {
    const { result } = renderHook(() => useMechanicTips(undefined, undefined));

    act(() => useGameStore.getState().setIntroFinished());

    expect(result.current.isBlocking).toBe(false);
  });
});

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { INITIAL_MINIGAME_LEVEL_CONFIG } from '@/entities/game';
import { useGameStore } from '../store/GameStore';
import { useLevelConfigStore } from '../store/levelConfigStore';
import { useGameRuntimeEvents } from './useGameRuntimeEvents';

const renderEvents = () => {
  const callbacks = {
    onFinish: vi.fn(),
    onOutOfMoves: vi.fn(),
    onExitRequest: vi.fn(),
    onError: vi.fn(),
  };
  const hook = renderHook(() => useGameRuntimeEvents(callbacks));

  return { callbacks, finish: hook.result.current };
};

beforeEach(() => {
  useGameStore.getState().resetStore();
  useLevelConfigStore.getState().clearLevelConfig();
});

describe('useGameRuntimeEvents', () => {
  it('отдаёт исход только после финальной сцены и ровно один раз', () => {
    const { callbacks } = renderEvents();

    act(() => {
      useGameStore.getState().setIsGameEnded(true);
    });
    expect(callbacks.onFinish).not.toHaveBeenCalled();

    act(() => {
      useGameStore.getState().setFinaleFinished();
      useGameStore.getState().setBoardBusy(true);
    });

    expect(callbacks.onFinish).toHaveBeenCalledTimes(1);
    expect(callbacks.onFinish).toHaveBeenCalledWith({ isVictory: true, score: 0, stars: null });
  });

  it('отладочный исход не дублируется исходом из рантайма', () => {
    const { callbacks, finish } = renderEvents();

    act(() => {
      finish(false);
      useGameStore.getState().setIsGameEnded(true);
      useGameStore.getState().setFinaleFinished();
    });

    expect(callbacks.onFinish).toHaveBeenCalledTimes(1);
    expect(callbacks.onFinish).toHaveBeenCalledWith({ isVictory: false, score: 0, stars: null });
  });

  it('исход несёт очки партии и звёзды по порогам уровня', () => {
    const { callbacks } = renderEvents();

    useLevelConfigStore.getState().setLevelConfig({
      ...INITIAL_MINIGAME_LEVEL_CONFIG,
      starScores: [1000, 2000],
    });

    act(() => {
      useGameStore.getState().addScore(1500);
      useGameStore.getState().setIsGameEnded(true);
      useGameStore.getState().setFinaleFinished();
    });

    expect(callbacks.onFinish).toHaveBeenCalledWith({ isVictory: true, score: 1500, stars: 2 });
  });

  it('на исходе ходов отдаёт хосту незакрытые цели и решение', () => {
    const { callbacks } = renderEvents();

    act(() => {
      useGameStore.getState().initGoals([
        { id: 'red', count: 5 },
        { id: 'cargo', count: 1 },
      ]);
      useGameStore.getState().decreaseGoal('red');
      useGameStore.getState().decreaseGoal('cargo');
      useGameStore.getState().offerContinue();
    });

    expect(callbacks.onOutOfMoves).toHaveBeenCalledTimes(1);

    const [offer] = callbacks.onOutOfMoves.mock.calls[0];

    expect(offer.goalsLeft).toEqual([{ id: 'red', left: 4 }]);

    act(() => {
      offer.continueWith(5);
      // Повторное решение ничего не меняет: ходы даются один раз.
      offer.continueWith(5);
    });

    expect(useGameStore.getState()).toMatchObject({ outOfMoves: 'none', movesCount: 5 });
  });

  it('отказ хоста переводит партию в поражение', () => {
    const { callbacks } = renderEvents();

    act(() => {
      useGameStore.getState().offerContinue();
    });
    act(() => {
      callbacks.onOutOfMoves.mock.calls[0][0].giveUp();
    });

    expect(useGameStore.getState().outOfMoves).toBe('declined');
  });

  it('каждое нажатие выхода доходит до хоста', () => {
    const { callbacks } = renderEvents();

    act(() => {
      useGameStore.getState().exitButtonOnClick();
    });
    act(() => {
      useGameStore.getState().exitButtonOnClick();
    });

    expect(callbacks.onExitRequest).toHaveBeenCalledTimes(2);
    expect(useGameStore.getState().isExitRequested).toBe(false);
  });

  it('передаёт причину отказа рантайма', () => {
    const { callbacks } = renderEvents();

    act(() => {
      useGameStore.getState().failRuntime('board');
    });

    expect(callbacks.onError).toHaveBeenCalledWith('board');
  });
});

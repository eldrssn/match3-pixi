import { useCallback, useEffect, useRef } from 'react';
import { resolveLevelStars } from '@/entities/game';
import { getRuntimeStarScores } from '../configs/levelConfig';
import { useGameStore } from '../store/GameStore';
import { subscribeBoardEvents } from './boardEventBus';
import { diffStoreBoardEvents } from './boardEvents';
import type { IGameOutcome, IGameScreenCallbacks, IOutOfMovesOffer } from './gameScreenTypes';

/**
 * Исход партии по стору: очки - те, что набрал рантайм, звёзды - по порогам
 * уровня (без порогов - `null`). Отладочная кнопка «Выиграть» получает исход тем же путём.
 */
const buildOutcome = (isVictory: boolean): IGameOutcome => {
  const { score } = useGameStore.getState();

  return { isVictory, score, stars: resolveLevelStars(isVictory, score, getRuntimeStarScores()) };
};

/**
 * Предложение хосту на исходе ходов: незакрытые цели и два решения. Решения
 * пишут в стор, а доска (`GameLogic`) подписана на него и доигрывает выбор.
 */
const buildOutOfMovesOffer = (): IOutOfMovesOffer => ({
  goalsLeft: useGameStore
    .getState()
    .goals.filter((goal) => !goal.isCompleted)
    .map((goal) => ({ id: goal.id, left: Math.max(0, goal.target - goal.current) })),
  continueWith: (moves) => useGameStore.getState().continueParty(moves),
  giveUp: () => useGameStore.getState().declineContinue(),
});

/**
 * Мост «события рантайма -> колбэки хоста». Игра ничего не знает про хост:
 * модули сцены только пишут флаги в `GameStore`, а этот хук переводит их
 * переходы в `onFinish` / `onOutOfMoves` / `onExitRequest` / `onError`, а
 * переходы стора и события шагов (`boardEventBus`) - в `onBoardEvent`.
 *
 * Колбэки читаются через ref: хост вправе передавать новые функции на каждый
 * рендер, а переподписка на стор посреди партии ничего не даёт.
 *
 * Возвращает `finish` - ту же отправку исхода, что и из рантайма, для отладочных
 * кнопок экрана. Исход уходит ровно один раз на маунт: экран живёт одну партию.
 */
export const useGameRuntimeEvents = (
  callbacks: IGameScreenCallbacks
): ((isVictory: boolean) => void) => {
  const callbacksRef = useRef(callbacks);
  const isFinishedRef = useRef(false);

  useEffect(() => {
    callbacksRef.current = callbacks;
  });

  const finish = useCallback((isVictory: boolean) => {
    if (isFinishedRef.current) {
      return;
    }

    isFinishedRef.current = true;
    callbacksRef.current.onFinish(buildOutcome(isVictory));
  }, []);

  useEffect(() => {
    const unsubscribeSteps = subscribeBoardEvents((event) => {
      callbacksRef.current.onBoardEvent?.(event);
    });
    const unsubscribeStore = useGameStore.subscribe((state, previousState) => {
      const { onBoardEvent } = callbacksRef.current;

      if (onBoardEvent) {
        diffStoreBoardEvents(previousState, state).forEach(onBoardEvent);
      }

      if (state.runtimeFailure !== null && previousState.runtimeFailure === null) {
        callbacksRef.current.onError(state.runtimeFailure);
        return;
      }

      if (state.outOfMoves === 'pending' && previousState.outOfMoves !== 'pending') {
        const { onOutOfMoves } = callbacksRef.current;

        // Хост перестал слушать посреди партии - решать некому, это поражение.
        if (onOutOfMoves) {
          onOutOfMoves(buildOutOfMovesOffer());
        } else {
          useGameStore.getState().declineContinue();
        }

        return;
      }

      if (state.isExitRequested && !previousState.isExitRequested) {
        // Флаг значит «нажали прямо сейчас», а не «выход подтверждён»: без
        // сброса повторное нажатие (хост решил не выходить) не дало бы
        // перехода `false -> true`.
        useGameStore.getState().clearExitRequest();
        callbacksRef.current.onExitRequest();
        return;
      }

      // Не раньше, чем рантайм доиграет финальную сцену на доске:
      // `isFinaleFinished` ставится последним её шагом.
      if (state.isGameEnded && state.isFinaleFinished) {
        finish(state.isGameWin);
      }
    });

    return () => {
      unsubscribeSteps();
      unsubscribeStore();
    };
  }, [finish]);

  return finish;
};

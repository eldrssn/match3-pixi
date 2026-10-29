import type { TBoardEvent } from './boardEvents';

type TBoardEventListener = (event: TBoardEvent) => void;

/**
 * Канал событий шагов из рантайма в React-слой (`useGameRuntimeEvents`): то, что
 * несёт сам протокол хода (каскад, рождение спецфишки), а не состояние стора.
 * Один на приложение - как и живой рантайм (`GameStore`).
 */
const listeners = new Set<TBoardEventListener>();

export const emitBoardEvents = (events: readonly TBoardEvent[]): void => {
  for (const event of events) {
    for (const listener of listeners) {
      listener(event);
    }
  }
};

export const subscribeBoardEvents = (listener: TBoardEventListener): (() => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

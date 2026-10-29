import type {
  IBoardSpecialPlacement,
  TBoardStep,
  TGameBoosterKind,
  TSpecialKind,
} from '@/entities/game';
import type { TBoardStepOf, TBoardStepType } from './boardStepTypes';

/**
 * Откуда спецфишка: собрана фигурой (`match`), превращена из фишки - радуга в
 * паре со спецфишкой и финальный бонус (`transform`), или встала предуровневым
 * бустером (`preBoost`).
 */
export type TBoardSpecialSource = 'match' | 'transform' | 'preBoost';

/**
 * События партии для хоста (`IGameScreenProps.onBoardEvent`): аналитика,
 * вибрация, свои звуки, ачивки. Только факты партии - ни спрайтов, ни сцены:
 * выводятся из протокола хода движка и `GameStore`, а не из анимаций, поэтому
 * не зависят от вида клеток и переопределённых анимаций шагов.
 */
export type TBoardEvent =
  /** Ход засчитан (свап или тап спецфишки) - до его анимации. */
  | { type: 'moveMade'; movesMade: number; movesLeft: number }
  /** Звено каскада: `iteration` - его номер с единицы, `groups` - сколько фигур собрано. */
  | { type: 'cascade'; iteration: number; groups: number }
  | {
      type: 'specialCreated';
      kind: TSpecialKind;
      col: number;
      row: number;
      source: TBoardSpecialSource;
    }
  /** Шаг цели уровня. */
  | { type: 'goalProgress'; id: string; current: number; target: number }
  /** Цель закрыта - один раз на цель. */
  | { type: 'goalCompleted'; id: string }
  /** Бустер применён: заряд списан. */
  | { type: 'boosterUsed'; kind: TGameBoosterKind; left: number }
  /** Очки выросли; `delta` - сколько добавил шаг. */
  | { type: 'scoreChanged'; score: number; delta: number };

export type TBoardEventType = TBoardEvent['type'];

const specialCreated = (
  { piece, col, row }: IBoardSpecialPlacement,
  source: TBoardSpecialSource
): TBoardEvent => ({ type: 'specialCreated', kind: piece.id, col, row, source });

/**
 * События шага по его виду. Реестр частичный: шаг без записи (`swap`,
 * `damage`, `settle`, ...) событий хосту не несёт - их выводит стор.
 */
const STEP_BOARD_EVENTS: {
  readonly [T in TBoardStepType]?: (step: TBoardStepOf<T>) => TBoardEvent[];
} = {
  matches: ({ iteration, groups }) => [{ type: 'cascade', iteration, groups: groups.length }],
  special: ({ placement }) => [specialCreated(placement, 'match')],
  transform: ({ changes }) =>
    changes.map(({ placement }) => specialCreated(placement, 'transform')),
  preBoost: ({ placements }) =>
    placements.map((placement) => specialCreated(placement, 'preBoost')),
};

/** События, которые несёт сам шаг протокола: каскад и рождение спецфишек. */
export const listStepBoardEvents = (step: TBoardStep): TBoardEvent[] => {
  // Запись реестра берётся по виду этого же шага: сужение по `step.type`
  // компилятор через индекс не протаскивает.
  const list = STEP_BOARD_EVENTS[step.type] as ((step: TBoardStep) => TBoardEvent[]) | undefined;

  return list ? list(step) : [];
};

/** То из `GameStore`, из чего выводятся события партии. */
export interface IBoardEventSource {
  movesMade: number;
  movesCount: number;
  score: number;
  goals: readonly { id: string; current: number; target: number; isCompleted: boolean }[];
  boosters: readonly { kind: TGameBoosterKind; quantity: number }[];
}

/**
 * События по переходу стора. Только рост: сброс стора между партиями
 * (`resetStore`) обнуляет счётчики, и это не «очки упали» и не «цель
 * откатилась». Добавочные ходы хоста (`continueParty`) - тоже не ход.
 */
export const diffStoreBoardEvents = (
  previous: IBoardEventSource,
  next: IBoardEventSource
): TBoardEvent[] => {
  const events: TBoardEvent[] = [];

  if (next.movesMade > previous.movesMade) {
    events.push({ type: 'moveMade', movesMade: next.movesMade, movesLeft: next.movesCount });
  }

  if (next.goals !== previous.goals) {
    for (const goal of next.goals) {
      const before = previous.goals.find(({ id }) => id === goal.id);

      if (!before || goal.current <= before.current) {
        continue;
      }

      events.push({
        type: 'goalProgress',
        id: goal.id,
        current: goal.current,
        target: goal.target,
      });

      if (goal.isCompleted && !before.isCompleted) {
        events.push({ type: 'goalCompleted', id: goal.id });
      }
    }
  }

  if (next.boosters !== previous.boosters) {
    for (const booster of next.boosters) {
      const before = previous.boosters.find(({ kind }) => kind === booster.kind);

      if (before && booster.quantity < before.quantity) {
        events.push({ type: 'boosterUsed', kind: booster.kind, left: booster.quantity });
      }
    }
  }

  if (next.score > previous.score) {
    events.push({ type: 'scoreChanged', score: next.score, delta: next.score - previous.score });
  }

  return events;
};

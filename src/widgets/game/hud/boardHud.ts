import type { IGoalFlightTarget } from '../fx/boardFx';

/**
 * Что доске нужно от шапки партии: счётчик ходов, панель целей и её интро.
 *
 * Оркестратор хода (`GameLogic`) и проигрыватель шагов (`BoardStepPlayer`)
 * зовут шапку через этот контракт, а не модули напрямую - как эталон звал
 * `movesCounter`, `gameGoals` из реестра ядра. Состояние партии (ходы, цели)
 * живёт в `GameStore`; шапка только показывает его и анимирует смену.
 * Реализация - `createBoardHud` поверх `MovesCounter` и `GameGoalsPannel`.
 */
export interface IBoardHud {
  /** Ходы и цели уровня уже в сторе: шапка собирает счётчик и панель. */
  init(): void;
  /**
   * Ход списан: стор (`decreaseMovesCount`) и пульс цифры - одной точкой, как
   * `MovesCounter.decreaseCount` эталона.
   */
  decreaseMoves(): void;
  /** Счётчик перечитывает стор - добавочные ходы near-miss. */
  refreshMoves(): void;
  /** Панель целей перечитывает стор - шаг хода засчитал цель. */
  refreshGoals(): void;
  /** Куда лететь копии засчитанного элемента; `null` - цели нет на панели. */
  getGoalTarget(goalId: string): IGoalFlightTarget | null;
  /** Интро цели: затемнение, укрупнённая панель, удержание. */
  playIntroHold(): Promise<void>;
  /** Полёт панели в шапку - доска собирается под ним (`GameLogic.initAnimation`). */
  playIntroOutro(): Promise<void>;
}

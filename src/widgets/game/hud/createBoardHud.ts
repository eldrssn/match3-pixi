import type { GameGoalsPannel } from '../modules/GameGoalsPannel';
import type { MovesCounter } from '../modules/MovesCounter';
import type { IBoardHud } from './boardHud';

interface IBoardHudParts {
  goals: GameGoalsPannel;
  moves: MovesCounter;
}

/**
 * Шапка партии глазами доски (`IBoardHud`) поверх модулей шапки - те же
 * вызовы, что `GameLogic` эталона делал в `movesCounter` и `gameGoals` через
 * реестр ядра. Остальные модули шапки (очки, бустеры, выход, звук) доске не
 * нужны: они живут на сторе и шине.
 */
export const createBoardHud = ({ goals, moves }: IBoardHudParts): IBoardHud => ({
  init: () => {
    // Порядок эталона (`initStates`): счётчик снапается на ходы уровня,
    // панель собирается из целей.
    moves.updateCount();
    goals.init();
  },
  decreaseMoves: () => moves.decreaseCount(),
  refreshMoves: () => moves.updateCount(),
  refreshGoals: () => goals.updateGoals(),
  getGoalTarget: (goalId) => goals.getGoalTarget(goalId),
  playIntroHold: () => goals.playIntroHold(),
  playIntroOutro: () => goals.playIntroOutro(),
});

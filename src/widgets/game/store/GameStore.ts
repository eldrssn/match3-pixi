import { create } from 'zustand';
import { getRenderQuality, type TRenderQuality } from '../configs/renderQuality';
import type { TRendererKind } from '../configs/renderer';
import { GAME_BOOSTER_KINDS, type IGameStartBooster, type TGameBoosterKind } from '@/entities/game';

interface LevelGoal {
  id: string;
  count: number;
}

// Вид бустера живёт в `entities/game`. Реэкспорт - чтобы модули рантайма
// продолжали импортировать тип из стора, рядом с которым они работают.
export type { TGameBoosterKind };

export interface GameBoosterState {
  kind: TGameBoosterKind;
  quantity: number;
}

/**
 * Рантайм сломался так, что партию продолжать нечем.
 *
 * `assets` - часть текстур не загрузилась (битый CDN, обрыв сети): рантайм
 * подставил бы `__MISSING`-квадраты, а доска осталась бы формально играбельной.
 * `context-lost` - графический контекст (WebGL или WebGPU) потерян и не
 * восстановился, либо не поднялся вовсе (обычное дело в
 * WebView при сворачивании): канвас чёрный, рендера нет.
 * `board` - стартовая сборка сцены не дошла до конца: цели, фон доски или сам
 * обход `createBoard`. Типичная причина - неизвестный `id` ячейки в
 * `level_data`, на котором бросает `EntityFactory`, но ветка одна на любой сбой
 * старта: исключение приходит из середины сценария, часть доски уже создана, а
 * часть - нет. Играть на таком поле нельзя. Сюда же - исключение при сборке
 * сцены после готового приложения (`bootGameRuntime`: модуль, текстура).
 *
 * Все три случая уходят хосту одним колбэком `onError` (`useGameRuntimeEvents`):
 * что показать игроку, решает он.
 */
export type TGameRuntimeFailure = 'assets' | 'context-lost' | 'board';

// Тип для отслеживания прогресса целей
export interface GoalProgress {
  id: string;
  current: number; // Текущее количество
  target: number; // Целевое количество
  isCompleted: boolean;
}

/**
 * Ходы кончились, цели - нет (near-miss): `pending` - партия ждёт решения
 * хоста (`onOutOfMoves`), `declined` - хост отказался, партия кончается
 * поражением. Добавочные ходы возвращают `none`.
 */
export type TOutOfMovesState = 'none' | 'pending' | 'declined';

export interface GameStore {
  isGameLoaded: boolean;
  /**
   * Вступление отыграно: цель показана, доска собрана, предуровневые бустеры
   * на местах - дальше ход игрока. По этому флагу React-слой показывает
   * подсказку новой механики (`MechanicTip`) - не поверх интро.
   */
  isIntroFinished: boolean;
  /**
   * Доска занята асинхронным каскадом (свап, лазер, бустер). Зеркало
   * приватного `GameLogic._isProcessing` для клеток доски: под каскадом клетка
   * не едет за пальцем (`CellInputController.onGlobalPointerMove`).
   */
  isBoardBusy: boolean;
  isGameEnded: boolean;
  isGameWin: boolean;
  /**
   * Финальная сцена на доске отыграна (конфетти на победе, затемнение на
   * поражении). React-слой отдаёт исход хосту только по паре
   * `isGameEnded && isFinaleFinished` - иначе результат выскочил бы поверх ещё
   * играющей кульминации.
   */
  isFinaleFinished: boolean;
  movesCount: number;
  /**
   * Сколько ходов игрок сделал за партию. Отдельно от `movesCount`: остаток
   * ходов уменьшает и пересчёт в финальный бонус, и это не ход игрока
   * (событие хоста `moveMade` - `model/boardEvents`).
   */
  movesMade: number;
  /**
   * Очки партии (`entities/game` `boardScore`): растут по мере проигрывания
   * шагов хода и финального бонуса. Звёзды из них считает React-слой на
   * исходе (`resolveLevelStars`) - стору пороги уровня ни к чему.
   */
  score: number;
  outOfMoves: TOutOfMovesState;
  /** Последний ежесекундный замер FPS (`PerfMonitor`), для отладочной панели. */
  fps: number;
  /**
   * Качество отрисовки (`configs/renderQuality`). Зеркало для React-слоя:
   * смена качества меняет разрешение канваса, а его ведёт `useGameRuntime`.
   */
  renderQuality: TRenderQuality;
  /**
   * Рендерер, который реально поднял Pixi (`null` - ещё не поднят). Просьба
   * хоста (`renderer`) - лишь предпочтение, поэтому факт виден отладочной
   * панели отдельно.
   */
  rendererKind: TRendererKind | null;
  goals: GoalProgress[];
  boosters: GameBoosterState[];
  /**
   * Игрок нажал «выход» внутри канваса. Флаг, а не колбэк: React-слой ничего не
   * передаёт в игру, а подписывается на стор - так же, как на исход партии
   * (`useGameRuntimeEvents`).
   */
  isExitRequested: boolean;
  /**
   * Рантайм отказал. Флаг, а не колбэк, по той же причине, что и
   * `isExitRequested`: рантайм ничего не знает про хост, а React-слой подписан
   * на стор.
   */
  runtimeFailure: TGameRuntimeFailure | null;
  /** Графический контекст потерян прямо сейчас: рендера нет, ждём восстановления. */
  isContextLost: boolean;
  initMovesCount: (moves: number) => void;
  decreaseMovesCount: () => void;
  /** Ход игрока засчитан (свап или тап спецфишки). */
  countMove: () => void;
  addScore: (points: number) => void;
  setFps: (fps: number) => void;
  setRenderQuality: (quality: TRenderQuality) => void;
  setRendererKind: (kind: TRendererKind | null) => void;
  /** Ходы кончились, цели нет: ждать решения хоста. */
  offerContinue: () => void;
  /** Хост дал `moves` добавочных ходов: партия идёт дальше. */
  continueParty: (moves: number) => void;
  /** Хост отказался продолжать: партия кончается поражением. */
  declineContinue: () => void;
  setIsGameLoaded: () => void;
  setIntroFinished: () => void;
  setBoardBusy: (isBusy: boolean) => void;
  setIsGameEnded: (win: boolean) => void;
  setFinaleFinished: () => void;
  exitButtonOnClick: () => void;
  clearExitRequest: () => void;
  failRuntime: (reason: TGameRuntimeFailure) => void;
  setIsContextLost: (isLost: boolean) => void;

  initGoals: (levelGoals: LevelGoal[]) => void;
  decreaseGoal: (goalId: string) => boolean; // Возвращает true если цель выполнена
  areAllGoalsCompleted: () => boolean;
  getGoalProgress: (goalId: string) => number;
  initBoosters: (boosters: IGameStartBooster[]) => void;
  /**
   * Списать применение бустера: `quantity - 1`. Возвращает `false`, если
   * остаток исчерпан.
   */
  useBooster: (kind: TGameBoosterKind) => boolean;
  getBoosterQuantity: (kind: TGameBoosterKind) => number;

  resetStore: () => void; // Сбросить между играми
}

const initialState = {
  isGameLoaded: false,
  isIntroFinished: false,
  isBoardBusy: false,
  isGameEnded: false,
  isGameWin: false,
  isFinaleFinished: false,
  movesCount: 0,
  movesMade: 0,
  score: 0,
  outOfMoves: 'none' as TOutOfMovesState,
  fps: 0,
  renderQuality: 'high' as TRenderQuality,
  rendererKind: null as TRendererKind | null,
  goals: [],
  boosters: [],
  isExitRequested: false,
  runtimeFailure: null,
  isContextLost: false,
};

export const useGameStore = create<GameStore>()((set, get) => ({
  ...initialState,
  initMovesCount: (moves: number) => {
    set({ movesCount: moves });
  },
  decreaseMovesCount: () => {
    set((state) => ({ movesCount: state.movesCount - 1 }));
  },
  countMove: () => {
    set((state) => ({ movesMade: state.movesMade + 1 }));
  },
  addScore: (points: number) => {
    if (points > 0) {
      set((state) => ({ score: state.score + points }));
    }
  },
  setFps: (fps: number) => {
    set({ fps });
  },
  setRenderQuality: (quality: TRenderQuality) => {
    set({ renderQuality: quality });
  },
  setRendererKind: (kind) => {
    set({ rendererKind: kind });
  },
  offerContinue: () => {
    if (get().outOfMoves === 'none' && !get().isGameEnded) {
      set({ outOfMoves: 'pending' });
    }
  },
  // Решение принимается один раз: повторный колбэк хоста (двойной тап по
  // кнопке карточки) не добавит ходов второй раз и не передумает.
  continueParty: (moves: number) => {
    if (get().outOfMoves === 'pending' && moves > 0) {
      set((state) => ({ outOfMoves: 'none', movesCount: state.movesCount + Math.floor(moves) }));
    }
  },
  declineContinue: () => {
    if (get().outOfMoves === 'pending') {
      set({ outOfMoves: 'declined' });
    }
  },
  setIsGameEnded: (win: boolean) => {
    set({ isGameEnded: true, isGameWin: win });
  },
  setFinaleFinished: () => {
    set({ isFinaleFinished: true });
  },
  setIsGameLoaded: () => {
    set({ isGameLoaded: true });
  },
  setIntroFinished: () => {
    set({ isIntroFinished: true });
  },
  setBoardBusy: (isBusy: boolean) => {
    set({ isBoardBusy: isBusy });
  },
  exitButtonOnClick: () => {
    // На законченной партии выход уже не предлагается: исход принят, доска
    // доигрывает финальную сцену, и следом хост сам получит результат. Выход в
    // этом окне закрыл бы партию поверх только что выигранной.
    if (get().isGameEnded) {
      return;
    }

    // Из игры выход не выполняется: решение за хостом (`onExitRequest`).
    set({ isExitRequested: true });
  },
  clearExitRequest: () => {
    set({ isExitRequested: false });
  },

  /**
   * Первый отказ и решает: за потерей контекста обычно тянется каскад ошибок,
   * и переписывать причину последней из них значит показать игроку не ту.
   */
  failRuntime: (reason) => {
    if (get().runtimeFailure !== null) {
      return;
    }

    set({ runtimeFailure: reason });
  },

  setIsContextLost: (isLost) => {
    set({ isContextLost: isLost });
  },

  initGoals: (levelGoals: LevelGoal[]) => {
    const goals: GoalProgress[] = levelGoals.map((goal) => ({
      id: goal.id,
      current: 0,
      target: goal.count,
      isCompleted: false,
    }));
    set({ goals });
  },

  decreaseGoal: (goalId: string) => {
    const state = get();
    let goalFound = false;

    // Находим цель и обновляем
    const updatedGoals = state.goals.map((goal) => {
      if (goal.id === goalId && !goal.isCompleted) {
        goalFound = true;
        const newCurrent = goal.current + 1;
        const isCompleted = newCurrent >= goal.target;

        return {
          ...goal,
          current: newCurrent,
          isCompleted,
        };
      }
      return goal;
    });

    set({ goals: updatedGoals });

    return goalFound;
  },

  areAllGoalsCompleted: () => {
    const state = get();

    // Пустой список целей - это не «все цели закрыты»: `every` на пустом
    // массиве вернул бы `true`, и первая же проверка конца партии завершила бы
    // её победой. Целей нет ровно до `initGoals`, то есть между `resetStore` и
    // разбором конфига уровня, а также на уровне без целей.
    return state.goals.length > 0 && state.goals.every((g) => g.isCompleted);
  },

  getGoalProgress: (goalId: string) => {
    const state = get();
    const goal = state.goals.find((g) => g.id === goalId);
    return goal ? goal.current : 0;
  },
  initBoosters: (boosters) => {
    // Раскладка всегда содержит все три вида: не выданный партией бустер
    // заводится с нулевым остатком, а не пропадает из списка.
    set({
      boosters: GAME_BOOSTER_KINDS.map((kind) => ({
        kind,
        quantity: boosters.find((booster) => booster.kind === kind)?.quantity ?? 0,
      })),
    });
  },
  useBooster: (kind) => {
    const state = get();

    if (state.getBoosterQuantity(kind) <= 0) {
      return false;
    }

    set({
      boosters: state.boosters.map((booster) =>
        booster.kind === kind ? { ...booster, quantity: booster.quantity - 1 } : booster
      ),
    });

    return true;
  },
  getBoosterQuantity: (kind) =>
    get().boosters.find((booster) => booster.kind === kind)?.quantity ?? 0,
  // Качество отрисовки - зеркало модульного значения (`applyRenderQuality`):
  // сброс стора его не перетирает, а повторяет - стартовое качество партии
  // выставляется до сброса, вместе с её настройками (`setRuntimeLevelConfig`).
  resetStore: () => {
    set({ ...initialState, renderQuality: getRenderQuality() });
  },
}));

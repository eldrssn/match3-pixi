import { createSeededRandom, type TRandom } from '@/shared/lib/random';
import { BoardEngine } from '../engine/BoardEngine';
import type { IBoardCellPos, TBoardStep } from '../engine/boardSteps';
import { countGoalProgress } from '../lib/boardProgress';
import { scoreBoardStepsTotal } from '../lib/boardScore';
import type { IMinigameLevelConfig } from '../types';

/**
 * Бот-солвер на чистом движке: играет уровень каталога так, как играл бы
 * внимательный игрок, и меряет его сложность - доля побед, запас ходов,
 * тупики и «высыхание» поля.
 *
 * Без движка отрисовки и без времени: ход бота - тот же `trySwap`/`activateSpecialAt`,
 * что у рантайма, прогресс целей - тот же счёт по шагам
 * (`countGoalProgress`). С тем же зерном партия бота повторяется до клетки.
 *
 * Стратегия `greedy` примеряет каждый доступный ход на копии доски
 * (`BoardEngine.clone`) и берёт тот, что больше всего двигает цели; спецфишку
 * ценит как будущий прогресс. Это сильнее живого игрока: человек не
 * перебирает все ходы на каждом шаге. `casual` - модель обычного игрока:
 * лучший ход примерно в половине случаев, иначе любой, который движок примет;
 * по ней калибруется сложность каталога. `random` - нижняя граница.
 */

export type TLevelBotStrategy = 'greedy' | 'casual' | 'random';

/** Как часто `casual` находит лучший ход. */
const CASUAL_BEST_MOVE_SHARE = 0.5;

export interface ILevelBotOptions {
  /** Зерно партии: добор, перемешка и выбор бота среди равных ходов. */
  seed: number;
  strategy?: TLevelBotStrategy;
}

export interface ILevelBotRun {
  isVictory: boolean;
  /** Сколько ходов потрачено - до победы или до конца ходов. */
  movesUsed: number;
  movesLeft: number;
  /** Сколько снято по каждой цели уровня (может быть больше `count`). */
  progress: Record<string, number>;
  /** Очки партии (`boardScore`), с финальным бонусом на победе. */
  score: number;
  /** Партия кончилась тупиком без перемешки, а не ходами. */
  isStuck: boolean;
  /**
   * Больше всего пустых клеток после хода. Недостижимые клетки движок
   * добирает на месте (`planBoardGravity`), так что здесь всегда 0: метрика
   * сторожит это правило - пустая клетка значила бы «высыхание» поля.
   */
  maxEmptyCells: number;
}

/** Цена одной единицы цели и спецфишек в оценке хода. */
const GOAL_WEIGHT = 10;
const SPECIAL_WEIGHT: Record<string, number> = {
  laser: 3,
  propeller: 3,
  bomb: 4,
  rainbow: 7,
};

type TBotAction =
  { kind: 'swap'; from: IBoardCellPos; to: IBoardCellPos } | { kind: 'tap'; at: IBoardCellPos };

const countEmptyCells = (engine: BoardEngine): number => {
  let empty = 0;

  for (let col = 0; col < engine.cols; col++) {
    for (let row = 0; row < engine.rows; row++) {
      if (!engine.pieceAt({ col, row })) {
        empty++;
      }
    }
  }

  return empty;
};

const playAction = (engine: BoardEngine, action: TBotAction): TBoardStep[] | null => {
  if (action.kind === 'tap') {
    return engine.activateSpecialAt(action.at);
  }

  const outcome = engine.trySwap(action.from, action.to);

  return outcome.kind === 'accepted' ? outcome.steps : null;
};

const listActions = (engine: BoardEngine): TBotAction[] => [
  ...engine.listMoves().map(([from, to]): TBotAction => ({ kind: 'swap', from, to })),
  ...engine.listSpecials().map((at): TBotAction => ({ kind: 'tap', at })),
];

/** Сколько ещё нужно по каждой цели. */
const remainingGoals = (
  level: IMinigameLevelConfig,
  progress: ReadonlyMap<string, number>
): Map<string, number> =>
  new Map(
    level.levelGoals.map((goal) => [
      goal.id,
      Math.max(0, goal.count - (progress.get(goal.id) ?? 0)),
    ])
  );

const isLevelDone = (level: IMinigameLevelConfig, progress: ReadonlyMap<string, number>): boolean =>
  level.levelGoals.every((goal) => (progress.get(goal.id) ?? 0) >= goal.count);

/**
 * Оценка хода: прогресс по ещё нужным целям плюс спецфишки, рождённые ходом
 * (им предстоит сработать). Спецфишка, потраченная тапом, вычитается - иначе
 * бот взрывал бы их впустую ради нуля.
 */
const scoreAction = (
  engine: BoardEngine,
  action: TBotAction,
  remaining: ReadonlyMap<string, number>,
  random: TRandom
): number => {
  const trial = engine.clone(random);
  const steps = playAction(trial, action);

  if (!steps) {
    return Number.NEGATIVE_INFINITY;
  }

  const gained = countGoalProgress(steps);
  let score = 0;

  remaining.forEach((left, id) => {
    score += Math.min(left, gained.get(id) ?? 0) * GOAL_WEIGHT;
  });

  for (const step of steps) {
    if (step.type === 'special') {
      score += SPECIAL_WEIGHT[step.placement.piece.id] ?? 0;
    }
  }

  if (action.kind === 'tap') {
    const piece = engine.pieceAt(action.at);

    score -= piece ? (SPECIAL_WEIGHT[piece.id] ?? 0) : 0;
  }

  return score;
};

/** Одна партия бота на уровне. */
export const playLevelWithBot = (
  level: IMinigameLevelConfig,
  { seed, strategy = 'greedy' }: ILevelBotOptions
): ILevelBotRun => {
  const engine = BoardEngine.fromLevel(level.grid, {
    colors: level.colors,
    random: createSeededRandom(seed),
  });
  // Свой источник для выбора бота и для примерок: иначе каждая примерка
  // отъедала бы числа у добора партии, и одно зерно давало бы разные партии
  // при разной стратегии.
  const choice = createSeededRandom((seed ^ 0x5bd1e995) >>> 0);
  const progress = new Map<string, number>();
  let movesUsed = 0;
  let score = 0;
  let isStuck = false;
  let maxEmptyCells = 0;

  while (movesUsed < level.moves && !isLevelDone(level, progress)) {
    const actions = listActions(engine);

    if (actions.length === 0) {
      isStuck = true;
      break;
    }

    let action = actions[Math.floor(choice() * actions.length)];
    const looksForBest =
      strategy === 'greedy' || (strategy === 'casual' && choice() < CASUAL_BEST_MOVE_SHARE);

    if (looksForBest) {
      const remaining = remainingGoals(level, progress);
      let best = Number.NEGATIVE_INFINITY;

      for (const candidate of actions) {
        // Случайная добавка меньше единицы цели - только разбивает ничьи.
        const score = scoreAction(engine, candidate, remaining, choice) + choice();

        if (score > best) {
          best = score;
          action = candidate;
        }
      }
    }

    const steps = playAction(engine, action);

    if (!steps) {
      isStuck = true;
      break;
    }

    movesUsed++;
    countGoalProgress(steps, progress);
    score += scoreBoardStepsTotal(steps);

    const deadEnd = engine.resolveDeadEnd();

    if (deadEnd.kind === 'shuffled') {
      countGoalProgress(deadEnd.steps, progress);
      score += scoreBoardStepsTotal(deadEnd.steps);
    }

    maxEmptyCells = Math.max(maxEmptyCells, countEmptyCells(engine));

    if (deadEnd.kind === 'stuck') {
      isStuck = !isLevelDone(level, progress);
      break;
    }
  }

  const isVictory = isLevelDone(level, progress);

  // Победа с запасом ходов доигрывает финальный бонус - как партия в рантайме.
  if (isVictory) {
    score += scoreBoardStepsTotal(engine.playFinale(level.moves - movesUsed));
  }

  return {
    isVictory,
    movesUsed,
    movesLeft: level.moves - movesUsed,
    progress: Object.fromEntries(progress),
    score,
    isStuck,
    maxEmptyCells,
  };
};

export interface ILevelBotReport {
  runs: number;
  /** Доля побед, 0..1. */
  winRate: number;
  /** Средний запас ходов в победных партиях. */
  avgMovesLeftOnWin: number;
  /** Доля партий, кончившихся тупиком без перемешки. */
  stuckRate: number;
  /** Худшее «высыхание» поля за все партии. */
  maxEmptyCells: number;
  /** Средний прогресс по каждой цели, обрезанный по `count`. */
  avgGoalProgress: Record<string, number>;
  /** Очки победных партий по возрастанию - из них подбираются пороги звёзд. */
  winScores: number[];
}

/**
 * Сводка партий бота по уровню. Отдельно от прогона: редактор играет партии
 * по одной между кадрами, чтобы не замораживать страницу, и сводит их тем же
 * правилом, что и тест каталога.
 */
export const summarizeBotRuns = (
  level: IMinigameLevelConfig,
  results: readonly ILevelBotRun[]
): ILevelBotReport => {
  const runs = results.length;
  const wins = results.filter((result) => result.isVictory);
  const goalSums = new Map<string, number>();

  results.forEach((result) => {
    level.levelGoals.forEach((goal) => {
      goalSums.set(
        goal.id,
        (goalSums.get(goal.id) ?? 0) + Math.min(goal.count, result.progress[goal.id] ?? 0)
      );
    });
  });

  return {
    runs,
    winRate: runs > 0 ? wins.length / runs : 0,
    avgMovesLeftOnWin:
      wins.length > 0 ? wins.reduce((sum, win) => sum + win.movesLeft, 0) / wins.length : 0,
    stuckRate: runs > 0 ? results.filter((result) => result.isStuck).length / runs : 0,
    maxEmptyCells: results.reduce((max, result) => Math.max(max, result.maxEmptyCells), 0),
    avgGoalProgress: Object.fromEntries(
      [...goalSums].map(([id, sum]) => [id, runs > 0 ? sum / runs : 0])
    ),
    winScores: wins.map((win) => win.score).sort((a, b) => a - b),
  };
};

/** Сложность уровня по `runs` партиям бота с зёрнами `firstSeed..firstSeed+runs-1`. */
export const measureLevelWithBot = (
  level: IMinigameLevelConfig,
  {
    runs,
    firstSeed = 1,
    strategy = 'greedy',
  }: { runs: number; firstSeed?: number; strategy?: TLevelBotStrategy }
): ILevelBotReport =>
  summarizeBotRuns(
    level,
    Array.from({ length: runs }, (_, run) =>
      playLevelWithBot(level, { seed: firstSeed + run, strategy })
    )
  );

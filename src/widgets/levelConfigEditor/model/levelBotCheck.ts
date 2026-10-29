import {
  playLevelWithBot,
  suggestStarScores,
  summarizeBotRuns,
  type ILevelBotReport,
  type ILevelBotRun,
  type IMinigameLevelConfig,
  type TLevelBotStrategy,
} from '@/entities/game';
import { LEVEL_DIFFICULTY_WIN_RATE } from '@/entities/level';
import { disableStarScores } from './levelStarScores';
import { EDITOR_TEXTS } from './texts';

/**
 * Сколько партий играет каждая модель игрока. Обычного игрока тест каталога
 * (`levelCatalog.bot.test.ts`) гоняет столько же, сильного - меньше: там от
 * него нужна только проходимость, а здесь обе модели идут в одну сводку.
 */
export const BOT_CHECK_RUNS = 12;

const STRATEGIES: readonly TLevelBotStrategy[] = ['greedy', 'casual'];

export interface ILevelBotCheckResult {
  /** Сильный игрок: видит лучший ход на каждом шаге. */
  greedy: ILevelBotReport;
  /** Обычный игрок: лучший ход примерно через раз. */
  casual: ILevelBotReport;
  /** Пороги звёзд по очкам обычного игрока; `null` - он ни разу не выиграл. */
  suggestedStars: [number, number] | null;
}

interface IBotCheckRunPlan {
  strategy: TLevelBotStrategy;
  seed: number;
}

/** Партия проверки вместе с моделью игрока, которая её сыграла. */
export interface IBotCheckRun extends ILevelBotRun {
  strategy: TLevelBotStrategy;
}

/** Все партии проверки по порядку: каждая - отдельный шаг, между ними страница живёт. */
export const listBotCheckRuns = (): IBotCheckRunPlan[] =>
  STRATEGIES.flatMap((strategy) =>
    Array.from({ length: BOT_CHECK_RUNS }, (_, index) => ({ strategy, seed: index + 1 }))
  );

export const playBotCheckRun = (
  level: IMinigameLevelConfig,
  { strategy, seed }: IBotCheckRunPlan
): IBotCheckRun => ({ ...playLevelWithBot(level, { seed, strategy }), strategy });

/**
 * Сводка проверки по сыгранным партиям. Модель игрока берётся из самой
 * партии, а не из её места в списке: порядок `STRATEGIES` можно менять, и
 * сильный игрок с обычным от этого не перепутаются.
 */
export const summarizeBotCheck = (
  level: IMinigameLevelConfig,
  runs: readonly IBotCheckRun[]
): ILevelBotCheckResult => {
  const runsOf = (strategy: TLevelBotStrategy) => runs.filter((run) => run.strategy === strategy);
  const greedy = summarizeBotRuns(level, runsOf('greedy'));
  const casual = summarizeBotRuns(level, runsOf('casual'));

  return { greedy, casual, suggestedStars: suggestStarScores(casual.winScores) };
};

/**
 * Словесная оценка сложности по доле побед обычного игрока - по шкале
 * `LEVEL_DIFFICULTY_WIN_RATE`, той же, что держит тест каталога.
 */
export const describeDifficulty = (casualWinRate: number): string => {
  const { easy, normal, hard } = LEVEL_DIFFICULTY_WIN_RATE;

  if (casualWinRate >= easy) return EDITOR_TEXTS.bot.difficultyLevels.easy;
  if (casualWinRate >= normal) return EDITOR_TEXTS.bot.difficultyLevels.normal;
  if (casualWinRate >= hard) return EDITOR_TEXTS.bot.difficultyLevels.hard;

  return EDITOR_TEXTS.bot.difficultyLevels.impossible;
};

/**
 * Уровень, который обычный игрок проходит реже порога «сложный», уронит
 * `levelCatalog.bot.test.ts` после `levels:import` - лучше узнать это здесь.
 */
export const isTooHardForCatalog = (casualWinRate: number): boolean =>
  casualWinRate < LEVEL_DIFFICULTY_WIN_RATE.hard;

/** Уровень без того, что на игру бота не влияет: порогов звёзд и названия. */
const toPlayedLevel = (level: IMinigameLevelConfig) => {
  const { title: _title, ...played } = disableStarScores(level);

  return played;
};

/**
 * Итог одной модели игрока словами: сколько партий выиграл и с каким запасом
 * ходов. Дробный запас по-русски всегда «хода».
 */
export const describeBotPlayer = ({
  runs,
  winRate,
  avgMovesLeftOnWin,
}: ILevelBotReport): string => {
  const wins = Math.round(winRate * runs);

  if (wins === 0) {
    return EDITOR_TEXTS.bot.noWins(runs);
  }

  const movesLeft = avgMovesLeftOnWin.toFixed(1).replace('.', ',');

  return EDITOR_TEXTS.bot.wins(wins, runs, movesLeft);
};

/**
 * Устарела ли проверка ботом для черновика. Пороги звёзд, название и роль на
 * игру бота не влияют: их правка (в том числе подстановка порогов самой
 * проверки) не делает результат устаревшим.
 */
export const isBotCheckStale = (
  checked: IMinigameLevelConfig,
  current: IMinigameLevelConfig
): boolean =>
  checked !== current &&
  JSON.stringify(toPlayedLevel(checked)) !== JSON.stringify(toPlayedLevel(current));

/** Стоят ли в уровне ровно эти пороги звёзд. */
export const hasStarScores = (
  level: IMinigameLevelConfig,
  [two, three]: readonly [number, number]
): boolean => level.starScores?.[0] === two && level.starScores[1] === three;

/** Пороги звёзд, которые проверка ботом предлагает уровню. */
export interface IStarScoreSuggestion {
  thresholds: [number, number];
  /** Эти пороги уже стоят в уровне - подставлять нечего. */
  isApplied: boolean;
}

/**
 * Предложение порогов по очкам обычного игрока - только уровню с включёнными
 * «Звёздами за очки»: выключенные звёзды - решение автора, а не пробел,
 * который проверка должна заполнить. `null` - предлагать нечего: звёзды
 * выключены или обычный игрок ни разу не выиграл.
 */
export const resolveStarScoreSuggestion = (
  level: IMinigameLevelConfig,
  suggested: [number, number] | null
): IStarScoreSuggestion | null =>
  level.starScores && suggested
    ? { thresholds: suggested, isApplied: hasStarScores(level, suggested) }
    : null;

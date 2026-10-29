import { describe, expect, it } from 'vitest';
import { INITIAL_MINIGAME_LEVEL_CONFIG } from '@/entities/game';
import {
  BOT_CHECK_RUNS,
  describeDifficulty,
  describeBotPlayer,
  hasStarScores,
  isBotCheckStale,
  listBotCheckRuns,
  playBotCheckRun,
  resolveStarScoreSuggestion,
  summarizeBotCheck,
} from './levelBotCheck';

describe('levelBotCheck', () => {
  it('играет обе модели игрока и подбирает пороги звёзд', () => {
    const level = { ...INITIAL_MINIGAME_LEVEL_CONFIG, moves: 30 };
    const plan = listBotCheckRuns();

    expect(plan).toHaveLength(BOT_CHECK_RUNS * 2);

    const result = summarizeBotCheck(
      level,
      plan.map((run) => playBotCheckRun(level, run))
    );

    expect(result.greedy.runs).toBe(BOT_CHECK_RUNS);
    expect(result.casual.runs).toBe(BOT_CHECK_RUNS);
    expect(result.greedy.winRate).toBeGreaterThan(0);
    expect(result.suggestedStars?.[1]).toBeGreaterThan(result.suggestedStars?.[0] ?? 0);
  });

  it('делит партии по модели игрока, а не по месту в списке', () => {
    const level = { ...INITIAL_MINIGAME_LEVEL_CONFIG, moves: 30 };
    const runs = listBotCheckRuns().map((run) => playBotCheckRun(level, run));
    const inOrder = summarizeBotCheck(level, runs);
    const reversed = summarizeBotCheck(level, [...runs].reverse());

    expect(reversed.greedy.winRate).toBe(inOrder.greedy.winRate);
    expect(reversed.casual.winRate).toBe(inOrder.casual.winRate);
    expect(reversed.suggestedStars).toEqual(inOrder.suggestedStars);
  });

  it('называет сложность по доле побед обычного игрока', () => {
    expect(describeDifficulty(1)).toMatch(/лёгкий/);
    expect(describeDifficulty(0.8)).toBe('обычный');
    expect(describeDifficulty(0.4)).toMatch(/сложный/);
    expect(describeDifficulty(0)).toMatch(/непроходимый/);
  });

  it('пересказывает итог модели игрока словами', () => {
    const report = {
      runs: 12,
      winRate: 7 / 12,
      avgMovesLeftOnWin: 2.34,
      stuckRate: 0,
      maxEmptyCells: 0,
      avgGoalProgress: {},
      winScores: [],
    };

    expect(describeBotPlayer(report)).toBe('выиграл 7 из 12, в среднем осталось 2,3 хода');
    expect(describeBotPlayer({ ...report, winRate: 0 })).toBe('ни одной победы из 12');
  });
});

describe('isBotCheckStale', () => {
  it('ignores star thresholds, but not the board', () => {
    const level = INITIAL_MINIGAME_LEVEL_CONFIG;

    expect(isBotCheckStale(level, { ...level, starScores: [1000, 2000] })).toBe(false);
    expect(isBotCheckStale(level, { ...level, moves: level.moves + 1 })).toBe(true);
  });
});

describe('hasStarScores', () => {
  it('matches exactly these thresholds', () => {
    const level = {
      ...INITIAL_MINIGAME_LEVEL_CONFIG,
      starScores: [1000, 2000] as [number, number],
    };

    expect(hasStarScores(level, [1000, 2000])).toBe(true);
    expect(hasStarScores(level, [1000, 2500])).toBe(false);
    expect(hasStarScores({ ...level, starScores: undefined }, [1000, 2000])).toBe(false);
  });
});

describe('resolveStarScoreSuggestion', () => {
  const withStars = {
    ...INITIAL_MINIGAME_LEVEL_CONFIG,
    starScores: [1000, 2000] as [number, number],
  };

  it('предлагает пороги уровню со звёздами и помечает уже стоящие', () => {
    expect(resolveStarScoreSuggestion(withStars, [1200, 2400])).toEqual({
      thresholds: [1200, 2400],
      isApplied: false,
    });
    expect(resolveStarScoreSuggestion(withStars, [1000, 2000])).toEqual({
      thresholds: [1000, 2000],
      isApplied: true,
    });
  });

  it('молчит, если звёзды выключены или обычный игрок не выиграл', () => {
    expect(
      resolveStarScoreSuggestion({ ...withStars, starScores: undefined }, [1200, 2400])
    ).toBeNull();
    expect(resolveStarScoreSuggestion(withStars, null)).toBeNull();
  });
});

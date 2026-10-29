import { describe, expect, it } from 'vitest';
import { createEmptyMinigameGrid, INITIAL_MINIGAME_LEVEL_CONFIG } from '@/entities/game';
import { describeLevel, describeLevelListItem } from './levelLabels';

describe('describeLevel', () => {
  it('shows the field size, moves and colors of the level', () => {
    const level = {
      ...INITIAL_MINIGAME_LEVEL_CONFIG,
      moves: 22,
      colors: ['yellow' as const, 'red' as const, 'blue' as const, 'green' as const],
      grid: createEmptyMinigameGrid(8, 6),
    };

    expect(describeLevel(4, level)).toBe('Уровень 4 · 8×6 · 22 хода · 4 цвета');
  });

  it('falls back to the bare number for a missing level', () => {
    expect(describeLevel(99, null)).toBe('Уровень 99');
  });
});

describe('describeLevelListItem', () => {
  it('names the level, a level without a title is untitled', () => {
    expect(describeLevelListItem({ ...INITIAL_MINIGAME_LEVEL_CONFIG, title: 'Ромб' })).toBe('Ромб');
    expect(describeLevelListItem(INITIAL_MINIGAME_LEVEL_CONFIG)).toBe('без названия');
  });
});

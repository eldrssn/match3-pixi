import { describe, expect, it } from 'vitest';
import { INITIAL_MINIGAME_LEVEL_CONFIG, listLevelMechanics } from '@/entities/game';
import { DEFAULT_LEVEL_BOOSTERS } from '@/entities/level';
import { formatScore } from '@/shared/lib/format';
import { EDITOR_TEXTS } from './texts';
import {
  DEFAULT_EDITOR_PREVIEW_OPTIONS,
  describeOutcome,
  parsePreviewSeed,
  resolvePreviewParty,
  togglePreBooster,
} from './previewOptions';

describe('previewOptions', () => {
  it('the editor, not the widget, decides boosters, tips and seed of the party', () => {
    const level = INITIAL_MINIGAME_LEVEL_CONFIG;

    expect(resolvePreviewParty(level, DEFAULT_EDITOR_PREVIEW_OPTIONS)).toEqual({
      boosters: DEFAULT_LEVEL_BOOSTERS,
      preBoosters: [],
      tutorial: [],
      seed: undefined,
    });
    expect(
      resolvePreviewParty(level, {
        ...DEFAULT_EDITOR_PREVIEW_OPTIONS,
        boosters: false,
        preBoosters: ['bomb'],
        tutorial: true,
        seed: 7,
      })
    ).toEqual({
      boosters: [],
      preBoosters: ['bomb'],
      tutorial: listLevelMechanics(level),
      seed: 7,
    });
  });

  it('reads a seed only from a non-negative integer', () => {
    expect(parsePreviewSeed('42')).toBe(42);
    expect(parsePreviewSeed('0')).toBe(0);
    expect(parsePreviewSeed('')).toBeNull();
    expect(parsePreviewSeed('-1')).toBeNull();
    expect(parsePreviewSeed('1.5')).toBeNull();
  });

  it('toggles a pre-level booster', () => {
    expect(togglePreBooster([], 'laser')).toEqual(['laser']);
    expect(togglePreBooster(['laser', 'bomb'], 'laser')).toEqual(['bomb']);
  });

  it('describes the outcome of a preview party', () => {
    const { preview } = EDITOR_TEXTS;

    expect(describeOutcome({ isVictory: true, score: 1200, stars: 2 })).toBe(
      [preview.victory, preview.score(formatScore(1200)), '★★☆'].join(' · ')
    );
    expect(describeOutcome({ isVictory: false, score: 0, stars: null })).toBe(
      [preview.defeat, preview.score(formatScore(0)), preview.noStars].join(' · ')
    );
  });
});

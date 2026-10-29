import { describe, expect, it } from 'vitest';
import {
  buildMusicBar,
  MUSIC_BAR_SECONDS,
  midiToFrequency,
  resolveMatchNote,
  resolveMatchRecipe,
  resolveSoundRecipe,
  shouldWarnLowMoves,
  SOUND_RECIPES,
  type TSoundRecipe,
} from './soundRecipes';

describe('midiToFrequency', () => {
  it('ля первой октавы - 440 Гц, октава выше - вдвое', () => {
    expect(midiToFrequency(69)).toBe(440);
    expect(midiToFrequency(81)).toBeCloseTo(880);
  });
});

describe('resolveMatchNote', () => {
  it('каскад поднимается на тон за звено', () => {
    expect(resolveMatchNote(2) - resolveMatchNote(1)).toBe(2);
  });

  it('но не выше октавы', () => {
    expect(resolveMatchNote(20)).toBe(resolveMatchNote(7));
    expect(resolveMatchNote(7) - resolveMatchNote(1)).toBe(12);
  });

  it('звено меньше первого звучит как первое', () => {
    expect(resolveMatchNote(0)).toBe(resolveMatchNote(1));
  });
});

describe('resolveMatchRecipe', () => {
  it('глубокое звено звучит выше первого', () => {
    expect(resolveMatchRecipe(4)[0].frequency).toBeGreaterThan(resolveMatchRecipe(1)[0].frequency);
  });
});

describe('shouldWarnLowMoves', () => {
  it('предупреждает на отметках, когда ходов стало меньше', () => {
    expect(shouldWarnLowMoves(6, 5)).toBe(true);
    expect(shouldWarnLowMoves(2, 1)).toBe(true);
  });

  it('молчит между отметками и при старте партии', () => {
    expect(shouldWarnLowMoves(5, 4)).toBe(false);
    // Инициализация счётчика: ходов стало больше, а не меньше.
    expect(shouldWarnLowMoves(0, 5)).toBe(false);
  });
});

describe('SOUND_RECIPES', () => {
  it('у каждого звука есть голоса с осмысленными параметрами', () => {
    for (const recipe of Object.values(SOUND_RECIPES)) {
      expect(recipe.length).toBeGreaterThan(0);

      for (const voice of recipe) {
        expect(voice.frequency).toBeGreaterThan(0);
        expect(voice.duration).toBeGreaterThan(voice.attack);
        expect(voice.gain).toBeGreaterThan(0);
        expect(voice.gain).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('resolveSoundRecipe', () => {
  const softReject: TSoundRecipe = [
    { wave: 'sine', frequency: 300, attack: 0.01, duration: 0.12, gain: 0.1 },
  ];

  it('звучит рецептом скина, если скин переопределил событие', () => {
    expect(resolveSoundRecipe('reject', { reject: softReject })).toBe(softReject);
  });

  it('остальные события звучат рецептами по умолчанию', () => {
    expect(resolveSoundRecipe('swap', { reject: softReject })).toBe(SOUND_RECIPES.swap);
  });

  it('у каждого события есть рецепт и в активном скине', () => {
    for (const cue of Object.keys(SOUND_RECIPES) as (keyof typeof SOUND_RECIPES)[]) {
      expect(resolveSoundRecipe(cue).length, cue).toBeGreaterThan(0);
    }
  });
});

describe('buildMusicBar', () => {
  it('ноты такта не выходят за его длину', () => {
    for (let bar = 0; bar < 8; bar++) {
      for (const note of buildMusicBar(bar)) {
        expect(note.offset + note.duration).toBeLessThanOrEqual(MUSIC_BAR_SECONDS);
      }
    }
  });

  it('аккорды идут по кругу из четырёх тактов', () => {
    expect(buildMusicBar(4)).toEqual(buildMusicBar(0));
    expect(buildMusicBar(1)).not.toEqual(buildMusicBar(0));
  });
});

import { SKIN, type ISoundVoice, type TSoundCue, type TSoundRecipe } from '@/entities/skin';

/**
 * Звуки партии как данные: каждый звук - набор голосов (осциллятор или шум) с
 * огибающей и глиссандо. Своих аудиофайлов у шаблона нет, поэтому всё
 * синтезируется на лету (`SoundEngine`), а здесь лежат рецепты по умолчанию и
 * чистые правила - высота матча по шагу каскада, предупреждение о ходах,
 * такт фоновой музыки. Правила тестируются без WebAudio.
 *
 * Словарь событий и формат рецепта - контракт скина (`entities/skin`): скин
 * переопределяет любой звук по событию (`ISkinManifest.sounds`), остальные
 * звучат рецептами отсюда (`resolveSoundRecipe`).
 */

export type { ISoundVoice, TSoundCue, TSoundRecipe };

/** Нота по MIDI-номеру: 69 - ля первой октавы, 440 Гц. */
export const midiToFrequency = (note: number): number => 440 * 2 ** ((note - 69) / 12);

const tone = (
  frequency: number,
  duration: number,
  gain: number,
  extra: Partial<ISoundVoice> = {}
): ISoundVoice => ({ wave: 'sine', frequency, attack: 0.005, duration, gain, ...extra });

/** Короткое арпеджио: ноты по очереди с шагом `step` секунд. */
const arpeggio = (
  notes: readonly number[],
  step: number,
  duration: number,
  gain: number,
  wave: OscillatorType = 'sine'
): ISoundVoice[] =>
  notes.map((note, index) =>
    tone(midiToFrequency(note), duration, gain, { wave, delay: index * step })
  );

export const SOUND_RECIPES: Record<TSoundCue, TSoundRecipe> = {
  swap: [tone(520, 0.09, 0.16, { wave: 'triangle', frequencyEnd: 760 })],
  reject: [
    tone(240, 0.08, 0.12, { wave: 'square', frequencyEnd: 190 }),
    tone(200, 0.1, 0.12, { wave: 'square', frequencyEnd: 150, delay: 0.1 }),
  ],
  specialSpawn: arpeggio([81, 85, 88, 93], 0.045, 0.16, 0.14, 'triangle'),
  rocket: [
    tone(380, 0.28, 0.14, { wave: 'sawtooth', frequencyEnd: 1400 }),
    { wave: 'noise', frequency: 3000, filter: 'highpass', attack: 0.01, duration: 0.3, gain: 0.18 },
  ],
  bomb: [
    tone(140, 0.45, 0.5, { frequencyEnd: 38 }),
    { wave: 'noise', frequency: 900, filter: 'lowpass', attack: 0.005, duration: 0.5, gain: 0.45 },
  ],
  propeller: [
    tone(560, 0.32, 0.12, { wave: 'triangle', frequencyEnd: 980 }),
    {
      wave: 'noise',
      frequency: 1800,
      filter: 'bandpass',
      attack: 0.04,
      duration: 0.32,
      gain: 0.12,
    },
  ],
  rainbow: arpeggio([84, 88, 91, 96, 100, 103], 0.05, 0.3, 0.12),
  mega: [
    tone(120, 0.7, 0.55, { frequencyEnd: 30 }),
    { wave: 'noise', frequency: 700, filter: 'lowpass', attack: 0.005, duration: 0.8, gain: 0.5 },
    ...arpeggio([84, 88, 91, 96, 100, 103, 108], 0.06, 0.4, 0.1),
  ],
  crack: [
    {
      wave: 'noise',
      frequency: 2600,
      filter: 'bandpass',
      attack: 0.002,
      duration: 0.07,
      gain: 0.3,
    },
  ],
  /** Слизь расползлась: вязкий «шлёп» вниз. */
  spread: [
    tone(220, 0.22, 0.2, { frequencyEnd: 90 }),
    { wave: 'noise', frequency: 500, filter: 'lowpass', attack: 0.02, duration: 0.2, gain: 0.16 },
  ],
  /** Финальный бонус: ходы взлетают ракетами - восходящий перелив. */
  bonus: arpeggio([76, 79, 83, 88, 91], 0.06, 0.22, 0.12, 'triangle'),
  shuffle: [
    { wave: 'noise', frequency: 1200, filter: 'bandpass', attack: 0.08, duration: 0.4, gain: 0.14 },
    tone(300, 0.4, 0.06, { wave: 'triangle', frequencyEnd: 600 }),
  ],
  /** Сбор «опусти вниз»: короткий взлёт вверх, а не звук цели - его даёт подписка на стор. */
  collect: [tone(660, 0.22, 0.12, { wave: 'triangle', frequencyEnd: 1320 })],
  goal: [tone(1320, 0.08, 0.1)],
  goalComplete: [
    ...arpeggio([79, 83, 86], 0, 0.4, 0.1),
    tone(midiToFrequency(91), 0.35, 0.08, { delay: 0.08 }),
  ],
  lowMoves: [
    tone(880, 0.1, 0.12, { wave: 'square' }),
    tone(880, 0.1, 0.12, { wave: 'square', delay: 0.18 }),
  ],
  win: [
    ...arpeggio([72, 76, 79, 84], 0.12, 0.25, 0.16, 'triangle'),
    ...arpeggio([72, 76, 79, 84], 0, 0.9, 0.08).map((voice) => ({ ...voice, delay: 0.5 })),
  ],
  lose: arpeggio([67, 64, 60, 55], 0.18, 0.35, 0.14, 'triangle'),
};

/**
 * Рецепт звука события: переопределение скина, без него - рецепт по
 * умолчанию. Переопределения - параметр ради тестов; рантайм берёт скин.
 */
export const resolveSoundRecipe = (
  cue: TSoundCue,
  overrides: Readonly<Partial<Record<TSoundCue, TSoundRecipe>>> = SKIN.sounds
): TSoundRecipe => overrides[cue] ?? SOUND_RECIPES[cue];

/** Высота «плинка» первого звена каскада - ми второй октавы. */
const MATCH_BASE_NOTE = 76;
/** Каскад поднимается на тон за звено... */
const MATCH_SEMITONES_PER_STEP = 2;
/** ...но не выше октавы: дальше звон режет ухо, а не радует. */
const MATCH_MAX_STEPS = 6;

/** Нота звена каскада: чем глубже цепочка, тем выше звон (жанровый приём). */
export const resolveMatchNote = (iteration: number): number =>
  MATCH_BASE_NOTE +
  Math.min(Math.max(0, iteration - 1), MATCH_MAX_STEPS) * MATCH_SEMITONES_PER_STEP;

/** «Плинк» звена каскада: основной тон и октава над ним потише. */
export const resolveMatchRecipe = (iteration: number): TSoundRecipe => {
  const frequency = midiToFrequency(resolveMatchNote(iteration));

  return [tone(frequency, 0.2, 0.16), tone(frequency * 2, 0.14, 0.06, { wave: 'triangle' })];
};

/** На каком остатке ходов звучит предупреждение. */
export const LOW_MOVES_MARKS: readonly number[] = [5, 3, 1];

/** Пора ли предупредить: ходов стало меньше, и остаток - одна из отметок. */
export const shouldWarnLowMoves = (previous: number, next: number): boolean =>
  next < previous && LOW_MOVES_MARKS.includes(next);

// ------------------------------------------------------------------ музыка

export interface IMusicNote {
  /** Смещение от начала такта, с. */
  offset: number;
  frequency: number;
  duration: number;
  gain: number;
  wave: OscillatorType;
}

const MUSIC_BPM = 92;
/** Восьмая нота при темпе музыки, с. */
const MUSIC_EIGHTH = 60 / MUSIC_BPM / 2;
/** Такт - восемь восьмых. */
export const MUSIC_BAR_SECONDS = MUSIC_EIGHTH * 8;

/** Аккорды по тактам: до мажор I-vi-IV-V, по кругу. */
const MUSIC_CHORDS: readonly (readonly number[])[] = [
  [60, 64, 67],
  [57, 60, 64],
  [53, 57, 60],
  [55, 59, 62],
];

/** Порядок нот арпеджио внутри такта (индексы аккорда, 3 - октава над корнем). */
const ARPEGGIO_PATTERN = [0, 1, 2, 3, 2, 1, 2, 3] as const;

/**
 * Такт фоновой музыки: мягкое арпеджио аккорда и бас корнем. Тихо и
 * предсказуемо - музыка партии живёт фоном и не спорит со звуками доски.
 */
export const buildMusicBar = (barIndex: number): IMusicNote[] => {
  const chord = MUSIC_CHORDS[barIndex % MUSIC_CHORDS.length];
  const notes: IMusicNote[] = ARPEGGIO_PATTERN.map((step, index) => ({
    offset: index * MUSIC_EIGHTH,
    frequency: midiToFrequency(step === 3 ? chord[0] + 12 : chord[step]) * 2,
    duration: MUSIC_EIGHTH * 0.9,
    gain: 0.05,
    wave: 'triangle',
  }));

  notes.push({
    offset: 0,
    frequency: midiToFrequency(chord[0] - 12),
    duration: MUSIC_BAR_SECONDS * 0.95,
    gain: 0.07,
    wave: 'sine',
  });

  return notes;
};

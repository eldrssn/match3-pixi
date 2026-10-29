/**
 * Словарь звуков партии и формат рецепта синтеза.
 *
 * Словарь (`TSoundCue`) - это события рантайма, которые он умеет озвучить:
 * его заполняет `widgets/game/audio` (рецепты по умолчанию), а скин может
 * переопределить любой звук своим рецептом (`ISkinManifest.sounds`). Тип живёт
 * здесь, а не в виджете, потому что скин - слой ниже и импортировать виджет
 * не может.
 */

export type TSoundCue =
  | 'swap'
  | 'reject'
  | 'specialSpawn'
  | 'rocket'
  | 'bomb'
  | 'propeller'
  | 'rainbow'
  | 'mega'
  | 'crack'
  | 'spread'
  | 'bonus'
  | 'shuffle'
  | 'collect'
  | 'goal'
  | 'goalComplete'
  | 'lowMoves'
  | 'win'
  | 'lose';

export interface ISoundVoice {
  /** Форма волны; `noise` - белый шум через фильтр (взрывы, треск, свист). */
  wave: OscillatorType | 'noise';
  /** Частота в начале, Гц (у шума - частота фильтра). */
  frequency: number;
  /** Частота в конце - глиссандо; без неё тон ровный. */
  frequencyEnd?: number;
  /** Задержка голоса от начала звука, с. */
  delay?: number;
  /** Атака, с. */
  attack: number;
  /** Сколько голос звучит вместе с атакой, с. */
  duration: number;
  /** Пиковая громкость голоса, 0..1. */
  gain: number;
  /** Фильтр шума; у тона не используется. */
  filter?: BiquadFilterType;
}

/** Звук - набор голосов, которые синтезатор играет одновременно (с задержками). */
export type TSoundRecipe = readonly ISoundVoice[];

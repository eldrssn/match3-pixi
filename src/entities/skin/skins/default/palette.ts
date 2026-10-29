import type { TMinigameChipId } from '@/entities/game';
import type { ISkinFxColors, ISkinHudColors } from '../../model/types';

/**
 * Цвета скина по умолчанию (`0xRRGGBB`): слой канваса и процедурные текстуры.
 * Канвас CSS-токенов не читает, поэтому цвет, совпадающий с токеном
 * `shared/styles/_colors.scss`, живёт здесь с пометкой, с каким токеном он
 * обязан совпадать.
 */

/** Цвета фишек: тинт частиц разрушения и секторы радуги. */
export const CHIP_COLORS: Readonly<Record<TMinigameChipId, number>> = {
  red: 0xff6b81,
  pink: 0xff7ac8,
  yellow: 0xffd24d,
  green: 0x5fd98a,
  blue: 0x5ba8ff,
  violet: 0xb57bff,
};

/** Радуга по кругу - цвета фишек: колесо спецфишки и лучи её взрыва. */
export const RAINBOW_COLORS: readonly number[] = [
  CHIP_COLORS.red,
  CHIP_COLORS.yellow,
  CHIP_COLORS.green,
  CHIP_COLORS.blue,
  CHIP_COLORS.violet,
  CHIP_COLORS.pink,
];

/** Горящая звезда шкалы очков - токен `--star-lit` карточек результата. */
export const STAR_LIT_COLOR = 0xffd24d;

/** Тусклая звезда шкалы очков - токен `--star-dim`. */
export const STAR_DIM_COLOR = 0x4b5072;

/** Плашки шапки партии (выход, ходы, звук): тёмная основа и нейтральный обод - токен `--border-neutral-2`. */
export const HUD_PLATE_COLOR = 0x3c3a5f;
export const HUD_RIM_COLOR = 0x6a6898;

/** Панели целей и бустеров: заливка - токен `--bg-modal`, обводка - `--mint`. */
export const HUD_PANEL_COLOR = 0x2f2e49;
export const HUD_PANEL_BORDER_COLOR = 0x4dd0d5;

/** Подложка клетки - токены `--floor-1`, `--floor-2` и `--floor-border`. */
export const FLOOR_LIGHT_COLOR = 0x58d6aa;
export const FLOOR_DARK_COLOR = 0x2ca080;

/** Ящик в три слоя: целый ящик, тонированный в сталь (`board.stageTints`). */
export const CARGO_REINFORCED_TINT = 0x9fb3c8;

/** Эффекты доски: вспышки, взрывы, подсветки, затемнение. */
export const FX_COLORS: ISkinFxColors = {
  burstDefault: 0xffffff,
  specialSpawn: 0xffffff,
  cellBright: 0xffffff,
  specialHint: 0xff8800,
  rocketFiring: 0xfff1b8,
  shockwave: 0xffc46b,
  blastSpark: 0xffffff,
  takeoff: 0xd8f4ff,
  selection: 0xffffff,
  dim: 0x000000,
  flash: 0xffffff,
};

/** Интерфейс партии на холсте: шкала очков, кружки счётчиков, тексты. */
export const HUD_COLORS: ISkinHudColors = {
  scoreTrack: 0x1d2140,
  scoreFill: 0xffc93c,
  starOutline: 0x1d2140,
  badge: 0x131313,
  goalText: '#ffffff',
  goalDoneText: '#00ff00',
  lowMovesText: '#ff8a8a',
};

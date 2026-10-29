import {
  PRE_LEVEL_BOOSTER_KINDS,
  type IGameStartBooster,
  type TPreLevelBoosterKind,
} from '@/entities/game';
import { DEFAULT_LEVEL_BOOSTERS } from '@/entities/level';

/**
 * С какого уровня «Играть» начинает партию: QA-флаг `?level=N`, если
 * он в границах каталога, иначе текущий уровень хоста (`resolveCurrentLevel`). Номер вне каталога
 * игнорируется так же, как опечатка, иначе старт упал бы на несуществующем
 * уровне.
 */
export const resolveStartLevelNumber = (
  queryLevel: number | null,
  currentLevel: number,
  levelCount: number
): number => (queryLevel !== null && queryLevel <= levelCount ? queryLevel : currentLevel);

/** Уровень после победы. После последнего уровня каталога повторяется последний. */
export const resolveNextLevelNumber = (levelNumber: number, levelCount: number): number =>
  Math.min(levelNumber + 1, levelCount);

/** Первый уровень идёт без бустеров - это правило игры, а не виджета. */
export const resolvePartyBoosters = (levelNumber: number): IGameStartBooster[] =>
  levelNumber === 1 ? [] : DEFAULT_LEVEL_BOOSTERS;

/**
 * Какие предуровневые бустеры карточка уровня предлагает взять. Первый
 * уровень - знакомство с игрой, и, как обычные бустеры, их там нет. Валюты у
 * шаблона нет, поэтому остальным уровням доступны все три без счёта.
 */
export const resolvePreBoosterOptions = (levelNumber: number): TPreLevelBoosterKind[] =>
  levelNumber === 1 ? [] : [...PRE_LEVEL_BOOSTER_KINDS];

/** Сколько ходов даёт «Продолжить» на исходе ходов (near-miss). */
export const NEAR_MISS_EXTRA_MOVES = 5;

/**
 * Сколько раз за партию хост предлагает добавочные ходы. Валюты у шаблона
 * нет, и бесплатное продолжение без предела отменяло бы саму цену хода -
 * одно предложение оставляет near-miss праздником, а не бесконечной партией.
 */
export const MAX_CONTINUES_PER_PARTY = 1;

/**
 * Сколько ходов предложить на исходе ходов: `null` - предложений больше нет,
 * партия кончается поражением.
 */
export const resolveContinueOffer = (continuesUsed: number): number | null =>
  continuesUsed < MAX_CONTINUES_PER_PARTY ? NEAR_MISS_EXTRA_MOVES : null;

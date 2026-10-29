import {
  isLevelMechanic,
  listLevelMechanics,
  type IMinigameLevelConfig,
  type TLevelMechanic,
  type TLevelStars,
} from '@/entities/game';
import { DEFAULT_LEVEL_PACK_ID } from '@/entities/level';
import { STORAGE_KEYS } from '@/shared/constants';
import { isRecord } from '@/shared/lib/isRecord';
import { resolveStorage } from '@/shared/lib/storage';

/**
 * Прогресс игрока - забота хоста, а не виджета: виджет отдаёт исход партии
 * (`IGameOutcome`), а что из него запомнить, решает хост. Хранится в
 * `localStorage` этого браузера; бэкенда у шаблона нет. Хост с сервером
 * берёт отсюда только чистые правила (`applyPartyResult`, `resolveTutorial`),
 * а чтение и запись заменяет своими.
 */
export interface ILevelProgress {
  /** Наибольший открытый уровень: следующий за последним пройденным. */
  unlocked: number;
  /** Лучшие звёзды по номерам уровней (только пройденные). */
  stars: Record<number, TLevelStars>;
  /** Лучшие очки по номерам уровней. */
  bestScores: Record<number, number>;
  /** Механики, подсказку которых игрок уже видел (обучение при первой встрече). */
  seenMechanics: TLevelMechanic[];
}

export const EMPTY_LEVEL_PROGRESS: ILevelProgress = {
  unlocked: 1,
  stars: {},
  bestScores: {},
  seenMechanics: [],
};

/**
 * Ключ хранилища прогресса пака; версия в имени - чтобы смена формата не
 * читала старый мусор. У каждого пака свой прогресс: «уровень 5» разных паков
 * - разные уровни. Пак по умолчанию остался на ключе времён одного пака, чтобы
 * прогресс, накопленный до появления паков, не потерялся.
 */
export const levelProgressStorageKey = (packId: string): string =>
  packId === DEFAULT_LEVEL_PACK_ID
    ? STORAGE_KEYS.defaultPackProgress
    : STORAGE_KEYS.packProgress(packId);

const toLevelMap = <T extends number>(
  value: unknown,
  accept: (item: number) => item is T
): Record<number, T> => {
  if (!isRecord(value)) {
    return {};
  }

  const result: Record<number, T> = {};

  for (const [key, item] of Object.entries(value)) {
    const level = Number(key);

    if (Number.isInteger(level) && level > 0 && typeof item === 'number' && accept(item)) {
      result[level] = item;
    }
  }

  return result;
};

const isStars = (value: number): value is TLevelStars =>
  value === 0 || value === 1 || value === 2 || value === 3;

const isScore = (value: number): value is number => Number.isFinite(value) && value >= 0;

/**
 * Прогресс из произвольного JSON: всё, что не похоже на прогресс, - пустой
 * прогресс, а не исключение. Хранилище переживает версии приложения, и битая
 * запись не должна ронять хост.
 */
export const parseLevelProgress = (value: unknown): ILevelProgress => {
  if (!isRecord(value)) {
    return EMPTY_LEVEL_PROGRESS;
  }

  const unlocked = Number(value.unlocked);

  return {
    unlocked: Number.isInteger(unlocked) && unlocked > 0 ? unlocked : 1,
    stars: toLevelMap(value.stars, isStars),
    bestScores: toLevelMap(value.bestScores, isScore),
    seenMechanics: Array.isArray(value.seenMechanics)
      ? value.seenMechanics.filter(
          (item): item is TLevelMechanic => typeof item === 'string' && isLevelMechanic(item)
        )
      : [],
  };
};

export const readLevelProgress = (packId: string, storage = resolveStorage()): ILevelProgress => {
  try {
    const raw = storage?.getItem(levelProgressStorageKey(packId));

    return raw ? parseLevelProgress(JSON.parse(raw)) : EMPTY_LEVEL_PROGRESS;
  } catch {
    return EMPTY_LEVEL_PROGRESS;
  }
};

/** Запись не обязана удаться (переполнение, приватный режим): игра идёт и без неё. */
export const writeLevelProgress = (
  packId: string,
  progress: ILevelProgress,
  storage = resolveStorage()
): void => {
  try {
    storage?.setItem(levelProgressStorageKey(packId), JSON.stringify(progress));
  } catch {
    // Прогресс этой сессии остаётся в памяти хоста.
  }
};

/** Какой уровень «Играть» начинает: открытый, но не дальше каталога. */
export const resolveCurrentLevel = (progress: ILevelProgress, levelCount: number): number =>
  Math.max(1, Math.min(progress.unlocked, levelCount));

/** Лучшая из двух оценок - без каста: `Math.max` вернул бы просто `number`. */
const betterStars = (a: TLevelStars, b: TLevelStars): TLevelStars => (a >= b ? a : b);

/**
 * Прогресс после партии: победа открывает следующий уровень и улучшает
 * рекорды (звёзды и очки - каждый сам по себе), поражение не меняет ничего.
 * Уровень без звёзд (`stars: null`) пишет только рекорд очков.
 */
export const applyPartyResult = (
  progress: ILevelProgress,
  levelNumber: number,
  { isVictory, score, stars }: { isVictory: boolean; score: number; stars: TLevelStars | null },
  levelCount: number
): ILevelProgress => {
  if (!isVictory) {
    return progress;
  }

  return {
    ...progress,
    unlocked: Math.max(progress.unlocked, Math.min(levelNumber + 1, levelCount)),
    stars:
      stars === null
        ? progress.stars
        : {
            ...progress.stars,
            [levelNumber]: betterStars(progress.stars[levelNumber] ?? 0, stars),
          },
    bestScores: {
      ...progress.bestScores,
      [levelNumber]: Math.max(progress.bestScores[levelNumber] ?? 0, score),
    },
  };
};

/** Механики уровня, которым игрок ещё не учился. */
export const resolveTutorial = (
  level: Pick<IMinigameLevelConfig, 'grid'>,
  progress: ILevelProgress
): TLevelMechanic[] =>
  listLevelMechanics(level).filter((mechanic) => !progress.seenMechanics.includes(mechanic));

export const markMechanicSeen = (
  progress: ILevelProgress,
  mechanic: TLevelMechanic
): ILevelProgress =>
  progress.seenMechanics.includes(mechanic)
    ? progress
    : { ...progress, seenMechanics: [...progress.seenMechanics, mechanic] };

/** Уровень на карте открыт: пройден или следующий за пройденными. */
export const isLevelUnlocked = (progress: ILevelProgress, levelNumber: number): boolean =>
  levelNumber <= progress.unlocked;

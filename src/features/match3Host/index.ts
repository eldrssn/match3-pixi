/**
 * Чистые правила хоста партии: прогресс по паку, выбор уровня, бустеры,
 * предложение «+ходы», подсказки механик. Виджет партии (`widgets/game`) их не
 * знает - он только отдаёт исход и события, а что из них следует, решает хост.
 *
 * Слой отдельный от главной (`pages/main`), потому что главная - пример хоста:
 * копия шаблона удаляет её или пишет свою, а эти правила остаются. Здесь нет
 * ни React, ни стора, ни модалок - только функции и константы; на них стоят и
 * главная, и превью редактора (`widgets/levelConfigEditor`).
 */
export {
  applyPartyResult,
  EMPTY_LEVEL_PROGRESS,
  isLevelUnlocked,
  levelProgressStorageKey,
  markMechanicSeen,
  parseLevelProgress,
  readLevelProgress,
  resolveCurrentLevel,
  resolveTutorial,
  writeLevelProgress,
  type ILevelProgress,
} from './model/levelProgress';
export {
  MAX_CONTINUES_PER_PARTY,
  NEAR_MISS_EXTRA_MOVES,
  resolveContinueOffer,
  resolveNextLevelNumber,
  resolvePartyBoosters,
  resolvePreBoosterOptions,
  resolveStartLevelNumber,
} from './model/partyRules';

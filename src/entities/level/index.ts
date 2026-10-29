/**
 * Паки уровней шаблона Match-3, формат файла пака, ритм сложности, витрина
 * механик и фиксированный набор бустеров.
 *
 * Прогресса здесь нет: какой пак и уровень играть, решает хост партии
 * (пример - `pages/main`), прогресс и правила выбора - `features/match3Host`.
 */
export {
  DEFAULT_LEVEL_PACK,
  DEFAULT_LEVEL_PACK_ID,
  getLevelPack,
  getPackLevel,
  LEVEL_PACKS,
  levelHasStars,
} from './model/levelCatalog';
export {
  isLevelPackId,
  LEVEL_PACK_FILE_VERSION,
  LEVEL_PACK_ID_PATTERN,
  parseLevelPackFile,
  renumberPackLevels,
  toLevelPackFile,
  validateLevelPack,
  type ILevelPack,
  type ILevelPackFile,
  type IParsedLevelPackFile,
} from './lib/levelPackFile';
export { LEVEL_DIFFICULTY_WIN_RATE } from './model/levelDifficulty';
export { DEFAULT_LEVEL_BOOSTERS } from './model/defaultBoosters';
export {
  getNextShowcaseKey,
  getShowcaseLevel,
  SHOWCASE_GROUP_TITLES,
  SHOWCASE_GROUPS,
  SHOWCASE_LEVELS,
  type IShowcaseLevel,
  type TShowcaseGroup,
} from './model/showcaseCatalog';

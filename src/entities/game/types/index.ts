import type { TGameBoosterKind } from '../lib/minigameBoosters';
import type { TMinigameChipId, TMinigameLaserDirection } from '../lib/minigameLevelConfig';

export interface IMinigameLevelGoal {
  id: string;
  count: number;
}

/**
 * Клетка уровня (формат v2) - слоями, сверху вниз:
 *
 * - `overlay` - накладка поверх фишки: лёд (снимается ударом рядом) или цепь
 *   (фишка матчится, но не двигается; снимается ударом по ней);
 * - `id` - предмет клетки: фишка, ящик (`layers` - 1-3 слоя), камень (только
 *   спецфишками), «опусти вниз», дыра, спецфишка (`MINIGAME_SPECIAL_IDS`,
 *   у ракеты - `direction`); `''` - пустая клетка черновика;
 * - `floor` - подложка под клеткой, число слоёв (1-2): снимается, когда на
 *   клетке гаснет предмет.
 */
export interface IMinigameLevelCell {
  id: string;
  /** Слои ящика (`cargo`): 1-3. У остальных предметов не используется. */
  layers?: number;
  /** Ось ракеты (`laser`); без поля - горизонталь. У остальных предметов не используется. */
  direction?: TMinigameLaserDirection;
  /** Накладка поверх фишки (`MINIGAME_OVERLAY_IDS`). */
  overlay?: string;
  /** Подложка: число слоёв (1-2). */
  floor?: number;
  /**
   * Формат v1: фишка подо льдом (`{ id: 'ice', innerId }`). Нормализация
   * переводит такую клетку в фишку с накладкой и это поле убирает.
   */
  innerId?: string;
}

export interface IMinigameLevelConfig {
  /** Версия формата уровня; нормализация приводит любой уровень к текущей. */
  formatVersion: number;
  /** Номер уровня в паке: совпадает с позицией (1..N), это проверяет тест каталога. */
  id: number;
  /**
   * Название уровня на карточке перед партией. Метаданные пака, на игру не
   * влияют; без поля карточка показывает только номер.
   */
  title?: string;
  moves: number;
  /**
   * Цвета фишек уровня: из них добирается поле и генерирует редактор. Главный
   * рычаг сложности жанра - на четырёх цветах каскады случаются заметно чаще,
   * чем на пяти. Уровень без поля (старый JSON) получает все цвета при
   * нормализации.
   */
  colors: TMinigameChipId[];
  levelGoals: IMinigameLevelGoal[];
  grid: IMinigameLevelCell[][];
  /**
   * Очки на вторую и третью звезду (первая - за победу). Без поля звёзд у
   * уровня нет: победа без оценки (`resolveLevelStars` -> `null`). Редактор
   * включает их отдельным блоком и подбирает пороги ботом.
   */
  starScores?: [number, number];
}

/** Бустер, с которым начинается партия: вид и стартовый остаток. */
export interface IGameStartBooster {
  kind: TGameBoosterKind;
  quantity: number;
}

import { readMinigameGridSize, type IMinigameLevelConfig } from '@/entities/game';
import { formatMoves } from '@/shared/lib/format';
import { EDITOR_TEXTS } from './texts';

/** Подпись уровня в шапке: номер, размер поля, ходы и цвета - видно, что открыто. */
export const describeLevel = (levelNumber: number, level: IMinigameLevelConfig | null): string => {
  if (!level) {
    return EDITOR_TEXTS.levelList.level(levelNumber);
  }

  const { cols, rows } = readMinigameGridSize(level);
  const moves = formatMoves(level.moves);

  return EDITOR_TEXTS.levelList.levelSummary(
    levelNumber,
    `${cols}×${rows}`,
    moves,
    level.colors.length
  );
};

/** Строка списка уровней пака: название или «без названия». */
export const describeLevelListItem = (level: IMinigameLevelConfig): string =>
  level.title || EDITOR_TEXTS.levelList.untitled;

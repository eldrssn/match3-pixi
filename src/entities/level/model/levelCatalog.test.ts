import { describe, expect, it } from 'vitest';
import {
  BoardEngine,
  findBoardMatches,
  hasBoardMatch,
  hasPossibleMove,
  isMinigameChipId,
  MINIGAME_RANDOM_ID,
  validateMinigameLevelConfig,
  type IMinigameLevelCell,
} from '@/entities/game';
import { createSeededRandom } from '@/shared/lib/random';
import { isLevelPackId } from '../lib/levelPackFile';
import {
  DEFAULT_LEVEL_PACK,
  DEFAULT_LEVEL_PACK_ID,
  LEVEL_FILE_IDS,
  LEVEL_PACK_MANIFESTS,
  LEVEL_PACKS,
  levelHasStars,
} from './levelCatalog';

/** Уровни всех паков: правила поля одни на любой пак. */
const LEVELS = LEVEL_PACKS.flatMap((pack) => pack.levels);

/**
 * Клетка уровня - та же `IBoardCell`, что у правил доски: `id` предмета.
 * Блокер и дыра матч не собирают, фишка подо льдом - тоже; фишка под цепью
 * матчится, но не двигается. Предикаты совпадают с генератором поля.
 */
const isChipCell = (cell: IMinigameLevelCell): boolean =>
  isMinigameChipId(cell.id) && cell.overlay !== 'ice';

const isSwappableCell = (cell: IMinigameLevelCell): boolean =>
  (isMinigameChipId(cell.id) || cell.id === 'drop') && !cell.overlay;

const hasRandomCells = (grid: readonly (readonly IMinigameLevelCell[])[]): boolean =>
  grid.some((column) => column.some((cell) => cell.id === MINIGAME_RANDOM_ID));

/** Зёрна, на которых проверяется уровень с клетками «?»: раскладка у каждого своя. */
const RANDOM_LAYOUT_SEEDS = Array.from({ length: 16 }, (_, index) => index + 1);

describe('levelCatalog', () => {
  it('has the main page pack, and it is not empty', () => {
    expect(LEVEL_PACKS[0]?.id).toBe(DEFAULT_LEVEL_PACK_ID);
    expect(DEFAULT_LEVEL_PACK.levels.length).toBeGreaterThan(0);
  });

  it('every pack folder is a valid id and its pack.json names the same id', () => {
    LEVEL_PACK_MANIFESTS.forEach(({ folder, id }) => {
      expect(isLevelPackId(folder), `pack folder ${folder}`).toBe(true);
      expect(id, `pack ${folder}`).toBe(folder);
    });
    LEVEL_PACKS.forEach((pack) => {
      expect(pack.title.trim(), `pack ${pack.id}`).not.toBe('');
    });
  });

  it('every pack has ids 1..N without holes or duplicates', () => {
    LEVEL_PACKS.forEach((pack) => {
      pack.levels.forEach((level, index) => {
        expect(level.id, `pack ${pack.id}, level at position ${index + 1}`).toBe(index + 1);
      });

      const ids = new Set(pack.levels.map((level) => level.id));
      expect(ids.size, `pack ${pack.id}`).toBe(pack.levels.length);
    });
  });

  it('the number in a level file name is the level id', () => {
    LEVEL_FILE_IDS.forEach(({ path, id }) => {
      expect(id, path).toBe(Number(/level_(\d+)_config\.json$/.exec(path)?.[1]));
    });
  });

  it('every level passes validateMinigameLevelConfig', () => {
    LEVELS.forEach((level) => {
      expect(validateMinigameLevelConfig(level), `level ${level.id}`).toEqual([]);
    });
  });

  it('no level starts with a standing match', () => {
    // Рантайм не разбирает готовые комбинации на старте (`createBoard` сразу
    // отдаёт ход игроку): тройка «из коробки» означала бы стоячие матчи.
    LEVELS.forEach((level) => {
      const matches = findBoardMatches(level.grid, isChipCell);

      expect(matches.entities.length, `level ${level.id}`).toBe(0);
    });
  });

  it('every level has at least one possible move', () => {
    // Клетки «?» статически ещё не фишки: такой уровень проверяется ниже
    // движком на разных зёрнах.
    LEVELS.filter((level) => !hasRandomCells(level.grid)).forEach((level) => {
      expect(hasPossibleMove(level.grid, isChipCell, isSwappableCell), `level ${level.id}`).toBe(
        true
      );
    });
  });

  it('levels with «?» cells start playable on every seed', () => {
    LEVELS.filter((level) => hasRandomCells(level.grid)).forEach((level) => {
      RANDOM_LAYOUT_SEEDS.forEach((seed) => {
        const engine = BoardEngine.fromLevel(level.grid, {
          colors: level.colors,
          random: createSeededRandom(seed),
        });
        const view = Array.from({ length: engine.cols }, (_, col) =>
          Array.from({ length: engine.rows }, (_, row) => {
            const piece = engine.pieceAt({ col, row });

            return piece && engine.overlayAt({ col, row })?.id !== 'ice' ? piece : null;
          })
        );

        expect(engine.hasMove(), `level ${level.id}, seed ${seed}`).toBe(true);
        expect(
          hasBoardMatch(view, (piece) => isMinigameChipId(piece.id)),
          `level ${level.id}, seed ${seed}`
        ).toBe(false);
      });
    });
  });

  it('every level builds a playable board engine', () => {
    // Тот же путь, что у старта партии (`GameLogic.createBoard`): уровень,
    // который валидация пропустила, а движок не собрал, падал бы отказом
    // рантайма прямо на «Играть».
    LEVELS.forEach((level) => {
      const engine = BoardEngine.fromLevel(level.grid, {
        colors: level.colors,
        random: () => 0.5,
      });

      expect(engine.hasMove(), `level ${level.id}`).toBe(true);
    });
  });
});

describe('levelHasStars', () => {
  it('follows the level thresholds, a level outside the pack has no stars', () => {
    LEVELS.forEach((level) => {
      expect(levelHasStars(level), `level ${level.id}`).toBe(Boolean(level.starScores));
    });
    expect(levelHasStars(null)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  BoardEngine,
  hasBoardMatch,
  isMinigameChipId,
  validateMinigameLevelConfig,
  type IBoardCellPos,
  type TBoardBlast,
  type TBoardStep,
  type TSpecialKind,
} from '@/entities/game';
import { createSeededRandom } from '@/shared/lib/random';
import { getNextShowcaseKey, SHOWCASE_LEVELS, type IShowcaseLevel } from './showcaseCatalog';

/** Зёрна, на которых проверяется витрина: клетки «?» у каждого раскладываются по-своему. */
const SEEDS = Array.from({ length: 24 }, (_, index) => index + 1);

const startEngine = (entry: IShowcaseLevel, seed: number): BoardEngine =>
  BoardEngine.fromLevel(entry.level.grid, {
    colors: entry.level.colors,
    random: createSeededRandom(seed),
  });

const swap = (entry: IShowcaseLevel, seed: number, from: IBoardCellPos, to: IBoardCellPos) => {
  const outcome = startEngine(entry, seed).trySwap(from, to);

  expect(outcome.kind, `${entry.key}, seed ${seed}`).toBe('accepted');

  return outcome.kind === 'accepted' ? outcome.steps : [];
};

const byKey = (key: string): IShowcaseLevel => {
  const entry = SHOWCASE_LEVELS.find((item) => item.key === key);

  if (!entry) {
    throw new Error(`no showcase level ${key}`);
  }

  return entry;
};

/**
 * Ход, ради которого собран уровень спецфишки, и что он обязан родить. Клетки
 * вокруг фигуры стоят фиксированными «сторожами»: «?» рядом не должен
 * превратить четвёрку в пятёрку или квадрат в L.
 */
const SPECIAL_DEMOS: Record<
  string,
  { from: IBoardCellPos; to: IBoardCellPos; kind: TSpecialKind }
> = {
  rocket: { from: { col: 3, row: 4 }, to: { col: 3, row: 5 }, kind: 'laser' },
  bomb: { from: { col: 1, row: 5 }, to: { col: 2, row: 5 }, kind: 'bomb' },
  propeller: { from: { col: 4, row: 5 }, to: { col: 3, row: 5 }, kind: 'propeller' },
  rainbow: { from: { col: 3, row: 4 }, to: { col: 3, row: 5 }, kind: 'rainbow' },
};

/** Пара спецфишек комбинаций стоит в центре: свап сверху вниз. */
const COMBO_FROM: IBoardCellPos = { col: 3, row: 3 };
const COMBO_TO: IBoardCellPos = { col: 3, row: 4 };

/**
 * Чем открывается комбинация - вид первого взрыва. Радуга со спецфишкой
 * открывается лучами по цвету, а превращение фишек идёт следующим шагом.
 */
const COMBO_OPENING: Record<string, TBoardBlast['kind']> = {
  rocketRocket: 'cross',
  rocketBomb: 'cross',
  bombBomb: 'area',
  propellerRocket: 'takeoff',
  propellerBomb: 'takeoff',
  propellerPropeller: 'takeoff',
  rainbowRocket: 'color',
  rainbowBomb: 'color',
  rainbowPropeller: 'color',
  rainbowRainbow: 'board',
};

const openingOf = (steps: TBoardStep[]): TBoardBlast['kind'] | null => {
  const opening = steps.find((step) => step.type === 'detonate');

  return opening?.type === 'detonate' ? opening.blast.kind : null;
};

describe('showcaseCatalog', () => {
  it('has unique keys and one level per group entry', () => {
    const keys = SHOWCASE_LEVELS.map((entry) => entry.key);

    expect(new Set(keys).size).toBe(keys.length);
    expect(SHOWCASE_LEVELS.filter((entry) => entry.group === 'specials').map((e) => e.key)).toEqual(
      Object.keys(SPECIAL_DEMOS)
    );
    expect(SHOWCASE_LEVELS.filter((entry) => entry.group === 'combos').map((e) => e.key)).toEqual(
      Object.keys(COMBO_OPENING)
    );
  });

  it('every level passes validateMinigameLevelConfig', () => {
    SHOWCASE_LEVELS.forEach((entry) => {
      expect(validateMinigameLevelConfig(entry.level), entry.key).toEqual([]);
    });
  });

  it('every level starts playable on every seed, without a standing match', () => {
    SHOWCASE_LEVELS.forEach((entry) => {
      SEEDS.forEach((seed) => {
        const engine = startEngine(entry, seed);
        const view = Array.from({ length: engine.cols }, (_, col) =>
          Array.from({ length: engine.rows }, (_, row) => {
            const piece = engine.pieceAt({ col, row });

            return piece && engine.overlayAt({ col, row })?.id !== 'ice' ? piece : null;
          })
        );

        expect(engine.hasMove(), `${entry.key}, seed ${seed}`).toBe(true);
        expect(
          hasBoardMatch(view, (piece) => isMinigameChipId(piece.id)),
          `${entry.key}, seed ${seed}`
        ).toBe(false);
      });
    });
  });

  it('the demo swap of a special level gives exactly that special', () => {
    Object.entries(SPECIAL_DEMOS).forEach(([key, demo]) => {
      SEEDS.forEach((seed) => {
        const steps = swap(byKey(key), seed, demo.from, demo.to);
        // Первое звено каскада - фигура игрока; дальше добор может собрать
        // что угодно, это уже не витрина.
        const born = steps.find((step) => step.type === 'special');

        expect(born?.type === 'special' && born.placement.piece.id, `${key}, seed ${seed}`).toBe(
          demo.kind
        );
      });
    });
  });

  it('the pair of a combo level combines on swap', () => {
    Object.entries(COMBO_OPENING).forEach(([key, opening]) => {
      SEEDS.forEach((seed) => {
        const steps = swap(byKey(key), seed, COMBO_FROM, COMBO_TO);

        expect(openingOf(steps), `${key}, seed ${seed}`).toBe(opening);

        if (opening === 'color') {
          expect(
            steps.some((step) => step.type === 'transform'),
            `${key}, seed ${seed}`
          ).toBe(true);
        }
      });
    });
  });

  it('«next» walks the showcase and stays on the last level', () => {
    expect(getNextShowcaseKey(SHOWCASE_LEVELS[0].key)).toBe(SHOWCASE_LEVELS[1].key);

    const last = SHOWCASE_LEVELS[SHOWCASE_LEVELS.length - 1].key;

    expect(getNextShowcaseKey(last)).toBe(last);
  });
});

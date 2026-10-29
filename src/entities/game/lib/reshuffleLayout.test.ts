import { describe, expect, it } from 'vitest';
import {
  pickReshuffleLayout,
  planGuaranteedMoveLayout,
  planShuffledLayout,
  type IReshuffleCell,
  type IReshuffleChip,
  type IReshuffleLayoutRating,
} from './reshuffleLayout';

type TBoard = Map<string, string>;

const toKey = (x: number, y: number): string => `${x},${y}`;

const buildBoard = (
  chips: readonly IReshuffleChip[],
  cells: readonly IReshuffleCell[],
  assignment: readonly number[]
): TBoard => {
  const board: TBoard = new Map();

  assignment.forEach((cellIndex, chipIndex) => {
    const cell = cells[cellIndex];
    board.set(toKey(cell.x, cell.y), chips[chipIndex].color);
  });

  return board;
};

/** Независимая от реализации проверка «лежат ли где-то три подряд». */
const hasMatch = (board: TBoard): boolean => {
  for (const key of board.keys()) {
    const [x, y] = key.split(',').map(Number);
    const color = board.get(key);

    const isRow = board.get(toKey(x + 1, y)) === color && board.get(toKey(x + 2, y)) === color;
    const isCol = board.get(toKey(x, y + 1)) === color && board.get(toKey(x, y + 2)) === color;

    if (isRow || isCol) {
      return true;
    }
  }

  return false;
};

/** Существует ли свап соседей, дающий матч. */
const hasMove = (board: TBoard): boolean => {
  for (const key of board.keys()) {
    const [x, y] = key.split(',').map(Number);

    for (const neighbourKey of [toKey(x + 1, y), toKey(x, y + 1)]) {
      if (!board.has(neighbourKey)) {
        continue;
      }

      const swapped = new Map(board);
      swapped.set(key, board.get(neighbourKey) as string);
      swapped.set(neighbourKey, board.get(key) as string);

      if (hasMatch(swapped)) {
        return true;
      }
    }
  }

  return false;
};

const buildCells = (cols: number, rows: number): IReshuffleCell[] => {
  const cells: IReshuffleCell[] = [];

  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      cells.push({ x, y });
    }
  }

  return cells;
};

const buildChips = (colors: readonly string[]): IReshuffleChip[] =>
  colors.map((color) => ({ color }));

describe('planShuffledLayout', () => {
  it('is a bijection: every chip gets exactly one cell', () => {
    const assignment = planShuffledLayout(36, () => 0.42);

    expect(assignment).toHaveLength(36);
    expect(new Set(assignment).size).toBe(36);
    expect(Math.min(...assignment)).toBe(0);
    expect(Math.max(...assignment)).toBe(35);
  });

  it('handles the degenerate sizes', () => {
    expect(planShuffledLayout(0)).toEqual([]);
    expect(planShuffledLayout(1)).toEqual([0]);
  });
});

describe('planGuaranteedMoveLayout', () => {
  it('lays out a board that always has a move', () => {
    const cells = buildCells(6, 6);
    const chips = buildChips(
      Array.from({ length: 36 }, (_, index) => ['red', 'blue', 'green'][index % 3])
    );

    const assignment = planGuaranteedMoveLayout(chips, cells);

    expect(assignment).not.toBeNull();
    expect(new Set(assignment as number[]).size).toBe(chips.length);
    expect(hasMove(buildBoard(chips, cells, assignment as number[]))).toBe(true);
  });

  it('keeps working when blockers cut the board', () => {
    // Дырявая доска: часть клеток занята блокерами и в перемешивание не входит.
    const cells = buildCells(6, 6).filter((cell) => !(cell.x === 1 && cell.y > 2));
    const chips = buildChips(
      Array.from({ length: cells.length }, (_, index) => ['red', 'blue'][index % 2])
    );

    const assignment = planGuaranteedMoveLayout(chips, cells);

    expect(assignment).not.toBeNull();
    expect(new Set(assignment as number[]).size).toBe(chips.length);
    expect(hasMove(buildBoard(chips, cells, assignment as number[]))).toBe(true);
  });

  it('gives up when no colour has three chips', () => {
    const cells = buildCells(4, 4);
    const chips = buildChips(
      Array.from({ length: 16 }, (_, index) => `color-${Math.floor(index / 2)}`)
    );

    expect(planGuaranteedMoveLayout(chips, cells)).toBeNull();
  });

  it('gives up when the board has no room for the pattern', () => {
    const cells: IReshuffleCell[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ];
    const chips = buildChips(['red', 'red', 'red']);

    expect(planGuaranteedMoveLayout(chips, cells)).toBeNull();
  });

  it('gives up on mismatched or empty input', () => {
    expect(planGuaranteedMoveLayout([], [])).toBeNull();
    expect(planGuaranteedMoveLayout(buildChips(['red']), buildCells(6, 6))).toBeNull();
  });
});

describe('pickReshuffleLayout', () => {
  /** Разные значения на каждый вызов - иначе все попытки дали бы одну перестановку. */
  const buildVaryingRandom = (): (() => number) => {
    let call = 0;

    return () => ((call++ * 37) % 100) / 100;
  };

  /**
   * Собирает оценщика из готового списка вердиктов и запоминает раскладки в том
   * порядке, в каком их предложили: тесты сверяют выбранную по ссылке.
   */
  const buildRate = (verdicts: readonly IReshuffleLayoutRating[]) => {
    const seen: (readonly number[])[] = [];

    return {
      seen,
      rate: (layout: readonly number[]): IReshuffleLayoutRating => {
        seen.push(layout);

        return verdicts[seen.length - 1] ?? { hasMove: false, hasReadyMatch: false };
      },
    };
  };

  it('takes the first clean layout and stops probing', () => {
    const { seen, rate } = buildRate([
      { hasMove: false, hasReadyMatch: false },
      { hasMove: true, hasReadyMatch: true },
      { hasMove: true, hasReadyMatch: false },
    ]);

    const picked = pickReshuffleLayout(6, 10, rate, buildVaryingRandom());

    expect(seen).toHaveLength(3);
    expect(picked).toBe(seen[2]);
  });

  it('falls back to the first layout with a move when no clean one shows up', () => {
    const { seen, rate } = buildRate(
      Array.from({ length: 4 }, () => ({ hasMove: true, hasReadyMatch: true }))
    );

    const picked = pickReshuffleLayout(6, 4, rate, buildVaryingRandom());

    // Запасная - именно первая с ходом, а не последняя оценённая.
    expect(seen).toHaveLength(4);
    expect(picked).toBe(seen[0]);
  });

  it('gives up when no attempt yields a move', () => {
    const { seen, rate } = buildRate(
      Array.from({ length: 3 }, () => ({ hasMove: false, hasReadyMatch: false }))
    );

    expect(pickReshuffleLayout(6, 3, rate, buildVaryingRandom())).toBeNull();
    expect(seen).toHaveLength(3);
  });

  it('spends no attempts when the budget is empty', () => {
    const { seen, rate } = buildRate([{ hasMove: true, hasReadyMatch: false }]);

    expect(pickReshuffleLayout(6, 0, rate, buildVaryingRandom())).toBeNull();
    expect(seen).toHaveLength(0);
  });

  it('returns a full permutation of the chips', () => {
    const { rate } = buildRate([{ hasMove: true, hasReadyMatch: false }]);
    const picked = pickReshuffleLayout(6, 10, rate, buildVaryingRandom());

    expect(picked).not.toBeNull();
    expect([...(picked ?? [])].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

import { describe, expect, it } from 'vitest';
import { createSeededRandom } from '@/shared/lib/random';
import { hasBoardMatch } from '../lib/boardMatches';
import type { TMinigameChipId } from '../lib/minigameLevelConfig';
import { BoardEngine } from './BoardEngine';
import {
  BOARD_OVERLAY_HP,
  BOARD_PIECE_HP,
  isChipPiece,
  type IBoardCellSeed,
  type TBoardPiece,
  type TBoardPieceSeed,
} from './boardPieces';
import type { IBoardHit, TBoardBlast, TBoardStep } from './boardSteps';

const CHIP_BY_LETTER: Record<string, TMinigameChipId> = {
  Y: 'yellow',
  R: 'red',
  V: 'violet',
  G: 'green',
  B: 'blue',
};

/**
 * Поле из строк сверху вниз: заглавная буква - фишка (`Y R V G B`), `C` -
 * ящик, `S` - камень, `M` - слизь, `D` - «опусти вниз», `H` - дыра, `-` / `|` - лазер по
 * строке / по колонке, `*` - бомба, `+` - пропеллер, `@` - радуга, строчная
 * буква - фишка этого цвета подо льдом. Возвращает `cells[col][row]`.
 */
const board = (...rows: string[]): IBoardCellSeed[][] => {
  const cols = rows[0].length;
  const pieceOf = (letter: string): TBoardPieceSeed => {
    if (letter === 'C') return { id: 'cargo', hp: 2 };
    if (letter === 'S') return { id: 'stone', hp: BOARD_PIECE_HP.stone };
    if (letter === 'M') return { id: 'slime', hp: BOARD_PIECE_HP.slime };
    if (letter === 'D') return { id: 'drop', hp: BOARD_PIECE_HP.drop };
    if (letter === 'H') return { id: 'HOLE', hp: BOARD_PIECE_HP.hole };
    if (letter === '-') return { id: 'laser', direction: 'horizontal', hp: 1 };
    if (letter === '|') return { id: 'laser', direction: 'vertical', hp: 1 };
    if (letter === '*') return { id: 'bomb', hp: 1 };
    if (letter === '+') return { id: 'propeller', hp: 1 };
    if (letter === '@') return { id: 'rainbow', hp: 1 };

    return { id: CHIP_BY_LETTER[letter.toUpperCase()], hp: 1 };
  };

  return Array.from({ length: cols }, (_, col) =>
    rows.map((line): IBoardCellSeed => {
      const letter = line[col];
      const isIced = /[a-z]/.test(letter);

      return isIced
        ? { piece: pieceOf(letter), overlay: { id: 'ice', hp: BOARD_OVERLAY_HP.ice } }
        : { piece: pieceOf(letter) };
    })
  );
};

/** Слои поверх доски `board`: цепь и подложка по клеткам `[col, row]`. */
const layered = (
  cells: IBoardCellSeed[][],
  { chain = [], floor = [] }: { chain?: [number, number][]; floor?: [number, number, number][] }
): IBoardCellSeed[][] => {
  chain.forEach(([col, row]) => {
    cells[col][row] = { ...cells[col][row], overlay: { id: 'chain', hp: BOARD_OVERLAY_HP.chain } };
  });
  floor.forEach(([col, row, hp]) => {
    cells[col][row] = { ...cells[col][row], floor: { id: 'floor', hp } };
  });

  return cells;
};

/** Источник случайности, отдающий значения по кругу: добор становится предсказуемым. */
const cycle = (...values: number[]): (() => number) => {
  let index = 0;

  return () => values[index++ % values.length];
};

const ALL_COLORS: TMinigameChipId[] = ['yellow', 'red', 'violet', 'green', 'blue'];

const engine = (cells: IBoardCellSeed[][], random: () => number = createSeededRandom(1)) =>
  new BoardEngine(cells, { colors: ALL_COLORS, random });

/** Поле движка буквами - тем же алфавитом, что `board`. */
const snapshot = (subject: BoardEngine): string[] => {
  const letterOf = (piece: Readonly<TBoardPiece> | null, isIced: boolean): string => {
    if (!piece) return '.';
    if (piece.id === 'cargo') return 'C';
    if (piece.id === 'stone') return 'S';
    if (piece.id === 'slime') return 'M';
    if (piece.id === 'drop') return 'D';
    if (piece.id === 'HOLE') return 'H';
    if (piece.id === 'laser') return piece.direction === 'horizontal' ? '-' : '|';
    if (piece.id === 'bomb') return '*';
    if (piece.id === 'propeller') return '+';
    if (piece.id === 'rainbow') return '@';

    return isIced ? piece.id[0] : piece.id[0].toUpperCase();
  };

  return Array.from({ length: subject.rows }, (_, row) =>
    Array.from({ length: subject.cols }, (_, col) =>
      letterOf(subject.pieceAt({ col, row }), subject.overlayAt({ col, row })?.id === 'ice')
    ).join('')
  );
};

const stepsOf = <TType extends TBoardStep['type']>(steps: readonly TBoardStep[], type: TType) =>
  steps.filter((step): step is Extract<TBoardStep, { type: TType }> => step.type === type);

const firstHits = (steps: readonly TBoardStep[]): IBoardHit[] => stepsOf(steps, 'damage')[0].hits;

/** Виды взрывов по порядку - читаемая форма протокола спецфишек. */
const blasts = (steps: readonly TBoardStep[]): TBoardBlast[] =>
  stepsOf(steps, 'detonate').map((step) => step.blast);

const blastKinds = (steps: readonly TBoardStep[]): string[] =>
  blasts(steps).map((blast) => blast.kind);

const tap = (subject: BoardEngine, col: number, row: number): TBoardStep[] => {
  const steps = subject.activateSpecialAt({ col, row });

  if (!steps) {
    throw new Error(`no special at ${col}:${row}`);
  }

  return steps;
};

const cellId = (pos: { col: number; row: number }): string => `${pos.col}:${pos.row}`;

const accepted = (outcome: ReturnType<BoardEngine['trySwap']>): TBoardStep[] => {
  if (outcome.kind !== 'accepted') {
    throw new Error(`expected accepted swap, got ${outcome.kind}`);
  }

  return outcome.steps;
};

const hasReadyMatch = (subject: BoardEngine): boolean => {
  const grid = Array.from({ length: subject.cols }, (_, col) =>
    Array.from({ length: subject.rows }, (_, row) => subject.pieceAt({ col, row }))
  );

  return hasBoardMatch(grid, isChipPiece);
};

describe('BoardEngine.fromLevel', () => {
  it('собирает доску из клеток уровня', () => {
    const subject = BoardEngine.fromLevel(
      [
        [
          { id: 'red' },
          { id: 'green', overlay: 'ice' },
          { id: 'HOLE' },
          { id: 'cargo', layers: 2 },
        ],
      ],
      { colors: ALL_COLORS, random: createSeededRandom(1) }
    );

    expect(snapshot(subject)).toEqual(['R', 'g', 'H', 'C']);
  });

  it('ставит спецфишки уровня; ракета без оси - горизонтальная', () => {
    const subject = BoardEngine.fromLevel(
      [
        [
          { id: 'laser', direction: 'vertical' },
          { id: 'laser' },
          { id: 'bomb' },
          { id: 'propeller' },
          { id: 'rainbow' },
        ],
      ],
      { colors: ALL_COLORS, random: createSeededRandom(1) }
    );

    expect(subject.pieceAt({ col: 0, row: 0 })).toMatchObject({
      id: 'laser',
      direction: 'vertical',
    });
    expect(subject.pieceAt({ col: 0, row: 1 })).toMatchObject({
      id: 'laser',
      direction: 'horizontal',
    });
    expect(subject.listSpecials()).toHaveLength(5);
  });

  it('на двух цветах не начинает партию с готовой фигурой из клеток «?»', () => {
    const cells = Array.from({ length: 7 }, () =>
      Array.from({ length: 7 }, () => ({ id: 'random' }))
    );
    let clean = 0;

    for (let seed = 1; seed <= 30; seed++) {
      const subject = BoardEngine.fromLevel(cells, {
        colors: ['red', 'blue'],
        random: createSeededRandom(seed),
      });

      expect(subject.hasMove()).toBe(true);

      if (!hasReadyMatch(subject)) {
        clean++;
      }
    }

    expect(clean).toBe(30);
  });

  it('бросает на неизвестной клетке', () => {
    expect(() =>
      BoardEngine.fromLevel([[{ id: 'meteor' }]], { colors: ALL_COLORS, random: Math.random })
    ).toThrow('Unknown cell id: meteor');
  });
});

describe('BoardEngine: свап', () => {
  it('валидный свап: обмен, удар по линии, оседание, доска без готовых линий', () => {
    const subject = engine(board('RRGR', 'GBYB', 'YGBV', 'BVYG'));

    const steps = accepted(subject.trySwap({ col: 2, row: 0 }, { col: 3, row: 0 }));

    expect(steps[0]).toMatchObject({ type: 'swap' });
    expect(firstHits(steps)).toHaveLength(3);
    expect(firstHits(steps).every((hit) => hit.destroyed)).toBe(true);
    expect(stepsOf(steps, 'settle')[0].spawns).toHaveLength(3);
    expect(hasReadyMatch(subject)).toBe(false);
  });

  it('свап без линии отклоняется, доска не меняется', () => {
    const subject = engine(board('RGBY', 'GBYR', 'BYRG', 'YRGB'));
    const before = snapshot(subject);

    expect(subject.trySwap({ col: 0, row: 0 }, { col: 1, row: 0 })).toEqual({ kind: 'rejected' });
    expect(snapshot(subject)).toEqual(before);
  });

  it('блокер, дыра, не сосед и край доски - ход невозможен', () => {
    const subject = engine(board('RCGY', 'HBYR', 'BYRG'));

    expect(subject.trySwap({ col: 0, row: 0 }, { col: 1, row: 0 }).kind).toBe('blocked');
    expect(subject.trySwap({ col: 0, row: 0 }, { col: 0, row: 1 }).kind).toBe('blocked');
    expect(subject.trySwap({ col: 0, row: 0 }, { col: 2, row: 0 }).kind).toBe('blocked');
    expect(subject.trySwap({ col: 3, row: 0 }, { col: 4, row: 0 }).kind).toBe('blocked');
  });

  it('линия из 4 оставляет лазер в клетке, куда игрок довёл фишку', () => {
    const subject = engine(board('YGRYV', 'GRYRR', 'YGVBY'), cycle(0.1, 0.5, 0.9));

    const steps = accepted(subject.trySwap({ col: 2, row: 0 }, { col: 2, row: 1 }));
    const [special] = stepsOf(steps, 'special');

    expect(special.placement).toMatchObject({ col: 2, row: 1, piece: { direction: 'horizontal' } });
  });
});

describe('BoardEngine: ракета', () => {
  it('чистит свою строку, задевает соседние блокеры и разрушается сама', () => {
    const subject = engine(board('RGBYV', 'GB-RG', 'YCRBY'));

    expect(subject.activateSpecialAt({ col: 0, row: 0 })).toBeNull();

    const steps = tap(subject, 2, 1);
    const hits = firstHits(steps);

    expect(steps[0]).toMatchObject({ type: 'detonate', blast: { kind: 'line' } });
    // 4 клетки строки + ящик под строкой + сама ракета.
    expect(hits).toHaveLength(6);
    expect(hits.filter((hit) => !hit.destroyed)).toEqual([
      { uid: expect.any(Number), id: 'cargo', layer: 'piece', hp: 1, destroyed: false },
    ]);
  });

  it('спецфишка, задетая взрывом, взрывается сама - на месте и до оседания', () => {
    const subject = engine(board('RGBYV', 'G-B|G', 'YRGBY'));
    const first = subject.pieceAt({ col: 1, row: 1 });
    const second = subject.pieceAt({ col: 3, row: 1 });

    const steps = tap(subject, 1, 1);
    const fired = stepsOf(steps, 'detonate').map((step) => step.uid);

    expect(fired).toEqual([first?.uid, second?.uid]);
    expect(blasts(steps)[1]).toEqual({
      kind: 'line',
      at: { col: 3, row: 1 },
      direction: 'vertical',
    });
    expect(steps.indexOf(stepsOf(steps, 'detonate')[1])).toBeLessThan(
      steps.indexOf(stepsOf(steps, 'settle')[0])
    );
  });

  it('свап ракеты с фишкой - всегда ход: обмен, затем выстрел; с ящиком - нет', () => {
    const subject = engine(board('RGBYV', 'GB-RG', 'YRCBY'));

    expect(subject.trySwap({ col: 2, row: 1 }, { col: 2, row: 2 }).kind).toBe('blocked');

    const steps = accepted(subject.trySwap({ col: 2, row: 1 }, { col: 1, row: 1 }));

    expect(steps.map((step) => step.type).slice(0, 2)).toEqual(['swap', 'detonate']);
    expect(blasts(steps)[0]).toMatchObject({ kind: 'line', at: { col: 1, row: 1 } });
  });
});

describe('BoardEngine: фигуры и рождение спецфишек', () => {
  it('L/T даёт бомбу в клетке свапа', () => {
    const subject = engine(board('GRBY', 'RYRG', 'BRGB', 'YRBG'));

    const steps = accepted(subject.trySwap({ col: 1, row: 0 }, { col: 1, row: 1 }));

    expect(stepsOf(steps, 'special')[0].placement).toMatchObject({
      col: 1,
      row: 1,
      piece: { id: 'bomb' },
    });
  });

  it('квадрат 2×2 - это ход, и он даёт пропеллер', () => {
    const subject = engine(board('GBGY', 'BRRG', 'YRYR', 'GYBG'));

    const steps = accepted(subject.trySwap({ col: 3, row: 2 }, { col: 2, row: 2 }));

    expect(stepsOf(steps, 'special')[0].placement).toMatchObject({
      col: 2,
      row: 2,
      piece: { id: 'propeller' },
    });
  });

  it('линия из пяти даёт радугу', () => {
    const subject = engine(board('GBRYG', 'RRYRR', 'BYGBY', 'YGBGB'));

    const steps = accepted(subject.trySwap({ col: 2, row: 0 }, { col: 2, row: 1 }));

    expect(stepsOf(steps, 'special')[0].placement).toMatchObject({
      col: 2,
      row: 1,
      piece: { id: 'rainbow' },
    });
  });
});

describe('BoardEngine: бомба, пропеллер, радуга', () => {
  it('бомба бьёт 3×3 вокруг себя и поджигает спецфишку в зоне', () => {
    const subject = engine(board('RGBYR', 'G*-GB', 'BYRBY'));

    const steps = tap(subject, 1, 1);

    expect(blastKinds(steps)).toEqual(['area', 'line']);
    // Сама бомба и семь фишек вокруг; ракета не гаснет, а взрывается следом.
    expect(firstHits(steps)).toHaveLength(8);
    expect(firstHits(steps).every((hit) => hit.destroyed)).toBe(true);
  });

  it('пропеллер бьёт крест и летит в приоритетную цель', () => {
    const subject = new BoardEngine(board('+GBYR', 'GRYGB', 'BYRBC'), {
      colors: ALL_COLORS,
      random: createSeededRandom(1),
      isPriorityTarget: (ids) => ids.includes('cargo'),
    });

    const steps = tap(subject, 0, 0);
    const damage = stepsOf(steps, 'damage');

    expect(blasts(steps)).toEqual([
      { kind: 'takeoff', at: { col: 0, row: 0 } },
      { kind: 'flight', from: { col: 0, row: 0 }, to: { col: 4, row: 2 }, carried: null },
    ]);
    // Крест в углу - сам пропеллер и два соседа; затем удар по ящику.
    expect(damage[0].hits).toHaveLength(3);
    expect(damage[1].hits).toEqual([
      { uid: expect.any(Number), id: 'cargo', layer: 'piece', hp: 1, destroyed: false },
    ]);
  });

  it('радуга, свапнутая с фишкой, снимает весь её цвет', () => {
    const subject = engine(board('@GBY', 'GRYG', 'BGRB'));

    const steps = accepted(subject.trySwap({ col: 0, row: 0 }, { col: 1, row: 0 }));
    const [blast] = blasts(steps);

    expect(blast).toMatchObject({ kind: 'color', color: 'green' });
    expect(blast.kind === 'color' && blast.targets).toHaveLength(4);
  });

  it('радуга по тапу бьёт самый частый цвет', () => {
    const subject = engine(board('@RBY', 'RGRB', 'BRGY'));

    expect(blasts(tap(subject, 0, 0))[0]).toMatchObject({ kind: 'color', color: 'red' });
  });
});

describe('BoardEngine: комбинации', () => {
  const pair = (top: string, bottom: string) =>
    engine(board('RGBYR', `GB${top}GB`, `BY${bottom}RY`, 'YRGBG', 'RGYRB'));
  const combo = (top: string, bottom: string): TBoardStep[] =>
    accepted(pair(top, bottom).trySwap({ col: 2, row: 1 }, { col: 2, row: 2 }));

  it('ракета+ракета - крест через клетку свапа', () => {
    const steps = combo('-', '|');

    expect(blasts(steps)[0]).toEqual({ kind: 'cross', at: { col: 2, row: 2 }, width: 1 });
    // Строка и колонка 5×5 - девять клеток, обе ракеты среди них.
    expect(firstHits(steps)).toHaveLength(9);
  });

  it('ракета+бомба - по три строки и колонки', () => {
    const steps = combo('-', '*');

    expect(blasts(steps)[0]).toMatchObject({ kind: 'cross', width: 3 });
    expect(firstHits(steps)).toHaveLength(21);
  });

  it('бомба+бомба - квадрат 5×5', () => {
    const steps = combo('*', '*');

    expect(blasts(steps)[0]).toMatchObject({ kind: 'area', radius: 2 });
    expect(firstHits(steps)).toHaveLength(25);
  });

  it('радуга+ракета - фишки цвета становятся ракетами и стреляют', () => {
    const steps = combo('@', '-');
    const [transform] = stepsOf(steps, 'transform');
    const lines = blasts(steps).filter((blast) => blast.kind === 'line');

    expect(transform.changes.length).toBeGreaterThan(0);
    expect(transform.changes.every((change) => change.placement.piece.id === 'laser')).toBe(true);
    expect(lines).toHaveLength(transform.changes.length);
  });

  it('радуга+радуга - удар по всему полю', () => {
    const steps = combo('@', '@');

    expect(blasts(steps)[0]).toMatchObject({ kind: 'board' });
    expect(firstHits(steps)).toHaveLength(25);
  });

  it('пропеллер+ракета - пропеллер несёт ракету, и она стреляет в цели', () => {
    const steps = combo('+', '-');
    const [takeoff, flight, line] = blasts(steps);

    expect(takeoff).toMatchObject({ kind: 'takeoff', at: { col: 2, row: 2 } });
    expect(flight).toMatchObject({ kind: 'flight', carried: 'laser' });
    expect(line).toMatchObject({ kind: 'line', at: flight.kind === 'flight' ? flight.to : null });
  });

  it('пропеллер+пропеллер - три полёта к разным целям', () => {
    const flights = blasts(combo('+', '+')).filter((blast) => blast.kind === 'flight');

    expect(flights).toHaveLength(3);
    expect(new Set(flights.map((blast) => blast.kind === 'flight' && cellId(blast.to))).size).toBe(
      3
    );
  });
});

describe('BoardEngine: блокеры', () => {
  it('ящик рядом с линией получает один удар, даже если соседствует с двумя фишками', () => {
    const subject = engine(board('RRGR', 'YCBV', 'BVYG'));

    const steps = accepted(subject.trySwap({ col: 2, row: 0 }, { col: 3, row: 0 }));
    const cargo = firstHits(steps).filter((hit) => !hit.destroyed);

    expect(cargo).toEqual([
      { uid: expect.any(Number), id: 'cargo', layer: 'piece', hp: 1, destroyed: false },
    ]);
  });

  it('лёд - накладка: трескается от матча рядом, разбитый открывает свою фишку', () => {
    const subject = engine(board('RRGR', 'YrBV', 'BVYG'));

    // Первый матч - лёд треснул, фишка подо льдом цела.
    accepted(subject.trySwap({ col: 2, row: 0 }, { col: 3, row: 0 }));
    expect(subject.overlayAt({ col: 1, row: 1 })).toMatchObject({ id: 'ice', hp: 1 });
    expect(subject.pieceAt({ col: 1, row: 1 })?.id).toBe('red');

    // Луч бустера добивает лёд - удар принимает накладка, а не фишка.
    const steps = subject.applyBooster('beam', { col: 1, row: 1 }) ?? [];

    expect(firstHits(steps)).toEqual([
      { uid: expect.any(Number), id: 'ice', layer: 'overlay', hp: 0, destroyed: true },
    ]);
    expect(subject.overlayAt({ col: 1, row: 1 })).toBeNull();
  });
});

describe('BoardEngine: гравитация и добор', () => {
  it('фишки падают сквозь дыру, добор - только цветами уровня', () => {
    const colors: TMinigameChipId[] = ['green', 'blue', 'violet'];
    const subject = new BoardEngine(board('GBV', 'HYB', 'BVG', 'RRY'), {
      colors,
      random: cycle(0.1, 0.5, 0.9),
    });

    const steps = subject.applyBooster('beam', { col: 0, row: 3 }) ?? [];
    const settle = stepsOf(steps, 'settle')[0];

    // Колонка 0: G, дыра, B, R. Разбили R внизу - B падает на строку ниже, а G
    // над дырой проходит сквозь неё на место B.
    expect(settle.moves).toEqual([
      { uid: expect.any(Number), from: { col: 0, row: 2 }, path: [{ col: 0, row: 3 }] },
      { uid: expect.any(Number), from: { col: 0, row: 0 }, path: [{ col: 0, row: 2 }] },
    ]);
    expect(subject.pieceAt({ col: 0, row: 1 })?.id).toBe('HOLE');
    expect(
      stepsOf(steps, 'settle')
        .flatMap((step) => step.spawns)
        .every((spawn) => colors.includes(spawn.piece.id))
    ).toBe(true);
  });

  it('одно зерно и те же ходы - та же доска', () => {
    const play = () => {
      const subject = engine(board('RRGRB', 'GBYBV', 'YGBVY', 'BVYGR'), createSeededRandom(99));
      accepted(subject.trySwap({ col: 2, row: 0 }, { col: 3, row: 0 }));
      subject.applyBooster('ball', { col: 2, row: 2 });

      return snapshot(subject);
    };

    expect(play()).toEqual(play());
  });
});

describe('BoardEngine: бустеры', () => {
  it('лазер-бустер снимает все фишки цвета, но только по фишке', () => {
    const subject = engine(board('RGRB', 'CRYG', 'BVRY'));

    expect(subject.applyBooster('laser', { col: 0, row: 1 })).toBeNull();

    const steps = subject.applyBooster('laser', { col: 0, row: 0 }) ?? [];

    expect(stepsOf(steps, 'colorSweep')[0].uids).toHaveLength(4);
  });

  it('шар бьёт три строки; к дыре бустер неприменим', () => {
    const subject = engine(board('RGBY', 'GBYR', 'BYRG', 'YRHB'));

    expect(subject.applyBooster('beam', { col: 2, row: 3 })).toBeNull();

    const steps = subject.applyBooster('ball', { col: 1, row: 1 }) ?? [];

    expect(firstHits(steps)).toHaveLength(12);
    expect(stepsOf(steps, 'rowsBlast')[0]).toMatchObject({ row: 1, rows: [0, 1, 2] });
  });

  it('шар у края поля бьёт две строки, и волн столько же', () => {
    const subject = engine(board('RGBY', 'GBYR', 'BYRG', 'YRHB'));

    const steps = subject.applyBooster('ball', { col: 1, row: 0 }) ?? [];

    expect(firstHits(steps)).toHaveLength(8);
    expect(stepsOf(steps, 'rowsBlast')[0]).toMatchObject({ row: 0, rows: [0, 1] });
  });

  it('луч бьёт одну клетку: лёд теряет слой, но стоит', () => {
    const subject = engine(board('RGBY', 'GrYB', 'BYVG'));
    const before = snapshot(subject);

    const steps = subject.applyBooster('beam', { col: 1, row: 1 }) ?? [];

    expect(steps.map((step) => step.type)).toEqual(['beam', 'damage', 'settle']);
    expect(firstHits(steps)).toEqual([
      { uid: expect.any(Number), id: 'ice', layer: 'overlay', hp: 1, destroyed: false },
    ]);
    expect(snapshot(subject)).toEqual(before);
  });

  it('луч по спецфишке не гасит её, а взрывает', () => {
    const subject = engine(board('RGBY', 'GBYR', 'BY-G'));
    const laser = subject.pieceAt({ col: 2, row: 2 });

    const steps = subject.applyBooster('beam', { col: 2, row: 2 }) ?? [];

    expect(stepsOf(steps, 'detonate')[0]).toMatchObject({
      uid: laser?.uid,
      blast: { kind: 'line', direction: 'horizontal' },
    });
  });

  it('применимость бустера известна до хода и доску не трогает', () => {
    const subject = engine(board('RGB', 'GHC', 'BYR'));
    const before = snapshot(subject);

    // Дыра - не цель ни для одного бустера, «лазер» - только по фишке.
    expect(subject.canApplyBooster('beam', { col: 1, row: 1 })).toBe(false);
    expect(subject.canApplyBooster('ball', { col: 1, row: 1 })).toBe(false);
    expect(subject.canApplyBooster('laser', { col: 2, row: 1 })).toBe(false);
    expect(subject.canApplyBooster('beam', { col: 2, row: 1 })).toBe(true);
    expect(subject.canApplyBooster('laser', { col: 0, row: 0 })).toBe(true);
    expect(snapshot(subject)).toEqual(before);
  });
});

describe('BoardEngine: тупик', () => {
  it('доска с ходом - разбирать нечего', () => {
    expect(engine(board('RRGR', 'GBYB', 'YGBV')).resolveDeadEnd()).toEqual({ kind: 'hasMove' });
  });

  it('ходов фишками нет, но есть спецфишка - подсказать её', () => {
    const subject = engine(board('RGBY', 'GB*R', 'CYRG', 'YRGB'));
    const bomb = subject.pieceAt({ col: 2, row: 1 });

    expect(subject.resolveDeadEnd()).toEqual({ kind: 'specialHint', uid: bomb?.uid });
  });

  it('без хода перемешивает фишки так, что ход появляется; блокеры стоят', () => {
    const subject = engine(board('RGBY', 'GBYR', 'CYRG', 'YRGB'));

    expect(subject.hasMove()).toBe(false);
    expect(subject.resolveDeadEnd().kind).toBe('shuffled');
    expect(subject.pieceAt({ col: 0, row: 2 })?.id).toBe('cargo');
    // Перемешка могла сразу сыграть каскадом, но в конце ход обязан быть.
    expect(subject.hasMove()).toBe(true);
  });

  it('хода не построить - партия проиграна, доска не тронута', () => {
    const subject = engine(board('RCG', 'CCC', 'BCY'));
    const before = snapshot(subject);

    expect(subject.resolveDeadEnd()).toEqual({ kind: 'stuck' });
    expect(snapshot(subject)).toEqual(before);
  });
});

describe('BoardEngine: слои и препятствия', () => {
  it('фишка под цепью матчится, но стоит: удар снимает цепь, фишка остаётся', () => {
    const subject = engine(layered(board('RRGR', 'YBVG'), { chain: [[1, 0]] }));

    expect(subject.trySwap({ col: 1, row: 0 }, { col: 1, row: 1 }).kind).toBe('blocked');

    const steps = accepted(subject.trySwap({ col: 2, row: 0 }, { col: 3, row: 0 }));

    expect(firstHits(steps)).toContainEqual({
      uid: expect.any(Number),
      id: 'chain',
      layer: 'overlay',
      hp: 0,
      destroyed: true,
    });
    expect(subject.overlayAt({ col: 1, row: 0 })).toBeNull();
  });

  it('фишка подо льдом в линию не идёт', () => {
    const subject = engine(board('RrRG', 'YBVB'));

    expect(subject.hasMove()).toBe(false);
    expect(subject.trySwap({ col: 2, row: 0 }, { col: 3, row: 0 }).kind).toBe('rejected');
  });

  it('камень не берёт брызг от матча, но берёт прямой удар взрыва', () => {
    const matchNext = engine(board('RRGR', 'YSBV', 'BVYG'));
    const matched = accepted(matchNext.trySwap({ col: 2, row: 0 }, { col: 3, row: 0 }));

    expect(firstHits(matched).every((hit) => hit.layer === 'piece')).toBe(true);
    expect(matchNext.pieceAt({ col: 1, row: 1 })?.id).toBe('stone');

    const rocket = engine(board('RGBYV', 'GS-RG', 'YRGBY'));

    tap(rocket, 2, 1);
    expect(rocket.pieceAt({ col: 1, row: 1 })?.id).not.toBe('stone');
  });

  it('подложка снимается слоем, когда на её клетке гаснет фишка', () => {
    const subject = engine(layered(board('RRGR', 'YBVG'), { floor: [[0, 0, 2]] }));

    const steps = accepted(subject.trySwap({ col: 2, row: 0 }, { col: 3, row: 0 }));

    expect(firstHits(steps)).toContainEqual({
      uid: expect.any(Number),
      id: 'floor',
      layer: 'floor',
      hp: 1,
      destroyed: false,
    });
    expect(subject.floorAt({ col: 0, row: 0 })?.hp).toBe(1);
  });

  it('«опусти вниз» падает, дойдя до дна колонки - собран, и доска оседает снова', () => {
    const subject = engine(board('DGB', 'YRV', 'BVY'));
    const drop = subject.pieceAt({ col: 0, row: 0 });

    const steps = subject.applyBooster('ball', { col: 0, row: 2 }) ?? [];
    const [collect] = stepsOf(steps, 'collect');

    expect(collect.uids).toEqual([drop?.uid]);
    expect(subject.locate(drop?.uid ?? -1)).toBeNull();
    const settles = stepsOf(steps, 'settle');

    // После сбора доска оседает ещё раз: собранный предмет освободил клетку.
    expect(steps.indexOf(collect)).toBeLessThan(steps.indexOf(settles[settles.length - 1]));
  });

  it('ящик неподвижен: пустоту под ним заполняет соседняя колонка по диагонали', () => {
    const subject = engine(board('CRG', 'BYV', 'GBR'), cycle(0.1, 0.5, 0.9));

    const steps = subject.applyBooster('beam', { col: 0, row: 1 }) ?? [];
    const [settle] = stepsOf(steps, 'settle');

    expect(subject.pieceAt({ col: 0, row: 0 })?.id).toBe('cargo');
    expect(settle.moves).toContainEqual({
      uid: expect.any(Number),
      from: { col: 1, row: 0 },
      path: [{ col: 0, row: 1 }],
    });
  });

  it('под серединой ряда камней фишка добирается на месте, а не остаётся дырой', () => {
    const subject = engine(board('SSSY', 'GRBV', 'BYRG'));

    const steps = subject.applyBooster('beam', { col: 1, row: 1 }) ?? [];
    const [settle] = stepsOf(steps, 'settle');

    expect(settle.spawns).toContainEqual(
      expect.objectContaining({ col: 1, row: 1, path: [{ col: 1, row: 1 }], inPlace: true })
    );
    expect(subject.pieceAt({ col: 1, row: 1 })).not.toBeNull();
  });

  it('пропеллер выбирает целью то, что нужно уровню, даже если это подложка', () => {
    const subject = new BoardEngine(
      layered(board('+GBYR', 'GRYGB', 'BYRBG'), { floor: [[4, 2, 1]] }),
      {
        colors: ALL_COLORS,
        random: createSeededRandom(1),
        isPriorityTarget: (ids) => ids.includes('floor'),
      }
    );

    expect(blasts(tap(subject, 0, 0))[1]).toMatchObject({ kind: 'flight', to: { col: 4, row: 2 } });
  });
});

describe('BoardEngine: слизь', () => {
  it('матч рядом снимает слизь, и ход, снявший её, ей расползтись не даёт', () => {
    const subject = engine(board('RRGR', 'YMBV', 'BVYG'));

    const steps = accepted(subject.trySwap({ col: 2, row: 0 }, { col: 3, row: 0 }));

    expect(firstHits(steps)).toContainEqual(
      expect.objectContaining({ id: 'slime', layer: 'piece', destroyed: true })
    );
    expect(stepsOf(steps, 'spread')).toHaveLength(0);
  });

  it('ход, не задевший слизь, расползает её на соседнюю фишку', () => {
    const subject = engine(board('RRGRY', 'YBVBG', 'BVYGM'));
    const neighbors = [subject.pieceAt({ col: 3, row: 2 }), subject.pieceAt({ col: 4, row: 1 })];

    const steps = accepted(subject.trySwap({ col: 2, row: 0 }, { col: 3, row: 0 }));
    const [spread] = stepsOf(steps, 'spread');

    expect(steps[steps.length - 1]).toBe(spread);
    expect(spread.from).toEqual({ col: 4, row: 2 });
    expect(neighbors.map((piece) => piece?.uid)).toContain(spread.eaten);
    expect(subject.pieceAt(spread.placement)?.id).toBe('slime');
    // Поглощённая фишка - не разрушенная: в ударах её нет, в цель она не идёт.
    const hitUids = stepsOf(steps, 'damage').flatMap((step) => step.hits.map((hit) => hit.uid));

    expect(hitUids).not.toContain(spread.eaten);
    expect(subject.locate(spread.eaten)).toBeNull();
  });

  it('на фишку под накладкой и на спецфишку слизь не ползёт', () => {
    const subject = engine(board('RRGRY', 'YBVBy', 'BVY*M'));

    const steps = accepted(subject.trySwap({ col: 2, row: 0 }, { col: 3, row: 0 }));

    expect(stepsOf(steps, 'spread')).toHaveLength(0);
  });

  it('тап по спецфишке - тоже ход: не задевшая слизь после него расползается', () => {
    const subject = engine(board('RGBYV', 'G-RGB', 'YRGBY', 'BVYGM'));

    expect(stepsOf(tap(subject, 1, 1), 'spread')).toHaveLength(1);
  });

  it('бустер ходом не считается и слизь не будит', () => {
    const subject = engine(board('RGBYV', 'GBRGB', 'YRGBY', 'BVYGM'));

    expect(stepsOf(subject.applyBooster('beam', { col: 0, row: 0 }) ?? [], 'spread')).toHaveLength(
      0
    );
  });

  it('слизь неподвижна: держит гравитацию, как ящик', () => {
    const subject = engine(board('MRG', 'BYV', 'GBR'), cycle(0.1, 0.5, 0.9));

    subject.applyBooster('beam', { col: 0, row: 1 });

    expect(subject.pieceAt({ col: 0, row: 0 })?.id).toBe('slime');
  });
});

describe('BoardEngine: финальный бонус', () => {
  it('оставшиеся ходы становятся ракетами и стреляют, на доске не остаётся спецфишек', () => {
    const subject = engine(board('RGBYV', 'GBYRG', 'YRGBY', 'BVYGR'));

    const steps = subject.playFinale(3);

    expect(steps[0]).toEqual({ type: 'bonus', moves: 3 });
    expect(stepsOf(steps, 'transform')[0].changes).toHaveLength(3);
    expect(blastKinds(steps).filter((kind) => kind === 'line').length).toBeGreaterThanOrEqual(3);
    expect(subject.listSpecials()).toEqual([]);
  });

  it('ракет не больше свободных фишек, а спецфишки доски срабатывают и без ходов', () => {
    const subject = engine(board('*C', 'CC'));

    const steps = subject.playFinale(0);

    expect(stepsOf(steps, 'bonus')).toHaveLength(0);
    expect(blastKinds(steps)).toEqual(['area']);
    expect(subject.listSpecials()).toEqual([]);
  });
});

describe('BoardEngine: лучший ход', () => {
  it('ценная фигура важнее ближней тройки', () => {
    // Свап (2,1)<->(2,0) даёт линию из четырёх R в строке 0 - это лучше тройки
    // в центре.
    const subject = engine(board('RRBRG', 'YGRYB', 'BYGBY', 'GBYGB'));

    expect(subject.findBestMove()).toEqual([
      { col: 2, row: 0 },
      { col: 2, row: 1 },
    ]);
  });

  it('комбинация двух спецфишек - лучший ход на доске', () => {
    const subject = engine(board('RRBRG', 'YG-*B', 'BYGBY'));

    expect(subject.findBestMove()).toEqual([
      { col: 2, row: 1 },
      { col: 3, row: 1 },
    ]);
  });

  it('при равной фигуре берёт ту, что нужна цели уровня', () => {
    const subject = new BoardEngine(board('RRGRYYBY', 'GBYGBGRB'), {
      colors: ALL_COLORS,
      random: createSeededRandom(1),
      isPriorityTarget: (ids) => ids.includes('yellow'),
    });

    expect(subject.findBestMove()).toEqual([
      { col: 6, row: 0 },
      { col: 7, row: 0 },
    ]);
  });
});

describe('BoardEngine: предуровневые бустеры', () => {
  it('ставит спецфишки на свободные фишки без разрушения', () => {
    const subject = engine(layered(board('RGBY', 'GBYR', 'BYRG'), { chain: [[0, 0]] }));

    const [step] = subject.placeStartSpecials(['laser', 'bomb', 'rainbow']);

    expect(step).toMatchObject({ type: 'preBoost' });
    if (step.type !== 'preBoost') return;

    expect(step.placements.map((placement) => placement.piece.id)).toEqual([
      'laser',
      'bomb',
      'rainbow',
    ]);
    // Фишка под цепью место не уступает.
    expect(step.placements.some((placement) => placement.col === 0 && placement.row === 0)).toBe(
      false
    );
    expect(subject.listSpecials()).toHaveLength(3);
  });

  it('на доске без свободных фишек ставить некуда', () => {
    expect(engine(board('CC', 'CC')).placeStartSpecials(['bomb'])).toEqual([]);
  });
});

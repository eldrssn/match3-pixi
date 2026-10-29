import type { TMinigameChipId } from '../lib/minigameLevelConfig';
import { damageCells, direct, withSplash, type ICellHit } from './boardDamage';
import {
  isChipPiece,
  isHolePiece,
  isSpecialPiece,
  isStaticPiece,
  type IChipPiece,
  type TBoardPiece,
  type TLaserDirection,
  type TSpecialPiece,
} from './boardPieces';
import { cellKey, type BoardState } from './boardState';
import type { IBoardCellPos, IBoardTransform, TBoardStep } from './boardSteps';

/**
 * Спецфишки и их комбинации - правило движка доски: что бьёт ракета, бомба,
 * пропеллер и радуга, сами и в паре.
 *
 * Задетая взрывом спецфишка не разрушается, а взрывается сама - на месте и
 * сразу, до оседания доски: вся цепочка играет одним залпом (`strike`), и
 * только потом доска осыпается. Урон по клеткам - `boardDamage`.
 */

/** Бомба бьёт квадрат 3×3, две бомбы - 5×5. */
const BOMB_RADIUS = 1;
const DOUBLE_BOMB_RADIUS = 2;

/** Два пропеллера: общий крест и три полёта к разным целям. */
const DOUBLE_PROPELLER_FLIGHTS = 3;

/**
 * Одна цепочка взрывов - от хода, тапа или бустера до оседания доски.
 * Спецфишка срабатывает в ней ровно один раз, сколько бы эффектов её ни
 * задело.
 */
export interface IChain {
  detonated: Set<number>;
}

export const createChain = (): IChain => ({ detonated: new Set() });

interface IPropellerTarget {
  piece: TBoardPiece | null;
  pos: IBoardCellPos;
  ids: string[];
}

/**
 * Удар одного события. Задетые прямым ударом спецфишки не гаснут, а
 * взрываются сами - на месте, следом за этим ударом. `sources` -
 * спецфишки, которые это событие и произвели: они разрушаются, а не
 * взрываются повторно.
 */
export const strike = (
  board: BoardState,
  hits: readonly ICellHit[],
  sources: readonly TBoardPiece[],
  chain: IChain
): TBoardStep[] => {
  const cellHits: ICellHit[] = board.positionsOf(sources).map(direct);
  const triggered: TSpecialPiece[] = [];

  for (const hit of hits) {
    const piece = board.cellAt(hit.pos);

    if (piece && isSpecialPiece(piece) && !sources.includes(piece)) {
      if (hit.kind === 'direct' && !chain.detonated.has(piece.uid) && !triggered.includes(piece)) {
        triggered.push(piece);
      }

      continue;
    }

    cellHits.push(hit);
  }

  const steps: TBoardStep[] = [damageCells(board, cellHits)];

  for (const special of triggered) {
    steps.push(...detonate(board, special, chain));
  }

  return steps;
};

/** Ракета: строка или колонка через клетку и брызг по соседям линии. */
const blastLine = (
  board: BoardState,
  sources: readonly TBoardPiece[],
  uid: number,
  at: IBoardCellPos,
  direction: TLaserDirection,
  chain: IChain
): TBoardStep[] => {
  const cells = direction === 'horizontal' ? board.rowCells(at.row) : board.colCells(at.col);

  return [
    { type: 'detonate', uid, blast: { kind: 'line', at, direction } },
    ...strike(board, withSplash(board, cells), sources, chain),
  ];
};

/** Строки и колонки через клетку: `width` 1 - крест, 3 - по три каждой оси. */
const blastCross = (
  board: BoardState,
  sources: readonly TBoardPiece[],
  uid: number,
  at: IBoardCellPos,
  width: 1 | 3,
  chain: IChain
): TBoardStep[] => {
  const reach = (width - 1) / 2;
  const cells: IBoardCellPos[] = [];

  for (let offset = -reach; offset <= reach; offset++) {
    cells.push(...board.rowCells(at.row + offset), ...board.colCells(at.col + offset));
  }

  return [
    { type: 'detonate', uid, blast: { kind: 'cross', at, width } },
    ...strike(board, withSplash(board, cells), sources, chain),
  ];
};

/** Бомба: квадрат со стороной `2 * radius + 1` вокруг клетки. */
const blastArea = (
  board: BoardState,
  sources: readonly TBoardPiece[],
  uid: number,
  at: IBoardCellPos,
  radius: number,
  chain: IChain
): TBoardStep[] => {
  const cells: IBoardCellPos[] = [];

  for (let col = at.col - radius; col <= at.col + radius; col++) {
    for (let row = at.row - radius; row <= at.row + radius; row++) {
      if (board.isInside({ col, row })) {
        cells.push({ col, row });
      }
    }
  }

  return [
    { type: 'detonate', uid, blast: { kind: 'area', at, radius } },
    ...strike(board, cells.map(direct), sources, chain),
  ];
};

/**
 * Цель пропеллера: сначала то, что нужно цели уровня, затем блокеры (ящик,
 * камень, накладка), затем фишки; спецфишка - только если больше лететь не
 * во что. Внутри яруса - случайно, от зерна партии.
 */
const pickPropellerTarget = (
  board: BoardState,
  excluded: ReadonlySet<string>
): IPropellerTarget | null => {
  const candidates: IPropellerTarget[] = [];

  for (let col = 0; col < board.cols; col++) {
    for (let row = 0; row < board.rows; row++) {
      const pos = { col, row };
      const piece = board.grid[col][row];
      const ids = board.layerIdsAt(pos);

      if ((piece && isHolePiece(piece)) || ids.length === 0 || excluded.has(cellKey(pos))) {
        continue;
      }

      candidates.push({ piece, pos, ids });
    }
  }

  const plain = candidates.filter(({ piece }) => !piece || !isSpecialPiece(piece));
  const tiers = [
    plain.filter(({ ids }) => board.isPriorityTarget?.(ids) ?? false),
    plain.filter(
      ({ piece, pos }) =>
        (piece !== null && isStaticPiece(piece)) || board.overlays[pos.col][pos.row] !== null
    ),
    plain.filter(({ piece }) => piece !== null && isChipPiece(piece)),
    candidates,
  ];
  const tier = tiers.find((list) => list.length > 0);

  return tier ? tier[Math.floor(board.random() * tier.length)] : null;
};

const flyTo = (
  board: BoardState,
  uid: number,
  from: IBoardCellPos,
  target: IPropellerTarget,
  carried: TSpecialPiece | null,
  chain: IChain
): TBoardStep[] => {
  const flight: TBoardStep = {
    type: 'detonate',
    uid,
    blast: { kind: 'flight', from, to: target.pos, carried: carried?.id ?? null },
  };

  // Несомая спецфишка уже снята с доски крестом взлёта и срабатывает в цели
  // как своя: ракета - линией через цель, бомба - квадратом вокруг неё.
  if (carried?.id === 'laser') {
    return [flight, ...blastLine(board, [], uid, target.pos, carried.direction, chain)];
  }

  if (carried?.id === 'bomb') {
    return [flight, ...blastArea(board, [], uid, target.pos, BOMB_RADIUS, chain)];
  }

  return [flight, ...strike(board, [direct(target.pos)], [], chain)];
};

/**
 * Пропеллер: крест из своей клетки и соседей, затем полёт в цель. С
 * `carried` (пропеллер+ракета/бомба) в цели срабатывает несомая спецфишка.
 */
const blastPropeller = (
  board: BoardState,
  sources: readonly TBoardPiece[],
  uid: number,
  at: IBoardCellPos,
  carried: TSpecialPiece | null,
  chain: IChain
): TBoardStep[] => {
  const cross = board.crossCells(at);
  const steps: TBoardStep[] = [
    { type: 'detonate', uid, blast: { kind: 'takeoff', at } },
    ...strike(board, cross.map(direct), sources, chain),
  ];
  const target = pickPropellerTarget(board, new Set(cross.map(cellKey)));

  if (target) {
    steps.push(...flyTo(board, uid, at, target, carried, chain));
  }

  return steps;
};

/** Два пропеллера: общий крест и несколько полётов к разным целям. */
const blastPropellers = (
  board: BoardState,
  sources: readonly TBoardPiece[],
  uid: number,
  at: IBoardCellPos,
  chain: IChain
): TBoardStep[] => {
  const cross = board.crossCells(at);
  const excluded = new Set(cross.map(cellKey));
  const steps: TBoardStep[] = [
    { type: 'detonate', uid, blast: { kind: 'takeoff', at } },
    ...strike(board, cross.map(direct), sources, chain),
  ];

  for (let flight = 0; flight < DOUBLE_PROPELLER_FLIGHTS; flight++) {
    const target = pickPropellerTarget(board, excluded);

    if (!target) {
      break;
    }

    excluded.add(cellKey(target.pos));
    steps.push(...flyTo(board, uid, at, target, null, chain));
  }

  return steps;
};

/** Радуга: все фишки цвета (и под накладками - удар примет накладка) и брызг вокруг. */
const blastColor = (
  board: BoardState,
  sources: readonly TBoardPiece[],
  uid: number,
  at: IBoardCellPos,
  color: TMinigameChipId,
  chain: IChain
): TBoardStep[] => {
  const chips = board.collectPieces((piece) => isChipPiece(piece) && piece.id === color);
  const targets = board.positionsOf(chips);

  return [
    { type: 'detonate', uid, blast: { kind: 'color', at, color, targets } },
    ...strike(board, withSplash(board, targets), sources, chain),
  ];
};

/** Радуга+радуга: прямой удар по каждой клетке поля. */
const blastBoard = (
  board: BoardState,
  sources: readonly TBoardPiece[],
  uid: number,
  at: IBoardCellPos,
  chain: IChain
): TBoardStep[] => {
  const cells: IBoardCellPos[] = [];

  for (let col = 0; col < board.cols; col++) {
    cells.push(...board.colCells(col));
  }

  return [
    { type: 'detonate', uid, blast: { kind: 'board', at } },
    ...strike(board, cells.map(direct), sources, chain),
  ];
};

/**
 * Радуга+спецфишка: свободные фишки самого частого цвета превращаются в
 * спецфишки того же вида и срабатывают одна за другой. Фишки под накладками
 * не превращаются - накладка держит их как есть.
 */
const transformColor = (
  board: BoardState,
  rainbow: TSpecialPiece,
  other: TSpecialPiece,
  at: IBoardCellPos,
  chain: IChain
): TBoardStep[] => {
  const color = board.mostCommonColor();
  const positions = board.positionsByUid();
  const chips = board
    .collectPieces((piece): piece is IChipPiece => isChipPiece(piece) && piece.id === color)
    .filter((chip) => {
      const pos = positions.get(chip.uid);

      return pos !== undefined && !board.overlays[pos.col][pos.row];
    });
  const steps: TBoardStep[] = [
    {
      type: 'detonate',
      uid: rainbow.uid,
      blast: { kind: 'color', at, color, targets: board.positionsOf(chips) },
    },
    damageCells(board, board.positionsOf([rainbow, other]).map(direct)),
  ];
  const changes: IBoardTransform[] = [];
  const created: TSpecialPiece[] = [];

  for (const chip of chips) {
    const pos = positions.get(chip.uid);

    if (!pos) {
      continue;
    }

    const piece = board.createSpecial(other.id, board.randomDirection());

    board.grid[pos.col][pos.row] = piece;
    changes.push({ uid: chip.uid, id: chip.id, placement: { ...pos, piece: { ...piece } } });
    created.push(piece);
  }

  if (changes.length > 0) {
    steps.push({ type: 'transform', changes });
  }

  for (const piece of created) {
    steps.push(...detonate(board, piece, chain));
  }

  return steps;
};

/**
 * Взрыв одной спецфишки. `partnerColor` - цвет фишки, с которой свапнули
 * радугу; без него радуга бьёт самый частый цвет доски.
 */
export const detonate = (
  board: BoardState,
  special: TSpecialPiece,
  chain: IChain,
  partnerColor: TMinigameChipId | null = null
): TBoardStep[] => {
  const at = board.locate(special.uid);

  if (!at || chain.detonated.has(special.uid)) {
    return [];
  }

  chain.detonated.add(special.uid);

  switch (special.id) {
    case 'laser':
      return blastLine(board, [special], special.uid, at, special.direction, chain);

    case 'bomb':
      return blastArea(board, [special], special.uid, at, BOMB_RADIUS, chain);

    case 'propeller':
      return blastPropeller(board, [special], special.uid, at, null, chain);

    case 'rainbow':
      return blastColor(
        board,
        [special],
        special.uid,
        at,
        partnerColor ?? board.mostCommonColor(),
        chain
      );
  }
};

/**
 * Комбинация двух спецфишек в клетке `at` (куда игрок довёл свою). Обе
 * уходят в комбинацию целиком и отдельно уже не срабатывают.
 */
export const combine = (
  board: BoardState,
  first: TSpecialPiece,
  second: TSpecialPiece,
  at: IBoardCellPos,
  chain: IChain
): TBoardStep[] => {
  const sources = [first, second];

  chain.detonated.add(first.uid);
  chain.detonated.add(second.uid);

  if (first.id === 'rainbow' && second.id === 'rainbow') {
    return blastBoard(board, sources, first.uid, at, chain);
  }

  if (first.id === 'rainbow' || second.id === 'rainbow') {
    const rainbow = first.id === 'rainbow' ? first : second;
    const other = rainbow === first ? second : first;

    return transformColor(board, rainbow, other, at, chain);
  }

  if (first.id === 'propeller' || second.id === 'propeller') {
    const propeller = first.id === 'propeller' ? first : second;
    const other = propeller === first ? second : first;

    return other.id === 'propeller'
      ? blastPropellers(board, sources, propeller.uid, at, chain)
      : blastPropeller(board, sources, propeller.uid, at, other, chain);
  }

  if (first.id === 'bomb' && second.id === 'bomb') {
    return blastArea(board, sources, first.uid, at, DOUBLE_BOMB_RADIUS, chain);
  }

  // Ракета+ракета - крест; ракета+бомба - по три строки и колонки.
  const width = first.id === 'laser' && second.id === 'laser' ? 1 : 3;

  return blastCross(board, sources, first.uid, at, width, chain);
};

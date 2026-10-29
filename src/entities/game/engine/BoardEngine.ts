import type { TRandom } from '@/shared/lib/random';
import { hasBoardMatch } from '../lib/boardMatches';
import type { THintSwapPair } from '../lib/findHintMove';
import type { TGameBoosterKind } from '../lib/minigameBoosters';
import { MINIGAME_RANDOM_ID, type TMinigameChipId } from '../lib/minigameLevelConfig';
import { resolveRandomCells } from '../lib/randomCells';
import { pickReshuffleLayout, planGuaranteedMoveLayout } from '../lib/reshuffleLayout';
import type { IMinigameLevelCell } from '../types';
import { resolveCascade, settleAndCascade } from './boardCascade';
import { direct, withSplash } from './boardDamage';
import { combine, createChain, detonate, strike } from './boardDetonation';
import { findBestMove, findHint, hasMove, listMoves } from './boardMoves';
import {
  createCellFromLevel,
  isChipPiece,
  isHolePiece,
  isSpecialPiece,
  type IBoardCellSeed,
  type IFloorPiece,
  type IOverlayPiece,
  type TBoardPiece,
  type TBoardPieceSeed,
  type TSpecialKind,
  type TSpecialPiece,
} from './boardPieces';
import { spreadSlime } from './boardSlime';
import { BoardState, type IBoardStateOptions } from './boardState';
import type {
  IBoardCellPos,
  IBoardSpecialPlacement,
  IBoardTransform,
  TBoardDeadEndOutcome,
  TBoardStep,
  TBoardSwapOutcome,
} from './boardSteps';

export type IBoardEngineOptions = IBoardStateOptions;

/** Сколько раскладок клеток «?» пробуем, пока на старте не найдётся ход. */
const RANDOM_LAYOUT_ATTEMPTS = 12;

/**
 * Сколько случайных перемешек пробуем, прежде чем строить ход руками. На
 * полной доске случайная перестановка почти всегда даёт ход с первого раза.
 */
const RESHUFFLE_ATTEMPTS = 20;

/**
 * Сколько оставшихся ходов финальный бонус превращает в ракеты на доске.
 * Остальные ходы идут в очки без ракет: двадцать выстрелов подряд - это уже
 * не кульминация, а ожидание.
 */
const MAX_FINALE_ROCKETS = 10;

const colorOf = (piece: TBoardPiece): TMinigameChipId | null =>
  isChipPiece(piece) ? piece.id : null;

/**
 * Движок доски Match-3: вся логика хода без движка отрисовки.
 *
 * Держит доску слоями (`grid[col][row]` - предметы, `overlays` - накладки,
 * `floors` - подложки; ось та же, что во всём коре), разыгрывает ход целиком
 * и синхронно - свап, каскад с фигурами и спецфишками, взрывы и комбинации,
 * урон по слоям, гравитацию с диагональным осыпанием, добор, сбор «опусти
 * вниз», бустеры, перемешку тупика - и возвращает протокол шагов
 * (`boardSteps`), который рантайм проигрывает анимацией. Пока шаги играют,
 * движок уже стоит в конце хода; рантайм на это время держит доску занятой и
 * ввод не пускает.
 *
 * Класс - фасад публичного API: ходы игрока, бустеры, тупик, финал и чтение
 * доски. Сами правила живут модулями над общим состоянием (`boardState`):
 * урон по слоям - `boardDamage`, спецфишки и комбинации - `boardDetonation`,
 * оседание и каскад - `boardCascade`, слизь - `boardSlime`, поиск и оценка
 * ходов - `boardMoves`.
 *
 * Случайность приходит снаружи (`random`): с тем же зерном и теми же ходами
 * партия повторяется до клетки, а тесты проверяют конкретные раскладки.
 *
 * Чего движок не знает: ходов игрока, целей и исхода партии (их ведёт
 * `GameStore` рантайма по шагам хода - `listGoalEvents`; приоритет целей
 * пропеллера приходит предикатом `isPriorityTarget`), анимаций и времени.
 */
export class BoardEngine {
  /** Число колонок (ось X). */
  readonly cols: number;
  /** Число строк (ось Y). */
  readonly rows: number;

  private readonly board: BoardState;

  /**
   * Доска из готовых клеток: `cells[col][row]`. Паспорта выдаёт движок.
   * Нужна, когда доска собирается не из уровня - реплей, тест, бот.
   */
  constructor(cells: readonly (readonly IBoardCellSeed[])[], options: IBoardEngineOptions) {
    this.board = new BoardState(cells, options);
    this.cols = this.board.cols;
    this.rows = this.board.rows;
  }

  /**
   * Доска уровня (`IMinigameLevelConfig.grid`). Бросает на неизвестной клетке.
   *
   * Клетки «?» получают цвет от зерна партии (`resolveRandomCells`); раскладка
   * без хода или с готовой фигурой перебрасывается - на старте партии ход
   * обязан быть, как и у уровня без «?» (это проверяет тест каталога), а
   * стоячую фигуру рантайм не разбирает. Готовая фигура почти не случается
   * на трёх цветах и больше, но на двух (`MIN_LEVEL_COLORS`)
   * `resolveRandomCells` часто не находит безопасного цвета. Ни одна попытка не чистая - берётся первая
   * раскладка с ходом: фигура на старте лучше доски без хода.
   */
  static fromLevel(
    cells: readonly (readonly IMinigameLevelCell[])[],
    options: IBoardEngineOptions
  ): BoardEngine {
    const build = () =>
      new BoardEngine(
        resolveRandomCells(cells, options.colors, options.random).map((column) =>
          column.map(createCellFromLevel)
        ),
        options
      );
    const hasRandomCells = cells.some((column) =>
      column.some((cell) => cell.id === MINIGAME_RANDOM_ID)
    );
    const isClean = (candidate: BoardEngine) =>
      candidate.hasMove() && !hasBoardMatch(candidate.board.matchView(), isChipPiece);
    let engine = build();
    let firstWithMove = engine.hasMove() ? engine : null;

    for (
      let attempt = 1;
      hasRandomCells && attempt < RANDOM_LAYOUT_ATTEMPTS && !isClean(engine);
      attempt++
    ) {
      engine = build();
      firstWithMove ??= engine.hasMove() ? engine : null;
    }

    if (!isClean(engine) && firstWithMove) {
      return firstWithMove;
    }

    return engine;
  }

  // ---------------------------------------------------------------- чтение

  /**
   * Предмет клетки - только для чтения: это живой объект грида, и правка его
   * `hp` снаружи молча развела бы движок со спрайтами рантайма. Шаги движок
   * отдаёт копиями по той же причине.
   */
  pieceAt(pos: IBoardCellPos): Readonly<TBoardPiece> | null {
    return this.board.cellAt(pos);
  }

  overlayAt(pos: IBoardCellPos): Readonly<IOverlayPiece> | null {
    return this.board.overlayAt(pos);
  }

  floorAt(pos: IBoardCellPos): Readonly<IFloorPiece> | null {
    return this.board.floorAt(pos);
  }

  /** Клетка предмета по паспорту; `null` - предмета на доске больше нет. */
  locate(uid: number): IBoardCellPos | null {
    return this.board.locate(uid);
  }

  /**
   * Есть ли на доске ход фишками. Спецфишки ходом не считаются: они
   * срабатывают тапом в любой момент, и тупик подсвечивает их отдельно.
   */
  hasMove(): boolean {
    return hasMove(this.board);
  }

  /** Ход для подсказки простоя - от центра поля наружу. */
  findHint(): THintSwapPair | null {
    return findHint(this.board);
  }

  /** Все ходы свапом, которые движок примет (`boardMoves.listMoves`). */
  listMoves(): THintSwapPair[] {
    return listMoves(this.board);
  }

  /** Лучший ход для подсказки простоя (`boardMoves.findBestMove`). */
  findBestMove(): THintSwapPair | null {
    return findBestMove(this.board);
  }

  /** Можно ли сдвинуть клетку свапом: подвижный предмет без накладки. */
  canSwapAt(pos: IBoardCellPos): boolean {
    return this.board.isInside(pos) && this.board.isSwappableAt(pos);
  }

  /** Клетки спецфишек: каждую можно взорвать тапом. */
  listSpecials(): IBoardCellPos[] {
    return this.board.positionsOf(this.board.collectPieces(isSpecialPiece));
  }

  /**
   * Независимая копия доски со своим источником случайности: бот и подсказка
   * примеряют на ней ход, не трогая партию. Паспорта у копии свои - сверять
   * её шаги с оригиналом можно по клеткам и кодам, а не по `uid`.
   */
  clone(random: TRandom): BoardEngine {
    const { board } = this;
    const strip = <T extends { uid: number }>(layer: T | null): Omit<T, 'uid'> | null => {
      if (!layer) {
        return null;
      }

      const { uid: _uid, ...seed } = layer;

      return seed;
    };

    return new BoardEngine(
      board.grid.map((column, col) =>
        column.map((piece, row) => ({
          piece: strip(piece) as TBoardPieceSeed | null,
          overlay: strip(board.overlays[col][row]),
          floor: strip(board.floors[col][row]),
        }))
      ),
      { colors: board.colors, random, isPriorityTarget: board.isPriorityTarget ?? undefined }
    );
  }

  // ------------------------------------------------------------ ходы игрока

  /**
   * Свап соседних клеток от игрока.
   *
   * Свап со спецфишкой - всегда ход: пара меняется клетками, и спецфишка
   * срабатывает из новой (радуга - по цвету партнёра). Две спецфишки дают
   * комбинацию в клетке, куда игрок довёл свою. Клетка под накладкой, блокер
   * и дыра не свапаются вовсе. Принятый ход, не снявший ни клетки слизи,
   * заканчивается её расползанием (`spreadSlime`).
   */
  trySwap(from: IBoardCellPos, to: IBoardCellPos): TBoardSwapOutcome {
    const { board } = this;
    const distance = Math.abs(from.col - to.col) + Math.abs(from.row - to.row);
    const first = board.cellAt(from);
    const second = board.cellAt(to);

    if (
      distance !== 1 ||
      !first ||
      !second ||
      !board.isSwappableAt(from) ||
      !board.isSwappableAt(to)
    ) {
      return { kind: 'blocked' };
    }

    const swap: TBoardStep = { type: 'swap', first: first.uid, second: second.uid };

    if (isSpecialPiece(first) || isSpecialPiece(second)) {
      board.swapCells(from, to);

      const chain = createChain();
      const steps: TBoardStep[] = [swap];

      if (isSpecialPiece(first) && isSpecialPiece(second)) {
        steps.push(...combine(board, first, second, to, chain));
      } else if (isSpecialPiece(first)) {
        steps.push(...detonate(board, first, chain, colorOf(second)));
      } else if (isSpecialPiece(second)) {
        steps.push(...detonate(board, second, chain, colorOf(first)));
      }

      steps.push(...settleAndCascade(board, [to, from]));

      return { kind: 'accepted', steps: [...steps, ...spreadSlime(board, steps)] };
    }

    // Валидность решается до анимации: обмен синхронный, правило поиска фигур
    // чистое, и отказ можно сыграть коротким, не изображая сначала принятый ход.
    board.swapCells(from, to);

    if (!hasBoardMatch(board.matchView(), isChipPiece)) {
      board.swapCells(from, to);

      return { kind: 'rejected' };
    }

    const steps = [swap, ...resolveCascade(board, [to, from], new Set())];

    return { kind: 'accepted', steps: [...steps, ...spreadSlime(board, steps)] };
  }

  /**
   * Активация спецфишки тапом или кликом по подсветке тупика. Это ход, как и
   * в Royal Match: рантайм списывает за него ход, а слизь, которую он не
   * задел, после него расползается.
   */
  activateSpecialAt(pos: IBoardCellPos): TBoardStep[] | null {
    const { board } = this;
    const piece = board.cellAt(pos);

    if (!piece || !isSpecialPiece(piece)) {
      return null;
    }

    const steps = [...detonate(board, piece, createChain(), null), ...settleAndCascade(board, [])];

    return [...steps, ...spreadSlime(board, steps)];
  }

  /**
   * Применим ли бустер к клетке. Рантайм спрашивает до списания заряда:
   * неприменимый бустер заряд не тратит.
   */
  canApplyBooster(kind: TGameBoosterKind, pos: IBoardCellPos): boolean {
    return this.isBoosterTarget(kind, pos);
  }

  /**
   * Бустер по клетке. `null` - бустер к этой клетке неприменим
   * (`canApplyBooster`): доска не тронута. Урон бустера - тот же, что у
   * спецфишек: задетая им спецфишка взрывается, а не гаснет.
   */
  applyBooster(kind: TGameBoosterKind, pos: IBoardCellPos): TBoardStep[] | null {
    if (!this.isBoosterTarget(kind, pos)) {
      return null;
    }

    const { board } = this;
    const chain = createChain();
    const steps: TBoardStep[] = [];
    const target = board.cellAt(pos);

    switch (kind) {
      // Луч: один прямой удар по выбранной клетке, соседей не задевает.
      case 'beam':
        steps.push({ type: 'beam', uid: board.topUidAt(pos) });
        steps.push(...strike(board, [direct(pos)], [], chain));
        break;

      // Лазер: все фишки цвета выбранной (`isBoosterTarget` пропускает к нему
      // только фишку).
      case 'laser': {
        const color = target && isChipPiece(target) ? target.id : null;
        const chips = board.collectPieces((piece) => isChipPiece(piece) && piece.id === color);

        steps.push({ type: 'colorSweep', uids: chips.map((piece) => piece.uid) });
        steps.push(...strike(board, withSplash(board, board.positionsOf(chips)), [], chain));
        break;
      }

      // Шар: три строки вокруг выбранной клетки, у края поля - две.
      case 'ball': {
        const rows = [pos.row - 1, pos.row, pos.row + 1].filter(
          (row) => row >= 0 && row < board.rows
        );
        const cells = rows.flatMap((row) => board.rowCells(row));

        steps.push({ type: 'rowsBlast', row: pos.row, rows });
        steps.push(...strike(board, withSplash(board, cells), [], chain));
        break;
      }
    }

    return [...steps, ...settleAndCascade(board, [])];
  }

  /**
   * Разбор тупика после хода: ход есть - ничего; ходов фишками нет, но лежит
   * спецфишка - подсветить её; иначе бесплатная перемешка свободных фишек (и
   * каскад, если перемешка собрала фигуру). Фишки под накладками, блокеры и
   * «опусти вниз» стоят на месте. Перемешка предпочитает раскладку без
   * готовой фигуры, иначе доска взрывалась бы каскадом, которого игрок не
   * просил.
   */
  resolveDeadEnd(): TBoardDeadEndOutcome {
    const { board } = this;

    if (hasMove(board)) {
      return { kind: 'hasMove' };
    }

    const special = board.collectPieces(isSpecialPiece)[0];

    if (special) {
      return { kind: 'specialHint', uid: special.uid };
    }

    const slots = board.collectChipSlots();

    if (slots.length === 0) {
      return { kind: 'stuck' };
    }

    const chips = slots.map((slot) => slot.piece);
    const cells = slots.map((slot) => slot.cell);

    const layout =
      pickReshuffleLayout(
        chips.length,
        RESHUFFLE_ATTEMPTS,
        (candidate) => {
          board.applyChipLayout(chips, cells, candidate);

          return {
            hasMove: hasMove(board),
            hasReadyMatch: hasBoardMatch(board.matchView(), isChipPiece),
          };
        },
        board.random
      ) ??
      planGuaranteedMoveLayout(
        chips.map((piece) => ({ color: piece.id })),
        cells
      );

    if (!layout) {
      // Хода нет ни в одной перестановке: доска остаётся какой была, партия
      // проиграна честно, а не зависает без ходов.
      board.applyChipLayout(
        chips,
        cells,
        chips.map((_, index) => index)
      );

      return { kind: 'stuck' };
    }

    board.applyChipLayout(chips, cells, layout);

    const steps: TBoardStep[] = [
      {
        type: 'shuffle',
        placements: chips.map((piece, index) => ({
          uid: piece.uid,
          col: cells[layout[index]].x,
          row: cells[layout[index]].y,
        })),
      },
    ];

    // Каскад после перемешки начинается не со свапа: клетки игрока у него
    // нет, и награда за фигуру встаёт по общему правилу (`planSpecial`).
    steps.push(...resolveCascade(board, [], new Set()));

    return { kind: 'shuffled', steps };
  }

  /**
   * Финальный бонус победы («Sugar Crush» Candy Crush, ракеты Royal Match):
   * оставшиеся ходы превращают случайные свободные фишки в ракеты, и те
   * стреляют одним залпом; затем по очереди срабатывают спецфишки, оставшиеся
   * на доске. Цели к этому моменту уже закрыты - бонус даёт только очки и
   * зрелище, поэтому `random` здесь тот же, что у партии: реплей с тем же
   * зерном повторяет и финал.
   */
  playFinale(movesLeft: number): TBoardStep[] {
    const { board } = this;
    const steps: TBoardStep[] = [];

    if (movesLeft > 0) {
      steps.push({ type: 'bonus', moves: movesLeft });

      const chips = board.shuffledFreeChips().slice(0, Math.min(movesLeft, MAX_FINALE_ROCKETS));
      const positions = board.positionsByUid();
      const changes: IBoardTransform[] = [];
      const rockets: TSpecialPiece[] = [];

      for (const chip of chips) {
        const pos = positions.get(chip.uid);

        if (!pos) {
          continue;
        }

        const rocket = board.createSpecial('laser', board.randomDirection());

        board.grid[pos.col][pos.row] = rocket;
        changes.push({ uid: chip.uid, id: chip.id, placement: { ...pos, piece: { ...rocket } } });
        rockets.push(rocket);
      }

      if (changes.length > 0) {
        const chain = createChain();

        steps.push({ type: 'transform', changes });

        for (const rocket of rockets) {
          steps.push(...detonate(board, rocket, chain));
        }

        steps.push(...settleAndCascade(board, []));
      }
    }

    // Предохранитель: каждый проход снимает хотя бы одну спецфишку, а новые
    // рождаются только каскадом - их конечное число.
    for (let pass = 0; pass < board.cols * board.rows; pass++) {
      const special = board.collectPieces(isSpecialPiece)[0];

      if (!special) {
        break;
      }

      steps.push(...detonate(board, special, createChain()), ...settleAndCascade(board, []));
    }

    return steps;
  }

  /**
   * Предуровневые бустеры: спецфишки встают на случайные свободные фишки
   * стартовой доски (от зерна партии). Ставятся до первого хода и ничего не
   * взрывают - игрок сам решает, когда их тратить.
   */
  placeStartSpecials(kinds: readonly TSpecialKind[]): TBoardStep[] {
    const { board } = this;
    const chips = board.shuffledFreeChips().slice(0, kinds.length);

    if (chips.length === 0) {
      return [];
    }

    const positions = board.positionsByUid();
    const placements: IBoardSpecialPlacement[] = [];

    chips.forEach((chip, index) => {
      const pos = positions.get(chip.uid);

      if (!pos) {
        return;
      }

      const special = board.createSpecial(kinds[index], board.randomDirection());

      board.grid[pos.col][pos.row] = special;
      placements.push({ ...pos, piece: { ...special } });
    });

    return [{ type: 'preBoost', replaced: chips.map((chip) => chip.uid), placements }];
  }

  /**
   * Цель бустера: дыра - не цель ни для одного; луч бьёт клетку, где есть хоть
   * один слой; «лазер» - только по фишке (берёт её цвет).
   */
  private isBoosterTarget(kind: TGameBoosterKind, pos: IBoardCellPos): boolean {
    const { board } = this;
    const piece = board.cellAt(pos);

    if (!board.isInside(pos) || (piece && isHolePiece(piece))) {
      return false;
    }

    switch (kind) {
      case 'laser':
        return piece !== null && isChipPiece(piece);
      case 'beam':
        return board.layerIdsAt(pos).length > 0;
      case 'ball':
        return true;
    }
  }
}

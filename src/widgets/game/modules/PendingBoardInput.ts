import {
  canReplayPendingInput,
  canReplayPendingSwap,
  type IPendingCell,
  type IPendingInputGate,
} from '../lib/pendingBoardInput';
import type { BoardEntity } from './cells/BoardEntity';
import type { SpecialEntity } from './cells/SpecialEntity';

interface IPendingSwap {
  entity: BoardEntity;
  /** Клетка, с которой жест был сделан: доигрывается только с неё же. */
  origin: IPendingCell;
  dCol: number;
  dRow: number;
}

interface IPendingBoardInputOptions {
  /** Состояние партии для гейтов отложенного ввода (`lib/pendingBoardInput`). */
  resolveGate: (entity: BoardEntity) => IPendingInputGate;
  /** Доиграть тап спецфишки, как будто он только что пришёл. */
  replaySpecial: (special: SpecialEntity) => void;
  /** Доиграть свайп, как будто он только что пришёл от `BoardEntity`. */
  replaySwap: (row: number, col: number, targetRow: number, targetCol: number) => void;
  /**
   * Буфер наполнился или опустел. Владелец ускоряет темп доски, пока в нём
   * ждёт ход игрока, и возвращает обычный, как только ход ушёл на доску.
   */
  onPendingChange: (hasPending: boolean) => void;
}

/**
 * Ввод, сделанный во время чужого каскада: тап спецфишки и свайп.
 *
 * Стандарт жанра: доска сыпется, а игрок уже планирует следующий ход - молча
 * терять его значит рвать темп. Буфер глубиной в один ввод каждого вида,
 * последний побеждает: более ранний уже не отражает то, что игрок хочет
 * сейчас. Держим ссылку на сущность, а не её клетку: доска может ещё
 * осыпаться, и клетка спецфишки - переехать. Свайп же доигрывается, только
 * если фишка осталась там, откуда игрок её вёл (`canReplayPendingSwap`): ход
 * «от новой клетки» был бы ходом в месте, которого игрок не выбирал.
 *
 * Когда доигрывать, решает владелец (`GameLogic`, на освобождении доски);
 * здесь - только хранение, гейты и порядок флаша.
 */
export class PendingBoardInput {
  private readonly options: IPendingBoardInputOptions;
  private special: SpecialEntity | null = null;
  private swap: IPendingSwap | null = null;

  constructor(options: IPendingBoardInputOptions) {
    this.options = options;
  }

  get hasPending(): boolean {
    return this.special !== null || this.swap !== null;
  }

  bufferSpecial(special: SpecialEntity): void {
    this.special = special;
    this.options.onPendingChange(this.hasPending);
  }

  bufferSwap(entity: BoardEntity, origin: IPendingCell, dCol: number, dRow: number): void {
    this.swap = { entity, origin, dCol, dRow };
    this.options.onPendingChange(this.hasPending);
  }

  /**
   * Доска освободилась: сначала отложенный тап спецфишки, затем свайп. Тап
   * синхронно занимает доску заново, и свайп за ним снова ляжет в буфер -
   * дождётся конца этого каскада.
   */
  flush(): void {
    this.flushSpecial();
    this.flushSwap();
  }

  /** Партия кончилась: буфер забывается без доигрывания и без смены темпа. */
  clear(): void {
    this.special = null;
    this.swap = null;
  }

  /**
   * Гейт «спецфишка всё ещё в своей клетке» - не формальность: пока запрос
   * ждал очереди, её вполне мог задеть чужой взрыв (и она отработала в его
   * цепочке) или она упала на новую строку.
   */
  private flushSpecial(): void {
    const special = this.special;

    this.special = null;
    this.options.onPendingChange(this.hasPending);

    if (!special || !canReplayPendingInput(this.options.resolveGate(special))) {
      return;
    }

    this.options.replaySpecial(special);
  }

  /**
   * Валидность целевой клетки проверяет уже сам повторный свайп владельца, как
   * будто он только что пришёл от `BoardEntity`.
   */
  private flushSwap(): void {
    const pending = this.swap;

    this.swap = null;
    this.options.onPendingChange(this.hasPending);

    if (!pending) {
      return;
    }

    const { entity, origin, dCol, dRow } = pending;

    if (
      !canReplayPendingSwap(this.options.resolveGate(entity), origin, {
        col: entity.x,
        row: entity.y,
      })
    ) {
      return;
    }

    this.options.replaySwap(entity.y, entity.x, entity.y + dRow, entity.x + dCol);
  }
}

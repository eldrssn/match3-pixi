import type { ISwapDragMove, RuntimeEvents } from '../core/RuntimeEvents';
import { resolveSwapDragOffset } from '../lib/swapDragOffset';
import type { BoardEntity } from './cells/BoardEntity';

/**
 * Слежение пары за пальцем.
 *
 * Клетка двигает себя сама, но вторую половину пары двигать может только тот,
 * кто знает грид: докуда вообще можно уехать, зависит от соседа. Это
 * отдельный модуль, а не методы `GameLogic`, который и без того держит ввод,
 * каскад и бустеры: свои подписки, своя память о партнёре и ничего больше;
 * геометрия - чистое правило `lib/swapDragOffset`.
 *
 * Владелец отдаёт доступ к гриду колбэком (`getCell`) и обязан звать
 * `releasePartner()` на путях, где ход отклонён без анимации: сам контроллер о
 * судьбе `swapRequest` не знает.
 */
export class SwapDragController {
  private readonly getCell: (col: number, row: number) => BoardEntity | null | undefined;
  private readonly unsubscribers: (() => void)[];

  /**
   * Вторая половина пары, которую сейчас уводит смещение за пальцем.
   *
   * Ссылка нужна ради возврата: палец мог пересечь ось и сменить соседа, а
   * прежний обязан вернуться на место - сам он о своём сдвиге не знает, потому
   * что двигает его не он.
   */
  private partner: BoardEntity | null = null;

  constructor(
    events: RuntimeEvents,
    getCell: (col: number, row: number) => BoardEntity | null | undefined
  ) {
    this.getCell = getCell;
    this.unsubscribers = [
      events.on('swapDragMove', this.handleMove),
      events.on('swapDragEnd', this.handleEnd),
      events.on('swapDragHandOff', this.handleHandOff),
    ];
  }

  /**
   * Ведёт **обе** половины пары за пальцем.
   *
   * Сосед, который меняться местами умеет, уезжает навстречу, и пара
   * обменивается прямо под пальцем - на отпускании доигрывать уже почти
   * нечего. Если соседа нет вовсе (край доски) или он не свапается (блокер,
   * дыра), ход укорочен - см. `resolveSwapDragOffset`.
   */
  private handleMove = ({ row, col, dCol, dRow, offset }: ISwapDragMove): void => {
    const dragged = this.getCell(col, row);

    if (!dragged) {
      return;
    }

    const neighbor = this.getCell(col + dCol, row + dRow);
    const partner = neighbor && neighbor.canSwap() && neighbor.image ? neighbor : null;

    if (this.partner && this.partner !== partner) {
      this.releasePartner(false);
    }

    const offsets = resolveSwapDragOffset({
      offset,
      dCol,
      dRow,
      hasSwappablePartner: partner !== null,
    });

    dragged.setDragOffset(offsets.dragged.x, offsets.dragged.y);

    if (!partner) {
      return;
    }

    partner.setDragOffset(offsets.partner.x, offsets.partner.y);
    this.partner = partner;
  };

  private handleEnd = (animated: boolean): void => {
    this.releasePartner(animated);
  };

  /**
   * Жест перешёл в ход: сосед остаётся там, куда его довёл палец, и дальше его
   * ведёт анимация свапа. Смещение при этом надо именно забыть - иначе
   * следующий сброс вычел бы уже отработавшую дельту посреди анимации.
   */
  private handleHandOff = (): void => {
    const partner = this.partner;
    this.partner = null;

    partner?.forgetDragOffset();
  };

  /**
   * Жест кончился без хода - сосед возвращается в свою клетку. `animated`
   * различает плавный возврат (палец не дотянул до порога, ход отклонён) и
   * мгновенный (клетку снесло под пальцем).
   *
   * Публичный: владелец обязан звать это и после `swapDragHandOff`, если ход
   * так и не состоялся - буферизация под каскадом, край доски, блокер. К тому
   * моменту эстафета уже передана анимации свапа, которой не будет.
   */
  public releasePartner(animated: boolean): void {
    const partner = this.partner;
    this.partner = null;

    if (!partner) {
      return;
    }

    if (animated) {
      void partner.returnHome();

      return;
    }

    partner.setDragOffset(0, 0);
  }

  public destroy(): void {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.partner = null;
  }
}

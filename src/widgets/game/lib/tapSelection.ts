/**
 * Ход двумя тапами (tap-tap): первый тап выбирает фишку, второй по соседней -
 * меняет их местами. Альтернатива свайпу для тех, кому неудобно тянуть фишку
 * пальцем, и единственный удобный ход мышью. Чистое правило: что сделать с
 * тапом по клетке при текущем выборе; спрайты и подсветку ведёт `GameLogic`.
 */

export interface ITapCell {
  col: number;
  row: number;
}

export interface ITappedCell extends ITapCell {
  /** Спецфишка: одиночный тап по ней - взрыв (если не второй тап хода). */
  isSpecial: boolean;
  /** Клетку можно сдвинуть свапом (подвижный предмет без накладки). */
  canSwap: boolean;
}

export type TTapAction =
  /** Выбрать тапнутую клетку (или перевыбрать, если выбрана другая). */
  | 'select'
  /** Снять выбор. */
  | 'clear'
  /** Поменять выбранную клетку с тапнутой. */
  | 'swap'
  /** Взорвать тапнутую спецфишку (выбор снимается). */
  | 'activate'
  /** Ничего: тап по блокеру без выбора. */
  | 'none';

const isNeighbor = (a: ITapCell, b: ITapCell): boolean =>
  Math.abs(a.col - b.col) + Math.abs(a.row - b.row) === 1;

/**
 * Решение по тапу:
 *
 * - тап по выбранной клетке снимает выбор;
 * - второй тап по соседу, которого можно сдвинуть, - ход (в том числе свап
 *   фишки со спецфишкой и комбинация двух спецфишек);
 * - тап по спецфишке в остальных случаях - её взрыв, как и без выбора;
 * - тап по подвижной фишке - выбор (перевыбор);
 * - тап по блокеру просто снимает выбор.
 */
export const resolveTapAction = (selected: ITapCell | null, tapped: ITappedCell): TTapAction => {
  if (selected && selected.col === tapped.col && selected.row === tapped.row) {
    return 'clear';
  }

  if (selected && tapped.canSwap && isNeighbor(selected, tapped)) {
    return 'swap';
  }

  if (tapped.isSpecial) {
    return 'activate';
  }

  if (tapped.canSwap) {
    return 'select';
  }

  return selected ? 'clear' : 'none';
};

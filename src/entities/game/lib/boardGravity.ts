/**
 * Чистое правило гравитации по всему полю: куда съедут фишки и где встанут
 * новые, когда под ними освободилось место.
 *
 * Клетка поля для правила - один из трёх видов (`TGravitySlot`):
 *
 * - `open` - обычная клетка: в ней лежит подвижная фишка или пусто;
 * - `hole` - дыры нет вовсе: фишка пролетает её насквозь, но не встаёт;
 * - `fixed` - клетка занята навсегда (ящик, камень, фишка под накладкой):
 *   сквозь неё не падают.
 *
 * Падение идёт тактами: за такт каждая фишка сдвигается не больше чем на одну
 * клетку (дыры пролетает целиком). Сначала прямо вниз; если снизу занято или
 * стоит неподвижное, фишка соскальзывает по диагонали - но только в клетку,
 * куда сверху ничего не придёт (над ней неподвижная клетка). Иначе фишки
 * съезжали бы вбок там, где колонка и так через такт добралась бы сама.
 * Новые фишки встают в верхнюю открытую клетку колонки, если над ней нет
 * неподвижного.
 *
 * Добор на месте. Когда падать больше некому, пустая открытая клетка - та,
 * куда не придёт ничего ни сверху, ни по диагонали: верхняя клетка под
 * серединой ряда неподвижных шириной от трёх, замкнутый карман. Новая фишка
 * появляется прямо в ней (`inPlace`). Без этого клетка стояла бы пустой до
 * первого разбитого над ней блокера, и поле «высыхало».
 *
 * Ось - та же, что во всём коре: `grid[col][row]`, строка 0 - верх.
 */

export type TGravitySlot = 'open' | 'hole' | 'fixed';

export interface IGravityPos {
  col: number;
  row: number;
}

export interface IGravityMove<TCell> {
  cell: TCell;
  /**
   * Откуда фишка тронулась; `row: -1` - новая фишка, въехавшая сверху. У
   * появившейся на месте (`inPlace`) - её же клетка.
   */
  from: IGravityPos;
  /** Клетки пути по порядку - по одной за такт; последняя - где встала. */
  path: IGravityPos[];
  /** Новая фишка появилась прямо в клетке, куда ничто не падает. */
  inPlace?: true;
}

export interface IGravityPlan<TCell> {
  /** Поле после падения: те же клетки `open`, заполненные фишками. */
  grid: (TCell | null)[][];
  /** Все сдвиги и появления, в порядке, в котором фишки трогались. */
  moves: IGravityMove<TCell>[];
}

/** Слева направо - порядок диагоналей; выбор детерминирован, как и всё правило. */
const DIAGONALS = [-1, 1] as const;

export const planBoardGravity = <TCell>(
  source: readonly (readonly (TCell | null)[])[],
  slotAt: (col: number, row: number) => TGravitySlot,
  spawn: (col: number) => TCell
): IGravityPlan<TCell> => {
  const cols = source.length;
  const rows = source[0]?.length ?? 0;
  const grid = source.map((column) => [...column]);
  const moves = new Map<TCell, IGravityMove<TCell>>();

  const isOpen = (col: number, row: number): boolean =>
    col >= 0 && col < cols && row >= 0 && row < rows && slotAt(col, row) === 'open';

  /** Ближайшая открытая клетка ниже, сквозь дыры; неподвижная или край - `null`. */
  const openBelow = (col: number, row: number): number | null => {
    let next = row + 1;

    while (next < rows && slotAt(col, next) === 'hole') {
      next++;
    }

    return next < rows && slotAt(col, next) === 'open' ? next : null;
  };

  /** Верхняя открытая клетка колонки (сквозь дыры) - туда встаёт новая фишка. */
  const spawnRow = (col: number): number | null => {
    let row = 0;

    while (row < rows && slotAt(col, row) === 'hole') {
      row++;
    }

    return row < rows && slotAt(col, row) === 'open' ? row : null;
  };

  /**
   * Придёт ли в клетку что-то сверху: идём вверх сквозь дыры и пустые клетки;
   * фишка или верх поля (там появляются новые) - придёт, неподвижная - нет.
   */
  const hasSourceAbove = (col: number, row: number): boolean => {
    for (let above = row - 1; above >= 0; above--) {
      const slot = slotAt(col, above);

      if (slot === 'fixed') {
        return false;
      }

      if (slot === 'open' && grid[col][above] !== null) {
        return true;
      }
    }

    return true;
  };

  const record = (cell: TCell, from: IGravityPos, to: IGravityPos): void => {
    const move = moves.get(cell) ?? { cell, from, path: [] };

    move.path.push(to);
    moves.set(cell, move);
  };

  const step = (): boolean => {
    const movedThisTick = new Set<TCell>();
    let moved = false;

    // Снизу вверх: нижняя фишка освобождает место раньше, чем до неё дойдёт
    // верхняя, и колонка оседает целиком за один такт на клетку.
    for (let row = rows - 2; row >= 0; row--) {
      for (let col = 0; col < cols; col++) {
        const cell = grid[col][row];

        if (cell === null || !isOpen(col, row) || movedThisTick.has(cell)) {
          continue;
        }

        const below = openBelow(col, row);
        let target: IGravityPos | null = null;

        if (below !== null && grid[col][below] === null) {
          target = { col, row: below };
        } else {
          const side = DIAGONALS.map((dCol) => ({ col: col + dCol, row: row + 1 })).find(
            (pos) =>
              isOpen(pos.col, pos.row) &&
              grid[pos.col][pos.row] === null &&
              !hasSourceAbove(pos.col, pos.row)
          );

          target = side ?? null;
        }

        if (target) {
          grid[col][row] = null;
          grid[target.col][target.row] = cell;
          record(cell, { col, row }, target);
          movedThisTick.add(cell);
          moved = true;
        }
      }
    }

    for (let col = 0; col < cols; col++) {
      const row = spawnRow(col);

      if (row !== null && grid[col][row] === null) {
        const cell = spawn(col);

        grid[col][row] = cell;
        record(cell, { col, row: -1 }, { col, row });
        moved = true;
      }
    }

    return moved;
  };

  // Предохранитель: каждый такт кто-то сдвигается вниз или появляется, и
  // клеток конечное число - больше этого тактов не бывает.
  const maxTicks = (rows + 1) * (cols + 1) * 2;

  for (let tick = 0; tick < maxTicks && step(); tick++) {
    // Падение идёт, пока кто-то двигается.
  }

  // Поле устоялось: пустая открытая клетка недостижима (иначе в неё упали бы
  // на прошлом такте) - добор на месте. Появление ничего не сдвигает, и поле
  // остаётся устойчивым.
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      if (isOpen(col, row) && grid[col][row] === null) {
        const cell = spawn(col);
        const pos = { col, row };

        grid[col][row] = cell;
        moves.set(cell, { cell, from: pos, path: [{ ...pos }], inPlace: true });
      }
    }
  }

  return { grid, moves: [...moves.values()] };
};

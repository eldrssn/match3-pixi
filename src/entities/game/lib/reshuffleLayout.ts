/**
 * Чистые правила перемешивания доски.
 *
 * Раскладка описывается перестановкой «фишка -> клетка» (`assignment[chipIndex]
 * = cellIndex`) над двумя списками одинаковой длины, поэтому фишка не может
 * потеряться - в отличие от раскладки сканом грида «в клетку, которая
 * выглядит свободной», где не поместившиеся фишки выпадали бы из грида,
 * оставаясь живыми спрайтами на экране.
 *
 * Координаты - те же, что у грида доски (`engine/BoardEngine`): `x` - первый
 * индекс (он же столбец на экране), `y` - второй.
 */

export interface IReshuffleCell {
  x: number;
  y: number;
}

export interface IReshuffleChip {
  color: string;
}

/** Сколько фишек одного цвета нужно, чтобы построить гарантированный ход. */
const CHIPS_PER_GUARANTEED_MOVE = 3;

const toCellKey = (x: number, y: number): string => `${x},${y}`;

/**
 * Случайная перестановка «фишка -> клетка» (Fisher-Yates).
 *
 * `random` параметром, а не `Math.random` внутри: правило должно быть
 * воспроизводимым в тестах.
 */
export const planShuffledLayout = (count: number, random: () => number = Math.random): number[] => {
  const assignment = Array.from({ length: count }, (_, index) => index);

  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [assignment[i], assignment[j]] = [assignment[j], assignment[i]];
  }

  return assignment;
};

/**
 * Клетки под гарантированный ход: три в линию по `x` плюс «крючок» сбоку от
 * дальней из них.
 *
 * Раскладка `A A ?` + `A` под (или над) третьей клеткой даёт ход всегда: свап
 * «крючка» с третьей клеткой достраивает `A A A`.
 */
interface IMoveAnchor {
  /** Две клетки под цвет `A`. */
  line: [number, number];
  /** Третья клетка линии - под любой другой цвет. */
  gap: number;
  /** Клетка над/под `gap` - под цвет `A`. */
  hook: number;
}

const findMoveAnchor = (cells: readonly IReshuffleCell[]): IMoveAnchor | null => {
  const cellIndexByKey = new Map<string, number>();

  cells.forEach((cell, index) => {
    cellIndexByKey.set(toCellKey(cell.x, cell.y), index);
  });

  for (const cell of cells) {
    const first = cellIndexByKey.get(toCellKey(cell.x, cell.y));
    const second = cellIndexByKey.get(toCellKey(cell.x + 1, cell.y));
    const gap = cellIndexByKey.get(toCellKey(cell.x + 2, cell.y));

    if (first === undefined || second === undefined || gap === undefined) {
      continue;
    }

    for (const dy of [-1, 1]) {
      const hook = cellIndexByKey.get(toCellKey(cell.x + 2, cell.y + dy));

      if (hook !== undefined) {
        return { line: [first, second], gap, hook };
      }
    }
  }

  return null;
};

const groupChipIndicesByColor = (chips: readonly IReshuffleChip[]): Map<string, number[]> => {
  const byColor = new Map<string, number[]>();

  chips.forEach((chip, index) => {
    const bucket = byColor.get(chip.color);

    if (bucket) {
      bucket.push(index);
      return;
    }

    byColor.set(chip.color, [index]);
  });

  return byColor;
};

/**
 * Детерминированная раскладка, в которой ход существует гарантированно.
 *
 * Нужна как выход из вероятностного цикла перемешиваний: сдайся он молча после
 * нескольких попыток, игрок остался бы на доске без ходов - ни победы, ни
 * поражения, ходы не тратятся.
 *
 * `null` - если такой раскладки не существует в принципе: нет места под
 * паттерн (изрезанная блокерами доска) или ни одного цвета в трёх экземплярах.
 * Тогда решение принимает вызывающий: на такой доске ходов действительно нет.
 */
export const planGuaranteedMoveLayout = (
  chips: readonly IReshuffleChip[],
  cells: readonly IReshuffleCell[]
): number[] | null => {
  if (chips.length !== cells.length || chips.length === 0) {
    return null;
  }

  const anchor = findMoveAnchor(cells);

  if (!anchor) {
    return null;
  }

  const byColor = groupChipIndicesByColor(chips);
  const lineColorEntry = [...byColor.entries()].find(
    ([, indices]) => indices.length >= CHIPS_PER_GUARANTEED_MOVE
  );

  if (!lineColorEntry) {
    return null;
  }

  const [lineColor, lineChipIndices] = lineColorEntry;

  // В `gap` нужен любой другой цвет. Если доска одноцветная, ход и так есть
  // (три подряд уже лежат), поэтому туда идёт четвёртая фишка того же цвета.
  const otherColorChipIndex = chips.findIndex((chip) => chip.color !== lineColor);
  const gapChipIndex =
    otherColorChipIndex === -1
      ? (lineChipIndices[CHIPS_PER_GUARANTEED_MOVE] ?? -1)
      : otherColorChipIndex;

  if (gapChipIndex === -1) {
    return null;
  }

  const assignment = new Array<number>(chips.length).fill(-1);
  const takenCells = new Set<number>();

  const place = (chipIndex: number, cellIndex: number): void => {
    assignment[chipIndex] = cellIndex;
    takenCells.add(cellIndex);
  };

  place(lineChipIndices[0], anchor.line[0]);
  place(lineChipIndices[1], anchor.line[1]);
  place(lineChipIndices[2], anchor.hook);
  place(gapChipIndex, anchor.gap);

  const freeCells = cells.reduce<number[]>((acc, _cell, index) => {
    if (!takenCells.has(index)) {
      acc.push(index);
    }

    return acc;
  }, []);

  let freeCursor = 0;

  for (let chipIndex = 0; chipIndex < chips.length; chipIndex++) {
    if (assignment[chipIndex] === -1) {
      assignment[chipIndex] = freeCells[freeCursor];
      freeCursor++;
    }
  }

  return assignment;
};

/** Чем раскладка хороша: есть ли на доске ход и не лежит ли уже готовая комбинация. */
export interface IReshuffleLayoutRating {
  hasMove: boolean;
  hasReadyMatch: boolean;
}

/**
 * Оценка раскладки вызывающим.
 *
 * Правила «есть ход» и «есть комбинация» читают живой грид с сущностями, а не
 * перестановку индексов, поэтому оценку даёт тот, у кого грид есть.
 */
export type TRateReshuffleLayout = (layout: readonly number[]) => IReshuffleLayoutRating;

/**
 * Выбор раскладки перемешивания: первая «чистая», иначе первая с ходом.
 *
 * «Чистая» - ход есть и готовой комбинации нет. Раскладку с готовой тройкой
 * доска разберёт каскадом сразу после перемешки, которого игрок не просил, а
 * его фишки ещё и молча доигрывают прогресс целей и исход партии. Поэтому она
 * только запасная - на случай, если чистой за `attempts` попыток не нашлось.
 *
 * Контракт с вызывающим: `rate` прикладывает кандидата к гриду, значит после
 * возврата грид держит последнюю *оценённую* раскладку, а не выбранную.
 * Применить победителя обязан вызывающий.
 *
 * `null` - ни одна попытка не дала хода. Что делать дальше, решает вызывающий:
 * следующий рубеж - детерминированный `planGuaranteedMoveLayout`.
 */
export const pickReshuffleLayout = (
  chipCount: number,
  attempts: number,
  rate: TRateReshuffleLayout,
  random: () => number = Math.random
): number[] | null => {
  let fallback: number[] | null = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const layout = planShuffledLayout(chipCount, random);
    const rating = rate(layout);

    if (!rating.hasMove) {
      continue;
    }

    if (!rating.hasReadyMatch) {
      return layout;
    }

    fallback ??= layout;
  }

  return fallback;
};

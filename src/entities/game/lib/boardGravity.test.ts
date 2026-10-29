import { describe, expect, it } from 'vitest';
import { planBoardGravity, type TGravitySlot } from './boardGravity';

/**
 * Поле строками сверху вниз: буква - фишка, `.` - пусто, `H` - дыра, `#` -
 * неподвижная клетка. Возвращает фишки по колонкам и вид каждой клетки.
 */
const field = (...rows: string[]) => {
  const cols = rows[0].length;
  const grid = Array.from({ length: cols }, (_, col) =>
    rows.map((line) => (/[a-z]/.test(line[col]) ? line[col] : null))
  );
  const slotAt = (col: number, row: number): TGravitySlot =>
    rows[row][col] === 'H' ? 'hole' : rows[row][col] === '#' ? 'fixed' : 'open';

  return { grid, slotAt };
};

/** Новые фишки - цифрами по порядку появления. */
const spawner = () => {
  let next = 0;

  return () => String(next++);
};

/** Поле плана строками, тем же алфавитом; новые фишки - `*`. */
const picture = (
  grid: (string | null)[][],
  slotAt: (col: number, row: number) => TGravitySlot
): string[] =>
  Array.from({ length: grid[0].length }, (_, row) =>
    grid
      .map((column, col) => {
        const slot = slotAt(col, row);

        if (slot !== 'open') return slot === 'hole' ? 'H' : '#';

        const cell = column[row];

        return cell === null ? '.' : /\d/.test(cell) ? '*' : cell;
      })
      .join('')
  );

describe('planBoardGravity', () => {
  it('фишки падают вниз, сверху встают новые', () => {
    const { grid, slotAt } = field('a', '.', '.');
    const plan = planBoardGravity(grid, slotAt, spawner());

    expect(picture(plan.grid, slotAt)).toEqual(['*', '*', 'a']);
    expect(plan.moves.find((move) => move.cell === 'a')).toEqual({
      cell: 'a',
      from: { col: 0, row: 0 },
      path: [
        { col: 0, row: 1 },
        { col: 0, row: 2 },
      ],
    });
  });

  it('дыру фишка пролетает насквозь', () => {
    const { grid, slotAt } = field('a', 'H', '.');
    const plan = planBoardGravity(grid, slotAt, spawner());

    expect(picture(plan.grid, slotAt)).toEqual(['*', 'H', 'a']);
  });

  it('новые фишки входят в колонку сквозь дыры сверху', () => {
    const { grid, slotAt } = field('H', '.', '.');
    const plan = planBoardGravity(grid, slotAt, spawner());

    expect(picture(plan.grid, slotAt)).toEqual(['H', '*', '*']);
  });

  it('под неподвижной клеткой пустоту заполняют соседи по диагонали', () => {
    const { grid, slotAt } = field('ab', '#c', '..');
    const plan = planBoardGravity(grid, slotAt, spawner());

    // Колонка 0 под блокером сверху не получит ничего. Первым тактом c падает
    // прямо, вторым b упирается в неё и соскальзывает под блокер, а колонка 1
    // добирается сверху.
    expect(picture(plan.grid, slotAt)).toEqual(['a*', '#*', 'bc']);
    expect(plan.moves.find((move) => move.cell === 'b')?.path).toEqual([
      { col: 1, row: 1 },
      { col: 0, row: 2 },
    ]);
    // Куда можно соскользнуть, на месте не добирают.
    expect(plan.moves.some((move) => move.inPlace)).toBe(false);
  });

  it('по диагонали не съезжают туда, куда придёт фишка сверху', () => {
    const { grid, slotAt } = field('ab', '.c', '..');
    const plan = planBoardGravity(grid, slotAt, spawner());

    expect(picture(plan.grid, slotAt)).toEqual(['**', '*b', 'ac']);
    expect(plan.moves.find((move) => move.cell === 'a')?.path.every((pos) => pos.col === 0)).toBe(
      true
    );
  });

  it('замкнутый неподвижными клетками карман добирается на месте', () => {
    const { grid, slotAt } = field('###', '#.#');
    const plan = planBoardGravity(grid, slotAt, spawner());

    expect(picture(plan.grid, slotAt)).toEqual(['###', '#*#']);
    expect(plan.moves).toEqual([
      { cell: '0', from: { col: 1, row: 1 }, path: [{ col: 1, row: 1 }], inPlace: true },
    ]);
  });

  it('под серединой ряда неподвижных шире двух фишка появляется на месте', () => {
    const { grid, slotAt } = field('abcde', '.###.', '.....');
    const plan = planBoardGravity(grid, slotAt, spawner());

    // Края ряда добирают соседние колонки по диагонали, а в верхнюю клетку под
    // серединой не упасть ниоткуда - она одна добирается на месте.
    expect(picture(plan.grid, slotAt).join('').includes('.')).toBe(false);
    expect(plan.moves.filter((move) => move.inPlace).map((move) => move.from)).toEqual([
      { col: 2, row: 2 },
    ]);
  });

  it('фишки только падают: ни одна не поднимается и не уходит в сторону больше чем на клетку', () => {
    const { grid, slotAt } = field('abc', '#.#', '...', 'd#e');
    const plan = planBoardGravity(grid, slotAt, spawner());

    for (const move of plan.moves.filter(({ inPlace }) => !inPlace)) {
      let previous = move.from;

      for (const pos of move.path) {
        expect(pos.row).toBeGreaterThan(previous.row);
        expect(Math.abs(pos.col - previous.col)).toBeLessThanOrEqual(1);
        previous = pos;
      }
    }

    expect(picture(plan.grid, slotAt).join('').includes('.')).toBe(false);
  });
});

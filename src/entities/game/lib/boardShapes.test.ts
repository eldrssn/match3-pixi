import { describe, expect, it } from 'vitest';
import { findBoardShapes, type IBoardShape } from './boardShapes';

interface ICell {
  id: string;
}

/** Поле строками сверху вниз; `.` - пусто, `#` - блокер (не матчится). */
const grid = (...rows: string[]): (ICell | null)[][] =>
  Array.from({ length: rows[0].length }, (_, col) =>
    rows.map((line) => (line[col] === '.' ? null : { id: line[col] }))
  );

const isChip = (cell: ICell): boolean => cell.id !== '#';

const shapes = (...rows: string[]): IBoardShape[] => findBoardShapes(grid(...rows), isChip);

const kinds = (...rows: string[]): string[] => shapes(...rows).map((shape) => shape.kind);

describe('findBoardShapes', () => {
  it('finds nothing on a board without lines and squares', () => {
    expect(shapes('ABAB', 'BABA', 'ABAB')).toEqual([]);
  });

  it('a line of three is a plain match', () => {
    const [shape] = shapes('AAAB', 'BCBC');

    expect(shape).toMatchObject({ kind: 'line3', axis: 'horizontal' });
    expect(shape.cells).toEqual([
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 2, row: 0 },
    ]);
  });

  it('a line of four keeps its axis for the rocket', () => {
    expect(shapes('B', 'A', 'A', 'A', 'A', 'B')[0]).toMatchObject({
      kind: 'line4',
      axis: 'vertical',
    });
  });

  it('a line of five beats everything', () => {
    expect(kinds('AAAAA', 'BABCB', 'CACBC')).toEqual(['line5']);
  });

  it('crossing row and column lines make an L/T with their shared cell', () => {
    const [tShape] = shapes('AAA', 'BAB', 'CAC');

    expect(tShape.kind).toBe('lt');
    expect(tShape.intersection).toEqual({ col: 1, row: 0 });
    expect(tShape.cells).toHaveLength(5);

    const [lShape] = shapes('ABC', 'ACB', 'AAA');

    expect(lShape).toMatchObject({ kind: 'lt', intersection: { col: 0, row: 2 } });
  });

  it('L/T outranks a line of four', () => {
    expect(kinds('AAAA', 'BABC', 'CABC')).toEqual(['lt']);
  });

  it('a 2x2 square is a propeller shape even without any line', () => {
    const [shape] = shapes('AAB', 'AAC', 'BCB');

    expect(shape).toMatchObject({ kind: 'square', axis: null });
    expect(shape.cells).toHaveLength(4);
  });

  it('a square with a tail stays a square, a square with a four is a four', () => {
    expect(kinds('AAA', 'AAB', 'BCB')).toEqual(['square']);
    expect(kinds('AAAA', 'AABC', 'BCBC')).toEqual(['line4']);
  });

  it('separate shapes come out separately, the valuable one first', () => {
    expect(kinds('AAAB', 'CDCD', 'BBBB')).toEqual(['line4', 'line3']);
  });

  it('blockers and empty cells break lines', () => {
    expect(shapes('AA#A', 'A.AA')).toEqual([]);
  });
});

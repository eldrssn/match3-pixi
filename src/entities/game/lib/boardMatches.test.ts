import { describe, expect, it } from 'vitest';
import { findBoardMatches, hasBoardMatch, hasPossibleMove, type IBoardCell } from './boardMatches';

interface ITestCell extends IBoardCell {
  id: string;
  /** Отметка «не фишка»: блокер, лазер, дыра - всё, что в матч не идёт. */
  isBlocker?: boolean;
}

const isMatchable = (cell: ITestCell): boolean => !cell.isBlocker;

/**
 * Доска из строк, как её видно на экране: `'rrbb'` - верхняя строка слева
 * направо. Внутрь уходит `grid[col][row]`, поэтому раскладка в тесте читается
 * так же, как выглядит игроку, а транспонирование - забота хелпера.
 *
 * `.` - пустая клетка, заглавная буква - неучаствующий в матче блокер.
 */
const board = (...rows: string[]): (ITestCell | null)[][] => {
  const rowCount = rows.length;
  const colCount = rows[0]?.length ?? 0;

  return Array.from({ length: colCount }, (_, col) =>
    Array.from({ length: rowCount }, (_, row): ITestCell | null => {
      const symbol = rows[row][col];

      if (symbol === '.') {
        return null;
      }

      const isBlocker = symbol === symbol.toUpperCase();

      return { id: symbol.toLowerCase(), isBlocker };
    })
  );
};

describe('findBoardMatches', () => {
  it('находит горизонтальную тройку и не считает её вертикальной', () => {
    const result = findBoardMatches(board('rrrb', 'bgby', 'ygyb'), isMatchable);

    expect(result.horizontal3).toHaveLength(1);
    expect(result.horizontal3?.[0]).toHaveLength(3);
    expect(result.vertical3).toBeNull();
    expect(result.entities).toHaveLength(3);
  });

  it('находит вертикальную четвёрку и кладёт её в vertical4', () => {
    const result = findBoardMatches(board('rby', 'rgy', 'rby', 'rgb'), isMatchable);

    expect(result.vertical4).toHaveLength(1);
    expect(result.vertical4?.[0]).toHaveLength(4);
    expect(result.horizontal4).toBeNull();
  });

  it('не склеивает фишки через блокер', () => {
    // Тройка красных разорвана блокером посередине.
    expect(findBoardMatches(board('rRr'), isMatchable).entities).toHaveLength(0);
  });

  it('не склеивает фишки через пустую клетку', () => {
    expect(findBoardMatches(board('r.rr'), isMatchable).horizontal3).toBeNull();
  });

  it('отдаёт клетку на пересечении комбинаций один раз', () => {
    const result = findBoardMatches(
      board('rrr', 'byg', 'byg').map((column, col) =>
        // Достраиваем вертикальную тройку в первой колонке, пересекающую горизонтальную.
        col === 0 ? [column[0], { id: 'r' }, { id: 'r' }] : column
      ),
      isMatchable
    );

    expect(result.horizontal3).toHaveLength(1);
    expect(result.vertical3).toHaveLength(1);
    // 3 горизонтальных + 3 вертикальных, из них одна общая.
    expect(result.entities).toHaveLength(5);
  });

  it('на пустой доске ничего не находит', () => {
    expect(findBoardMatches([], isMatchable).entities).toHaveLength(0);
    expect(hasBoardMatch([], isMatchable)).toBe(false);
  });
});

describe('hasPossibleMove', () => {
  it('видит ход, который даёт свап вправо', () => {
    // Свап `g` и `r` в нижней строке достраивает красным первую колонку.
    const grid = board('rbrb', 'rgbr', 'grby');

    expect(hasBoardMatch(grid, isMatchable)).toBe(false);
    expect(hasPossibleMove(grid, isMatchable)).toBe(true);
  });

  it('видит ход, который даёт свап вниз', () => {
    const grid = board('bgb', 'rbr', 'rgr');

    expect(hasBoardMatch(grid, isMatchable)).toBe(false);
    expect(hasPossibleMove(grid, isMatchable)).toBe(true);
  });

  it('на доске без ходов возвращает false', () => {
    // Тупиковая раскладка: комбинаций нет и ни один свап соседей их не даёт -
    // именно тот случай, ради которого в партии запускается перемешивание.
    const grid = board('rygg', 'yygr', 'brby', 'grrb');

    expect(hasBoardMatch(grid, isMatchable)).toBe(false);
    expect(hasPossibleMove(grid, isMatchable)).toBe(false);
  });

  it('не оставляет доску перевёрнутой после перебора', () => {
    const grid = board('rygg', 'yygr', 'brby', 'grrb');
    const before = grid.map((column) => column.map((cell) => cell?.id ?? null));

    hasPossibleMove(grid, isMatchable);

    expect(grid.map((column) => column.map((cell) => cell?.id ?? null))).toEqual(before);
  });

  it('не считает ходом свап с блокером', () => {
    // Фишки изолированы блокерами: пары «фишка + фишка» на доске нет вовсе, а
    // блокеры местами не меняют - значит и хода нет.
    const grid = board('rBr', 'BrB', 'rBr');

    expect(hasPossibleMove(grid, isMatchable)).toBe(false);
  });
});

describe('квадрат 2×2', () => {
  it('квадрат одного цвета - готовая комбинация, даже без линии', () => {
    const result = findBoardMatches(board('rrb', 'rrg', 'bgb'), isMatchable);

    expect(result.squares).toHaveLength(1);
    expect(result.entities).toHaveLength(4);
    expect(hasBoardMatch(board('rrb', 'rrg', 'bgb'), isMatchable)).toBe(true);
  });

  it('свап, замыкающий квадрат, - это ход', () => {
    // Свап (2,1)<->(2,2) ставит r в правый нижний угол квадрата (1,0)-(2,1).
    expect(hasPossibleMove(board('grrb', 'bryg', 'gbrb'), isMatchable)).toBe(true);
  });

  it('блокер в квадрате его ломает', () => {
    expect(findBoardMatches(board('rrb', 'rRg', 'bgb'), isMatchable).squares).toBeNull();
  });
});

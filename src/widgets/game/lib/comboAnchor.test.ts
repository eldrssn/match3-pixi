import { describe, expect, it } from 'vitest';

import { resolveComboAnchorCell } from './comboAnchor';

const SIZE = { colCount: 6, rowCount: 6 };

describe('resolveComboAnchorCell', () => {
  it('на одной комбинации из одной клетки ставит попап в неё саму', () => {
    expect(resolveComboAnchorCell([[{ col: 0, row: 3 }]], SIZE)).toEqual({ col: 0, row: 3 });
  });

  it('усредняет клетки комбинации в её центр масс', () => {
    expect(
      resolveComboAnchorCell(
        [
          [
            { col: 0, row: 0 },
            { col: 2, row: 0 },
            { col: 1, row: 3 },
          ],
        ],
        SIZE
      )
    ).toEqual({ col: 1, row: 1 });
  });

  it('из нескольких комбинаций итерации берёт самую крупную, а не их общий центр', () => {
    expect(
      resolveComboAnchorCell(
        [
          [
            { col: 0, row: 0 },
            { col: 1, row: 0 },
            { col: 2, row: 0 },
          ],
          [
            { col: 5, row: 5 },
            { col: 5, row: 4 },
            { col: 5, row: 3 },
            { col: 5, row: 2 },
          ],
        ],
        SIZE
      )
    ).toEqual({ col: 5, row: 3.5 });
  });

  it('при равных по длине комбинациях держится первой - порядок обхода доски стабилен', () => {
    expect(
      resolveComboAnchorCell(
        [
          [
            { col: 0, row: 0 },
            { col: 1, row: 0 },
            { col: 2, row: 0 },
          ],
          [
            { col: 3, row: 5 },
            { col: 4, row: 5 },
            { col: 5, row: 5 },
          ],
        ],
        SIZE
      )
    ).toEqual({ col: 1, row: 0 });
  });

  it('без совпадений (в реальном цикле недостижимо) ставит попап в центр поля', () => {
    expect(resolveComboAnchorCell([], SIZE)).toEqual({ col: 2.5, row: 2.5 });
  });

  it('пустые группы считаются отсутствием совпадений', () => {
    expect(resolveComboAnchorCell([[], []], SIZE)).toEqual({ col: 2.5, row: 2.5 });
  });

  it('на поле из одной клетки центр совпадает с ней самой', () => {
    expect(resolveComboAnchorCell([], { colCount: 1, rowCount: 1 })).toEqual({ col: 0, row: 0 });
  });
});

/**
 * Чистое правило: в какой клетке всплывает множитель каскада.
 *
 * Якорь - центр масс самой крупной комбинации, сгоревшей именно в текущей
 * итерации каскада, а не клетка, с которой начался ход (свап, клетка бустера
 * или лазера): та не меняется всю цепочку, и попап застревал бы на месте
 * первого хода, а не там, где фишки реально гаснут на второй, третьей...
 * итерации.
 *
 * Считается по группе, а не по плоскому списку всех сгоревших клеток: на одной
 * итерации каскад нередко гасит две несвязанные тройки у противоположных краёв
 * доски, и общий центр масс поставил бы «×N» ровно между ними - в клетку, где
 * не происходило ничего. Крупнейшая группа - то самое место, куда игрок и так
 * смотрит.
 *
 * Правило живёт отдельно от `GameLogic` по той же причине, что `boardGravity` и
 * `reshuffleLayout`: центр поля как откат для пустого списка проверяется
 * тестом, а не только глазами на живой доске.
 */

export interface IComboAnchorCell {
  col: number;
  row: number;
}

export interface IBoardSize {
  colCount: number;
  rowCount: number;
}

const centerOfMass = (cells: readonly IComboAnchorCell[]): IComboAnchorCell => {
  const sum = cells.reduce((acc, cell) => ({ col: acc.col + cell.col, row: acc.row + cell.row }), {
    col: 0,
    row: 0,
  });

  return {
    col: sum.col / cells.length,
    row: sum.row / cells.length,
  };
};

/**
 * Клетка попапа в координатах доски - центр масс крупнейшей группы.
 * Дробный результат - обычное дело: чётная по длине комбинация усредняется в
 * точку между клетками, как и центр поля на чётной стороне.
 *
 * Пустой список групп практически недостижим (каскад движка,
 * `BoardEngine.resolveCascade`, заходит в итерацию только когда есть хотя бы
 * одно совпадение), но функция всё равно не бросает - откатывается в центр поля.
 */
export const resolveComboAnchorCell = (
  matchGroups: readonly (readonly IComboAnchorCell[])[],
  size: IBoardSize
): IComboAnchorCell => {
  const largest = matchGroups.reduce<readonly IComboAnchorCell[]>(
    (best, group) => (group.length > best.length ? group : best),
    []
  );

  if (largest.length === 0) {
    return {
      col: (size.colCount - 1) / 2,
      row: (size.rowCount - 1) / 2,
    };
  }

  return centerOfMass(largest);
};

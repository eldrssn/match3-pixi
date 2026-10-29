import type { TBoardStep } from '../engine/boardSteps';

/** Шаг цели уровня: что снято (код цели) и чей это паспорт в движке. */
export interface IGoalEvent {
  /** Код цели: `red`, `cargo`, `ice`, `floor`, `drop`, ... */
  id: string;
  /** Паспорт предмета или слоя (`TBoardPiece.uid`, `IBoardHit.uid`). */
  uid: number;
}

/**
 * Что из шага хода идёт в цели уровня - единственное правило на всех
 * потребителей: рантайм проигрывателя шагов (`BoardStepPlayer`), бот и тесты
 * каталога. Засчитываются разрушенный слой клетки (предмет, накладка,
 * подложка), фишка, превращённая радугой в спецфишку (она гаснет как
 * разрушенная), и собранное «опусти вниз». Фишка, поглощённая слизью, и фишка,
 * уступившая клетку предуровневому бустеру, в цель не идут - их никто не
 * собирал.
 */
export const listGoalEvents = (step: TBoardStep): IGoalEvent[] => {
  switch (step.type) {
    case 'damage':
      return step.hits.filter((hit) => hit.destroyed).map(({ id, uid }) => ({ id, uid }));

    case 'transform':
      return step.changes.map(({ id, uid }) => ({ id, uid }));

    case 'collect':
      return step.uids.map((uid) => ({ id: 'drop', uid }));

    default:
      return [];
  }
};

/**
 * Прогресс целей уровня прямо по протоколу хода: сколько чего снято, по
 * кодам целей. Без потолка цели - бот сравнивает его с `count` сам.
 */
export const countGoalProgress = (
  steps: readonly TBoardStep[],
  into: Map<string, number> = new Map()
): Map<string, number> => {
  for (const step of steps) {
    for (const { id } of listGoalEvents(step)) {
      into.set(id, (into.get(id) ?? 0) + 1);
    }
  }

  return into;
};

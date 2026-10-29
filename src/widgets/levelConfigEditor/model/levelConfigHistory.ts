/**
 * История правок черновика для отмены и повтора (`Ctrl+Z` / `Ctrl+Shift+Z`).
 *
 * Хранятся прошлые и будущие снимки целиком: конфиг уровня - десятки клеток,
 * а сравнивать диффы ради памяти dev-инструмента незачем. Штрих кисти - одна
 * правка, а не одна на клетку: его клетки сливаются в последний снимок
 * (`merge`), иначе отмена откатывала бы ряд по клетке.
 */
export interface IHistory<T> {
  past: readonly T[];
  future: readonly T[];
}

/** Сколько шагов назад помнит редактор. */
export const HISTORY_LIMIT = 100;

export const createHistory = <T>(): IHistory<T> => ({ past: [], future: [] });

/**
 * Запомнить состояние перед правкой. `merge` - правка продолжает предыдущую
 * (следующая клетка того же штриха): точка отката уже есть, новая не нужна.
 * Любая новая правка обнуляет повтор.
 */
export const recordHistory = <T>(history: IHistory<T>, previous: T, merge = false): IHistory<T> => {
  if (merge && history.past.length > 0) {
    return { past: history.past, future: [] };
  }

  return { past: [...history.past, previous].slice(-HISTORY_LIMIT), future: [] };
};

/** Шаг назад: `null`, если отменять нечего. */
export const undoHistory = <T>(
  history: IHistory<T>,
  current: T
): { history: IHistory<T>; value: T } | null => {
  const value = history.past.at(-1);

  if (value === undefined) {
    return null;
  }

  return {
    value,
    history: { past: history.past.slice(0, -1), future: [current, ...history.future] },
  };
};

/** Шаг вперёд после отмены: `null`, если повторять нечего. */
export const redoHistory = <T>(
  history: IHistory<T>,
  current: T
): { history: IHistory<T>; value: T } | null => {
  const [value, ...future] = history.future;

  if (value === undefined) {
    return null;
  }

  return { value, history: { past: [...history.past, current], future } };
};

import { describe, expect, it } from 'vitest';
import {
  createHistory,
  HISTORY_LIMIT,
  recordHistory,
  redoHistory,
  undoHistory,
} from './levelConfigHistory';

describe('levelConfigHistory', () => {
  it('undoes and redoes edits in order', () => {
    let history = createHistory<number>();
    history = recordHistory(history, 1);
    history = recordHistory(history, 2);

    const back = undoHistory(history, 3);
    expect(back?.value).toBe(2);

    const forward = back && redoHistory(back.history, back.value);
    expect(forward?.value).toBe(3);
  });

  it('has nothing to undo or redo on a fresh history', () => {
    expect(undoHistory(createHistory<number>(), 1)).toBeNull();
    expect(redoHistory(createHistory<number>(), 1)).toBeNull();
  });

  it('merges a brush stroke into one undo step', () => {
    let history = createHistory<number>();
    history = recordHistory(history, 1);
    history = recordHistory(history, 2, true);
    history = recordHistory(history, 3, true);

    expect(history.past).toEqual([1]);
  });

  it('drops redo on a new edit and keeps a bounded past', () => {
    const back = undoHistory(recordHistory(createHistory<number>(), 1), 2);
    let history = recordHistory(back?.history ?? createHistory<number>(), 1);

    expect(history.future).toEqual([]);

    for (let value = 0; value < HISTORY_LIMIT + 10; value++) {
      history = recordHistory(history, value);
    }

    expect(history.past).toHaveLength(HISTORY_LIMIT);
  });
});

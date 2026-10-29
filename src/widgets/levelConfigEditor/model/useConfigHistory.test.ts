import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { useConfigHistory } from './useConfigHistory';

const useCounter = () => {
  const [value, setValue] = useState(0);
  const history = useConfigHistory(value, setValue);

  const edit = (next: number, merge = false) => {
    history.record(merge);
    setValue(next);
  };

  return { value, edit, ...history };
};

const pressKey = (key: string, options: KeyboardEventInit = {}) => {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey: true, ...options }));
  });
};

describe('useConfigHistory', () => {
  it('undoes and redoes edits, a merged edit is one step', () => {
    const { result } = renderHook(useCounter);

    act(() => result.current.edit(1));
    act(() => result.current.edit(2));
    act(() => result.current.edit(3, true));

    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.value).toBe(1);

    act(() => result.current.redo());
    expect(result.current.value).toBe(3);
    expect(result.current.canRedo).toBe(false);
  });

  it('listens to Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y on the window', () => {
    const { result } = renderHook(useCounter);

    act(() => result.current.edit(1));
    act(() => result.current.edit(2));

    pressKey('z');
    expect(result.current.value).toBe(1);

    pressKey('Z', { shiftKey: true });
    expect(result.current.value).toBe(2);

    pressKey('z');
    pressKey('y');
    expect(result.current.value).toBe(2);
  });

  it('leaves Ctrl+Z to a text field in focus', () => {
    const { result } = renderHook(useCounter);
    const input = document.createElement('input');

    document.body.append(input);
    act(() => result.current.edit(1));

    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    });

    expect(result.current.value).toBe(1);
    input.remove();
  });
});

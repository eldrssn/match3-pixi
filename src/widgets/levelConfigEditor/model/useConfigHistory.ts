import { useEffect, useEffectEvent, useState } from 'react';
import {
  createHistory,
  recordHistory,
  redoHistory,
  undoHistory,
  type IHistory,
} from './levelConfigHistory';

/**
 * Фокус в поле ввода: там `Ctrl+Z` - родная отмена набранного текста, а не
 * откат черновика уровня.
 */
const isTextEditingTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/**
 * Отмена и повтор правок значения (`levelConfigHistory`) плюс горячие клавиши
 * `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` на окне.
 *
 * `record` зовут перед правкой: он запоминает `current` как точку отката.
 * `onRestore` показывает значение из истории - сам он в историю не пишет.
 */
export const useConfigHistory = <T>(current: T, onRestore: (value: T) => void) => {
  const [history, setHistory] = useState<IHistory<T>>(createHistory);

  const record = (merge = false) => {
    setHistory((past) => recordHistory(past, current, merge));
  };

  const undo = () => {
    const step = undoHistory(history, current);

    if (step) {
      setHistory(step.history);
      onRestore(step.value);
    }
  };

  /** Забыть историю: открыт другой уровень, и его откат чужой правкой был бы ошибкой. */
  const reset = () => {
    setHistory(createHistory<T>());
  };

  const redo = () => {
    const step = redoHistory(history, current);

    if (step) {
      setHistory(step.history);
      onRestore(step.value);
    }
  };

  // Effect event видит свежие undo/redo: подписка одна на всю жизнь
  // редактора, а не новая на каждый рендер.
  const handleHistoryKey = useEffectEvent((event: KeyboardEvent) => {
    if (!(event.metaKey || event.ctrlKey) || isTextEditingTarget(event.target)) {
      return;
    }

    const key = event.key.toLowerCase();

    if (key === 'z') {
      event.preventDefault();

      if (event.shiftKey) {
        redo();
      } else {
        undo();
      }
    } else if (key === 'y') {
      event.preventDefault();
      redo();
    }
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => handleHistoryKey(event);

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    record,
    undo,
    redo,
    reset,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
};

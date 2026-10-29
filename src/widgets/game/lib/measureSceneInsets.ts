import type { ISceneInsets } from '../configs/sceneInsets';

/**
 * Отступы сцены по зонду безопасной зоны (`.safeArea` в `GameScreen`).
 *
 * Зонд - пустой абсолютный узел внутри доски, растянутый от
 * `--match3-inset-top` до `--match3-inset-bottom`. Меряется его бокс, а не
 * значение переменных: в них лежат `var()`/`env()`/`calc()`, и
 * `getComputedStyle` отдал бы кастомное свойство строкой как есть, без
 * математики. Отсчёт - от бокса доски, потому что канвас занимает ровно её.
 */
export const measureSceneInsets = (board: HTMLElement, safeArea: HTMLElement): ISceneInsets => {
  const boardRect = board.getBoundingClientRect();
  const safeRect = safeArea.getBoundingClientRect();

  return {
    top: Math.max(0, safeRect.top - boardRect.top),
    bottom: Math.max(0, boardRect.bottom - safeRect.bottom),
  };
};

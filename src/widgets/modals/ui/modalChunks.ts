import type { TModalKey } from '../model/modal-registry';

// Загрузчики чанков лежат отдельно от реестра вью, чтобы потребители могли
// просить предзагрузку (см. `pages/main`) без циклического импорта реестра.
export const importVictory = () => import('./victory');
export const importDefeat = () => import('./defeat');
export const importOutOfMoves = () => import('./outOfMoves');
export const importLevelStart = () => import('./levelStart');

// `Record` по всем ключам реестра: новая модалка без загрузчика не скомпилируется.
const MODAL_LOADERS: Record<TModalKey, () => Promise<unknown>> = {
  victory: importVictory,
  defeat: importDefeat,
  outOfMoves: importOutOfMoves,
  levelStart: importLevelStart,
};

/**
 * Результат игры догревает хост на старте партии (см. `pages/main`), а не
 * приложение на старте: тянуть его арт до первой партии незачем.
 */
export const prefetchModalChunk = (key: TModalKey): void => {
  void MODAL_LOADERS[key]().catch(() => undefined);
};

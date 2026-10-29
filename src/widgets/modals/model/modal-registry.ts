export const MODAL_KEYS = {
  VICTORY: 'victory',
  DEFEAT: 'defeat',
  OUT_OF_MOVES: 'outOfMoves',
  LEVEL_START: 'levelStart',
} as const;

export type TModalKey = (typeof MODAL_KEYS)[keyof typeof MODAL_KEYS];

export type TModalLayer = 'global' | 'system';

interface IModalRegistryEntry {
  /**
   * Кто побеждает, если одновременно открыто несколько `base`-модалок:
   * меньшее число важнее. При равном приоритете выигрывает открытая последней.
   */
  priority: 1 | 2 | 3 | 4 | 5;
  layer: TModalLayer;
  stacking: 'base' | 'stacked';
  /**
   * Закрывать при смене маршрута. Модалки геймфлоу привязаны к экрану,
   * с которого открыты.
   */
  closeOnRouteChange?: boolean;
}

export const MODAL_REGISTRY: Record<TModalKey, IModalRegistryEntry> = {
  // Результаты партии. Экран игры - не модалка, а режим главной страницы,
  // поэтому базы под этими модалками нет и они сами `base`.
  victory: { priority: 2, layer: 'global', stacking: 'base', closeOnRouteChange: true },
  defeat: { priority: 2, layer: 'global', stacking: 'base', closeOnRouteChange: true },
  // «Ходы закончились - ещё пять?» висит над живой доской (она стоит на паузе)
  // и важнее карточек результата: исхода ещё нет.
  outOfMoves: { priority: 1, layer: 'global', stacking: 'base', closeOnRouteChange: true },
  // Карточка уровня перед партией: цели, ходы и предуровневые бустеры. Висит
  // над главной или над фоном прошлой партии («Дальше», «Ещё раз»).
  levelStart: { priority: 2, layer: 'global', stacking: 'base', closeOnRouteChange: true },
};

export const isStackedModal = (key: TModalKey): boolean =>
  MODAL_REGISTRY[key].stacking === 'stacked';

export const ROUTE_BOUND_MODAL_KEYS: readonly TModalKey[] = (
  Object.keys(MODAL_REGISTRY) as TModalKey[]
).filter((key) => MODAL_REGISTRY[key].closeOnRouteChange === true);

import { isStackedModal, MODAL_REGISTRY, type TModalKey, type TModalLayer } from './modal-registry';

export interface IActiveModalLayer {
  layer: TModalLayer | null;
  topKey: TModalKey | null;
  visibleKeys: TModalKey[];
}

/**
 * Чистая арбитражная логика слоя модалок: из всех открытых ключей выбирается
 * одна `base`-модалка (по приоритету реестра, при равенстве - открытая
 * последней) и поверх неё все `stacked`.
 */
export const resolveActiveLayer = (openModalKeys: TModalKey[]): IActiveModalLayer => {
  const baseKey =
    openModalKeys
      .filter((key) => !isStackedModal(key))
      .sort((a, b) => {
        const priorityDiff = MODAL_REGISTRY[a].priority - MODAL_REGISTRY[b].priority;
        if (priorityDiff !== 0) {
          return priorityDiff;
        }

        return openModalKeys.lastIndexOf(b) - openModalKeys.lastIndexOf(a);
      })
      .at(0) ?? null;
  const stackedKeys = openModalKeys.filter(isStackedModal);
  const visibleKeys = baseKey ? [baseKey, ...stackedKeys] : stackedKeys;
  const topKey = visibleKeys.at(-1) ?? null;

  return {
    layer: topKey ? MODAL_REGISTRY[topKey].layer : null,
    topKey,
    visibleKeys,
  };
};

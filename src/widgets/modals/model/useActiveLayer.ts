import { useMemo } from 'react';
import { resolveActiveLayer, type IActiveModalLayer } from './resolveActiveLayer';
import { modalsSelectors, useModalsStore } from './useModalsStore';

export type { IActiveModalLayer };

export const useActiveLayer = (): IActiveModalLayer => {
  const openModalKeys = useModalsStore(modalsSelectors.openModalKeys);

  return useMemo(() => resolveActiveLayer(openModalKeys), [openModalKeys]);
};

import type { PropsWithChildren } from 'react';
import { ModalsHost } from '@/shared/modals';
import { useActiveLayer } from '../model/useActiveLayer';
import { useCloseModalsOnRouteChange } from '../model/useCloseModalsOnRouteChange';
import { modalsSelectors, useHideModal, useModalsStore } from '../model/useModalsStore';
import { renderModalView } from './modalViews';

/**
 * Продуктовая обвязка слоя модалок: связывает стор и реестр вью с generic
 * `ModalsHost` из `shared/modals`.
 */
export const ModalsProvider = ({ children }: PropsWithChildren) => {
  const hideModal = useHideModal();
  const purge = useModalsStore(modalsSelectors.purge);
  const { visibleKeys } = useActiveLayer();

  useCloseModalsOnRouteChange();

  return (
    <ModalsHost
      visibleKeys={visibleKeys}
      onClose={hideModal}
      onUnmounted={purge}
      renderModal={(key, { isOpened }) => renderModalView(key, { isOpened })}
    >
      {children}
    </ModalsHost>
  );
};

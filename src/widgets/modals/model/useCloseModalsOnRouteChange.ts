import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ROUTE_BOUND_MODAL_KEYS } from './modal-registry';
import { useHideModals } from './useModalsStore';

/**
 * Модалки геймфлоу и меню закрываются при смене маршрута: они глобальные, и без
 * этого экран игры «переезжал» бы поверх любого другого раздела, куда ушёл
 * пользователь.
 */
export const useCloseModalsOnRouteChange = (): void => {
  const { pathname } = useLocation();
  const hideModals = useHideModals();

  useEffect(() => {
    hideModals(ROUTE_BOUND_MODAL_KEYS);
  }, [hideModals, pathname]);
};

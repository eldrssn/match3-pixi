import { useEffect, useState } from 'react';
import { APP_ROOT_ID, MODALS_CONTAINER_ID } from './constants';

/**
 * Контейнер слоя модалок. Живёт отдельным узлом прямо в `body`, а не внутри
 * React-дерева приложения, по двум причинам:
 *
 * 1. фон можно пометить `inert` целиком (`#root`), не задев сам слой модалок;
 * 2. слой не наследует `overflow`/`padding` каркаса приложения и колонки
 *    контента: затемнение ложится на всё окно (`position: fixed`).
 *
 * Узел создаётся в инициализаторе состояния (без побочных эффектов - элемент
 * пока не в документе), а в `body` попадает эффектом, чтобы монтирование и
 * размонтирование были симметричны.
 */
export const useModalHostElement = (className: string): HTMLElement | null => {
  const [host] = useState<HTMLElement | null>(() => {
    if (typeof document === 'undefined') {
      return null;
    }

    const element = document.createElement('div');
    element.id = MODALS_CONTAINER_ID;
    element.className = className;

    return element;
  });

  useEffect(() => {
    if (!host) {
      return;
    }

    document.body.append(host);

    return () => host.remove();
  }, [host]);

  return host;
};

export const setAppRootInert = (isInert: boolean): void => {
  const appRoot = document.getElementById(APP_ROOT_ID);
  if (!appRoot) {
    return;
  }

  if (isInert) {
    appRoot.setAttribute('inert', '');
    appRoot.setAttribute('aria-hidden', 'true');

    return;
  }

  appRoot.removeAttribute('inert');
  appRoot.removeAttribute('aria-hidden');
};

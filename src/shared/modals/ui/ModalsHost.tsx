import { Suspense, useEffect, useMemo, type PropsWithChildren, type ReactNode } from 'react';
import { setAppRootInert, useModalHostElement } from '../lib/useModalHostElement';
import { useMountedModalKeys } from '../lib/useMountedModalKeys';
import { ModalHostContext } from './ModalHostContext';
import styles from './styles.module.scss';

export interface IModalRenderProps {
  isOpened: boolean;
  onClose: () => void;
}

interface IModalsHostProps<K extends string> extends PropsWithChildren {
  /** Ключи модалок, которые должны быть видимы прямо сейчас. */
  visibleKeys: K[];
  /** Продуктовый рендер модалки по ключу (реестр живёт в `widgets/modals`). */
  renderModal: (key: K, view: IModalRenderProps) => ReactNode;
  onClose: (key: K) => void;
  /** Вызывается, когда модалка окончательно ушла из DOM после exit-анимации. */
  onUnmounted?: (key: K) => void;
}

/**
 * Generic-механика слоя модалок: DOM-контейнер, отложенный размонтаж под
 * exit-анимацию, `inert` для фона и Suspense-границы. Про конкретные модалки
 * приложения слой ничего не знает - их отдаёт `renderModal`, поэтому `shared`
 * не зависит от `widgets`.
 */
export const ModalsHost = <K extends string>({
  children,
  visibleKeys,
  renderModal,
  onClose,
  onUnmounted,
}: IModalsHostProps<K>) => {
  const host = useModalHostElement(styles.host);
  const visible = useMemo(() => new Set(visibleKeys), [visibleKeys]);
  const mountedKeys = useMountedModalKeys(visibleKeys, onUnmounted);
  // Признак - смонтированные модалки, а не показанные: после `hide()` карточка
  // доигрывает exit-анимацию и всё это время закрывает экран. Снятый по
  // `hide()` `inert` открыл бы фон под уходящей карточкой - и тап по ней ушёл
  // бы в то, что лежит под модалкой. Тот же довод, что у паузы рантайма на
  // модалке результата.
  const hasMountedModals = mountedKeys.length > 0;

  useEffect(() => {
    setAppRootInert(hasMountedModals);

    return () => setAppRootInert(false);
  }, [hasMountedModals]);

  return (
    <ModalHostContext.Provider value={host}>
      {children}
      {mountedKeys.map((key) => (
        <Suspense key={key} fallback={null}>
          {renderModal(key, {
            isOpened: visible.has(key),
            onClose: () => onClose(key),
          })}
        </Suspense>
      ))}
    </ModalHostContext.Provider>
  );
};

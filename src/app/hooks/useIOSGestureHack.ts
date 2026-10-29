import { useEffect } from 'react';

/**
 * Запрет pinch-zoom страницы. `user-scalable=no` в `index.html` iOS Safari
 * игнорирует, и щипок по доске масштабировал бы всю страницу вместо игры.
 *
 * Платформенной проверки нет: `gesturestart` шлёт только WebKit, остальные
 * браузеры подписку просто не заметят.
 */
export const useIOSGestureHack = (): void => {
  useEffect(() => {
    const preventGestureZoom = (event: Event) => {
      event.preventDefault();
    };

    document.addEventListener('gesturestart', preventGestureZoom);

    return () => {
      document.removeEventListener('gesturestart', preventGestureZoom);
    };
  }, []);
};

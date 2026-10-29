import { useEffect } from 'react';

/**
 * Единственный владелец `--app-viewport-height` - высоты видимой области окна.
 *
 * `100vh` в мобильных браузерах - высота окна со спрятанными панелями: низ
 * экрана уезжал бы под панель адреса. `dvh` решает это в CSS, но минимальные
 * версии браузеров шаблона его не гарантируют, поэтому высоту меряет JS:
 * `window.innerHeight` меняется вместе с панелями браузера. От переменной
 * считаются каркас приложения (`App`), слой модалок и масштаб `--design-px`.
 *
 * Поворот отдаёт `orientationchange` раньше, чем пересчитает геометрию, -
 * замер в самом обработчике поймал бы старую высоту, поэтому он повторяется
 * через два кадра.
 */
export const useViewportHeight = (): void => {
  useEffect(() => {
    const root = document.documentElement;
    let frameId = 0;

    const sync = () => {
      root.style.setProperty('--app-viewport-height', `${window.innerHeight}px`);
    };

    const syncAfterRotation = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        frameId = requestAnimationFrame(sync);
      });
    };

    sync();
    window.addEventListener('resize', sync);
    window.addEventListener('pageshow', sync);
    window.addEventListener('orientationchange', syncAfterRotation);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', sync);
      window.removeEventListener('pageshow', sync);
      window.removeEventListener('orientationchange', syncAfterRotation);
      root.style.removeProperty('--app-viewport-height');
    };
  }, []);
};

import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const getFocusable = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.offsetParent !== null || element === document.activeElement
  );

/**
 * Фокус-ловушка диалога: при открытии фокус уходит внутрь модалки, Tab/Shift+Tab
 * ходят по кругу внутри неё, при закрытии фокус возвращается на элемент, с
 * которого модалку открыли.
 *
 * Слушатель висит на самом контейнере, а не на `window`: при стеке модалок
 * событие получает только та, внутри которой сейчас фокус, поэтому нижняя
 * модалка не перехватывает Tab у верхней.
 */
export const useFocusTrap = (enabled: boolean): RefObject<HTMLDivElement | null> => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!enabled || !container) {
      return;
    }

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const [firstFocusable] = getFocusable(container);
    (firstFocusable ?? container).focus({ preventScroll: true });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') {
        return;
      }

      const focusable = getFocusable(container);
      if (focusable.length === 0) {
        event.preventDefault();
        container.focus({ preventScroll: true });

        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === container)) {
        event.preventDefault();
        last.focus({ preventScroll: true });

        return;
      }

      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);

      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [enabled]);

  return containerRef;
};

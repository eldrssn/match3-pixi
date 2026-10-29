import { useEffect, useRef } from 'react';

interface IEscapeEntry {
  close: () => void;
}

/**
 * Стек открытых модалок в порядке монтирования. Слушатель `keydown` один на всё
 * приложение, и Escape закрывает только верхнюю модалку: обработчик на каждой
 * `ModalLayout` на стеке (экран игры + результат) закрыл бы одним нажатием обе
 * сразу.
 */
const stack: IEscapeEntry[] = [];
let isListenerAttached = false;

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape') {
    return;
  }

  stack.at(-1)?.close();
};

const attachListener = () => {
  if (isListenerAttached) {
    return;
  }

  window.addEventListener('keydown', handleKeyDown);
  isListenerAttached = true;
};

const detachListener = () => {
  if (!isListenerAttached || stack.length > 0) {
    return;
  }

  window.removeEventListener('keydown', handleKeyDown);
  isListenerAttached = false;
};

export const useModalEscapeStack = (enabled: boolean, onClose?: () => void): void => {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const entry: IEscapeEntry = { close: () => onCloseRef.current?.() };
    stack.push(entry);
    attachListener();

    return () => {
      const index = stack.lastIndexOf(entry);
      if (index !== -1) {
        stack.splice(index, 1);
      }

      detachListener();
    };
  }, [enabled]);
};

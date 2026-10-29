import { useEffect, useRef, useState } from 'react';

const TOAST_DURATION_MS = 2600;

export type TEditorToastType = 'success' | 'error';

export interface IEditorToast {
  type: TEditorToastType;
  text: string;
}

export type TEditorNotify = (type: TEditorToastType, text: string) => void;

/**
 * Тост редактора: одно сообщение за раз, новое заменяет прежнее и заново
 * заводит таймер скрытия. Таймер снимается вместе с редактором.
 */
export const useEditorToast = () => {
  const [toast, setToast] = useState<IEditorToast | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify: TEditorNotify = (type, text) => {
    setToast({ type, text });

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  };

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
    []
  );

  return { toast, notify };
};

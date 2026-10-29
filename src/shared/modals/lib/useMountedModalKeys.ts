import { useEffect, useRef, useState } from 'react';
import { motionDuration } from '@/shared/lib/motion';

// Keeps the modal mounted long enough for ModalLayout's exit animation
// (motionDuration.medium) to finish, plus a small safety buffer.
const UNMOUNT_ANIMATION_BUFFER_MS = 280;
const UNMOUNT_DELAY_MS = Math.round(motionDuration.medium * 1000) + UNMOUNT_ANIMATION_BUFFER_MS;

export const useMountedModalKeys = <K extends string>(
  visibleKeys: K[],
  onUnmounted?: (key: K) => void
): K[] => {
  const [mountedKeys, setMountedKeys] = useState<K[]>(visibleKeys);
  const timersRef = useRef(new Map<K, number>());
  const onUnmountedRef = useRef(onUnmounted);

  useEffect(() => {
    onUnmountedRef.current = onUnmounted;
  });

  useEffect(() => {
    const timers = timersRef.current;

    setMountedKeys((previous) => {
      const next = [...previous];

      for (const key of visibleKeys) {
        const pendingTimer = timers.get(key);
        if (pendingTimer !== undefined) {
          window.clearTimeout(pendingTimer);
          timers.delete(key);
        }
        if (!next.includes(key)) {
          next.push(key);
        }
      }

      return next.length === previous.length && next.every((key, index) => key === previous[index])
        ? previous
        : next;
    });

    for (const key of mountedKeys) {
      if (visibleKeys.includes(key) || timers.has(key)) {
        continue;
      }

      timers.set(
        key,
        window.setTimeout(() => {
          timers.delete(key);
          onUnmountedRef.current?.(key);
          setMountedKeys((previous) => previous.filter((item) => item !== key));
        }, UNMOUNT_DELAY_MS)
      );
    }
  }, [mountedKeys, visibleKeys]);

  // Хост может уйти раньше, чем доиграют exit-анимации закрывающихся модалок.
  // Отложенные `onUnmounted` в этот момент нужно не потерять, а выполнить: на
  // них висит уборка состояния (`purge`), а её пропуск оставил бы записи о
  // модалках, которых уже нет в DOM. `setMountedKeys` здесь не нужен - хост и
  // так размонтирован.
  useEffect(() => {
    const timers = timersRef.current;

    return () => {
      timers.forEach((timerId, key) => {
        window.clearTimeout(timerId);
        onUnmountedRef.current?.(key);
      });
      timers.clear();
    };
  }, []);

  return mountedKeys;
};

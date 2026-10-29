import { useEffect } from 'react';

let lockCount = 0;
let previousOverflow = '';

const lock = () => {
  if (lockCount === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  lockCount += 1;
};

const unlock = () => {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = previousOverflow;
  }
};

/**
 * Reference-counted body scroll lock: safe for several modals mounted at
 * once (base + stacked). Scroll unlocks only when the last locking modal
 * unmounts, regardless of unmount order.
 */
export const useBodyScrollLock = (): void => {
  useEffect(() => {
    lock();

    return unlock;
  }, []);
};

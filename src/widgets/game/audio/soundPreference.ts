import { STORAGE_KEYS } from '@/shared/constants';

/**
 * Выключен ли звук - удобство одного игрока на его устройстве, поэтому
 * `localStorage`. Хранилище может быть недоступно (приватный режим, запрет
 * cookies, WebView без storage) - тогда звук просто включён и выбор не
 * запоминается, а не падает партия.
 */
const SOUND_MUTED_KEY = STORAGE_KEYS.soundMuted;

export const readSoundMuted = (): boolean => {
  try {
    return window.localStorage.getItem(SOUND_MUTED_KEY) === '1';
  } catch {
    return false;
  }
};

export const writeSoundMuted = (muted: boolean): void => {
  try {
    window.localStorage.setItem(SOUND_MUTED_KEY, muted ? '1' : '0');
  } catch {
    // Не запомнили - не беда: выбор действует до конца партии.
  }
};

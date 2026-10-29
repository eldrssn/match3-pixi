/**
 * `localStorage` окна или `null`, если его нет (SSR, тесты без окна) или
 * браузер его запретил: приватный режим и запрет хранилища бросают уже на
 * чтении свойства `window.localStorage`.
 */
export const resolveStorage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

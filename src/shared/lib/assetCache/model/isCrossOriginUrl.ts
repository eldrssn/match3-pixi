/**
 * Кросс-доменный URL нельзя прогреть через `fetch` → blob: у внешнего
 * хранилища (логотипы спонсоров) нет CORS-заголовков, и ответ просто не дойдёт
 * до JS. Такой URL уходит в ветку `<img>`-прогрева, blob-копии не будет.
 *
 * Относительные пути (`/images/...`) и пути от BASE_URL всегда same-origin.
 */
export const isCrossOriginUrl = (url: string): boolean => {
  if (!/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(url)) {
    return false;
  }

  if (typeof window === 'undefined') {
    return true;
  }

  try {
    return new URL(url, window.location.href).origin !== window.location.origin;
  } catch {
    return true;
  }
};

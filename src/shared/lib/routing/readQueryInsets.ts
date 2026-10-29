export interface IQueryInsets {
  top: number;
  bottom: number;
}

/**
 * Dev/QA переключатель `?insets=<top>,<bottom>`: отступы экрана партии в CSS
 * px, как их задал бы хост с вырезом и home-индикатором. Нужен, чтобы
 * проверить раскладку под вырез в обычном браузере, где системный safe-area
 * всегда ноль. `?insets=47` - только сверху.
 *
 * Строка с мусором игнорируется целиком: молча раскладывать игру по половине
 * разобранного флага нельзя. Как и у остальных query-флагов
 * (`readQueryLevel`), трактовка строки запроса живёт здесь.
 */
export const readQueryInsets = (search = window.location.search): IQueryInsets | null => {
  const raw = new URLSearchParams(search).get('insets');

  if (raw === null || raw.trim() === '') {
    return null;
  }

  const parts = raw.split(',').map((part) => Number(part.trim()));

  if (parts.length > 2 || parts.some((value) => !Number.isFinite(value) || value < 0)) {
    return null;
  }

  return { top: parts[0] ?? 0, bottom: parts[1] ?? 0 };
};

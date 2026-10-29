export interface IFontFaceSpec {
  family: string;
  /** Шрифтовой дескриптор CSS: `normal`, `bold`, `600` и т.п. */
  weight?: string;
}

/**
 * Прогрев начертаний через CSS Font Loading API.
 *
 * Blob здесь не нужен: `document.fonts.load()` скачивает woff2 по обычному
 * `@font-face` из `_fonts.scss` и оставляет декодированный шрифт в font set
 * документа на всю жизнь страницы - первый рендер текста этим начертанием уже
 * без сетевого запроса и без FOUT.
 *
 * Ошибка одного начертания не роняет прогрев: текст просто догрузит шрифт
 * обычным путём при первом использовании.
 */
export const warmFontFaces = async (
  fonts: readonly IFontFaceSpec[],
  { signal }: { signal?: AbortSignal } = {}
): Promise<void> => {
  if (typeof document === 'undefined' || !document.fonts?.load) {
    return;
  }

  signal?.throwIfAborted();

  await Promise.all(
    fonts.map((font) =>
      document.fonts.load(`${font.weight ?? 'normal'} 1rem ${font.family}`).catch(() => undefined)
    )
  );

  signal?.throwIfAborted();
};

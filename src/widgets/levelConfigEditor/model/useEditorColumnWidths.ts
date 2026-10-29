import { useCallback, useEffect, useState, type RefObject } from 'react';
import {
  clampEditorColumnWidth,
  DEFAULT_EDITOR_COLUMN_WIDTHS,
  fitEditorColumnWidths,
  readEditorColumnWidths,
  writeEditorColumnWidths,
  type TEditorColumn,
  type TEditorColumnWidths,
} from './editorColumns';

/**
 * Ширины боковых колонок редактора с запоминанием. Запомненные ширины -
 * предпочтение автора; показываются они ужатыми под текущую ширину `rootRef`
 * (`fitEditorColumnWidths`), которую хук отслеживает `ResizeObserver`: окно
 * могли сузить, а ширины - запомнить на мониторе пошире. Сужение окна
 * предпочтение не переписывает: окно вернули - вернулись и ширины.
 */
export const useEditorColumnWidths = (rootRef: RefObject<HTMLElement | null>) => {
  const [preferred, setPreferred] = useState<TEditorColumnWidths>(readEditorColumnWidths);
  const [rootWidth, setRootWidth] = useState<number>();

  useEffect(() => {
    writeEditorColumnWidths(preferred);
  }, [preferred]);

  useEffect(() => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    const observer = new ResizeObserver(() => setRootWidth(root.clientWidth));

    observer.observe(root);

    return () => {
      observer.disconnect();
    };
  }, [rootRef]);

  const resizeColumn = useCallback(
    (column: TEditorColumn, width: number) => {
      setPreferred((current) => {
        const totalWidth = rootRef.current?.clientWidth;
        const shown = fitEditorColumnWidths(current, totalWidth);
        const next = clampEditorColumnWidth(column, width, shown, totalWidth);

        return next === current[column] ? current : { ...current, [column]: next };
      });
    },
    [rootRef]
  );

  const resetColumn = useCallback(
    (column: TEditorColumn) => resizeColumn(column, DEFAULT_EDITOR_COLUMN_WIDTHS[column]),
    [resizeColumn]
  );

  return { widths: fitEditorColumnWidths(preferred, rootWidth), resizeColumn, resetColumn };
};

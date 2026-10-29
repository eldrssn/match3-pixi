import { STORAGE_KEYS } from '@/shared/constants';

/**
 * Ширины боковых колонок редактора: настройки слева, превью справа. Поле
 * между ними забирает остаток (`1fr`), поэтому своей ширины у него нет -
 * его расширяют, ужимая соседей.
 *
 * Ширина - удобство одного автора на его мониторе, поэтому `localStorage`;
 * недоступное хранилище даёт ширины по умолчанию, а не падение редактора.
 */
export type TEditorColumn = 'settings' | 'preview';

export type TEditorColumnWidths = Record<TEditorColumn, number>;

export const DEFAULT_EDITOR_COLUMN_WIDTHS: TEditorColumnWidths = {
  settings: 340,
  preview: 400,
};

export const EDITOR_COLUMN_LIMITS: Record<TEditorColumn, { min: number; max: number }> = {
  settings: { min: 260, max: 640 },
  preview: { min: 280, max: 900 },
};

/** Меньше поле не ужимается: палитра и доска перестают помещаться рядом. */
export const EDITOR_WORKSPACE_MIN_WIDTH = 420;

/** Шаг клавиатурной подстройки разделителя стрелками. */
export const EDITOR_COLUMN_KEY_STEP = 16;

const STORAGE_KEY = STORAGE_KEYS.editorColumnWidths;

/**
 * Ширина колонки в её собственных пределах и так, чтобы полю осталось не
 * меньше `EDITOR_WORKSPACE_MIN_WIDTH` при ширине редактора `totalWidth`
 * (вместе с соседней колонкой). Без `totalWidth` - только собственные пределы.
 */
export const clampEditorColumnWidth = (
  column: TEditorColumn,
  width: number,
  widths: TEditorColumnWidths,
  totalWidth?: number
): number => {
  const { min, max } = EDITOR_COLUMN_LIMITS[column];
  const other: TEditorColumn = column === 'settings' ? 'preview' : 'settings';
  const room =
    totalWidth === undefined ? max : totalWidth - widths[other] - EDITOR_WORKSPACE_MIN_WIDTH;

  return Math.round(Math.max(min, Math.min(width, max, room)));
};

/**
 * Ширины, которые помещаются в редактор шириной `totalWidth`: полю остаётся
 * не меньше `EDITOR_WORKSPACE_MIN_WIDTH`. Запомненные ширины могли прийти с
 * монитора пошире или пережить сужение окна - их надо ужать при показе, не
 * переписывая сами предпочтения.
 */
export const fitEditorColumnWidths = (
  widths: TEditorColumnWidths,
  totalWidth: number | undefined
): TEditorColumnWidths => {
  if (totalWidth === undefined) {
    return widths;
  }

  const settings = clampEditorColumnWidth('settings', widths.settings, widths, totalWidth);
  const preview = clampEditorColumnWidth(
    'preview',
    widths.preview,
    { ...widths, settings },
    totalWidth
  );

  return settings === widths.settings && preview === widths.preview
    ? widths
    : { settings, preview };
};

export const readEditorColumnWidths = (): TEditorColumnWidths => {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');

    if (!parsed || typeof parsed !== 'object') {
      return DEFAULT_EDITOR_COLUMN_WIDTHS;
    }

    const stored = parsed as Partial<Record<TEditorColumn, unknown>>;
    const pick = (column: TEditorColumn) => {
      const value = stored[column];

      return typeof value === 'number' && Number.isFinite(value)
        ? clampEditorColumnWidth(column, value, DEFAULT_EDITOR_COLUMN_WIDTHS)
        : DEFAULT_EDITOR_COLUMN_WIDTHS[column];
    };

    return { settings: pick('settings'), preview: pick('preview') };
  } catch {
    return DEFAULT_EDITOR_COLUMN_WIDTHS;
  }
};

export const writeEditorColumnWidths = (widths: TEditorColumnWidths): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
  } catch {
    // Не запомнили - ширины действуют до перезагрузки страницы.
  }
};

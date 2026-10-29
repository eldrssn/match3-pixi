import { beforeEach, describe, expect, it } from 'vitest';
import {
  clampEditorColumnWidth,
  DEFAULT_EDITOR_COLUMN_WIDTHS,
  EDITOR_COLUMN_LIMITS,
  EDITOR_WORKSPACE_MIN_WIDTH,
  fitEditorColumnWidths,
  readEditorColumnWidths,
  writeEditorColumnWidths,
} from './editorColumns';
import { STORAGE_KEYS } from '@/shared/constants';

describe('fitEditorColumnWidths', () => {
  it('ужимает запомненные ширины, чтобы полю осталось место', () => {
    const fitted = fitEditorColumnWidths({ settings: 640, preview: 900 }, 1200);

    expect(fitted.settings).toBe(EDITOR_COLUMN_LIMITS.settings.min);
    expect(fitted.settings + fitted.preview + EDITOR_WORKSPACE_MIN_WIDTH).toBe(1200);
  });

  it('помещающиеся ширины и неизвестную ширину редактора не трогает', () => {
    const widths = { settings: 340, preview: 400 };

    expect(fitEditorColumnWidths(widths, 1920)).toBe(widths);
    expect(fitEditorColumnWidths(widths, undefined)).toBe(widths);
  });
});

describe('clampEditorColumnWidth', () => {
  it('держит ширину в собственных пределах колонки', () => {
    expect(clampEditorColumnWidth('settings', 10, DEFAULT_EDITOR_COLUMN_WIDTHS)).toBe(
      EDITOR_COLUMN_LIMITS.settings.min
    );
    expect(clampEditorColumnWidth('preview', 5000, DEFAULT_EDITOR_COLUMN_WIDTHS)).toBe(
      EDITOR_COLUMN_LIMITS.preview.max
    );
  });

  it('оставляет полю минимальную ширину', () => {
    const total = 1400;
    const width = clampEditorColumnWidth('settings', 600, DEFAULT_EDITOR_COLUMN_WIDTHS, total);

    expect(width).toBe(total - DEFAULT_EDITOR_COLUMN_WIDTHS.preview - EDITOR_WORKSPACE_MIN_WIDTH);
  });

  it('не опускается ниже минимума колонки даже в тесном окне', () => {
    expect(clampEditorColumnWidth('preview', 500, DEFAULT_EDITOR_COLUMN_WIDTHS, 800)).toBe(
      EDITOR_COLUMN_LIMITS.preview.min
    );
  });
});

describe('editor column widths storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('без записи отдаёт ширины по умолчанию', () => {
    expect(readEditorColumnWidths()).toEqual(DEFAULT_EDITOR_COLUMN_WIDTHS);
  });

  it('читает записанные ширины', () => {
    writeEditorColumnWidths({ settings: 300, preview: 500 });

    expect(readEditorColumnWidths()).toEqual({ settings: 300, preview: 500 });
  });

  it('битую запись заменяет значениями по умолчанию', () => {
    window.localStorage.setItem(STORAGE_KEYS.editorColumnWidths, '{"settings":"x","preview":1e9}');

    expect(readEditorColumnWidths()).toEqual({
      settings: DEFAULT_EDITOR_COLUMN_WIDTHS.settings,
      preview: EDITOR_COLUMN_LIMITS.preview.max,
    });
  });
});

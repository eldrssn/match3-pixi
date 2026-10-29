import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LEVEL_TITLE_MAX_LENGTH } from '@/entities/game';
import { DEFAULT_LEVEL_PACK } from '@/entities/level';
import { EDITOR_WORKSPACE_STORAGE_KEY, writeEditorWorkspace } from './editorWorkspace';
import { EDITOR_WORKSPACE_SAVE_DELAY_MS } from './useEditorWorkspace';
import { useLevelConfigEditor } from './useLevelConfigEditor';

describe('useLevelConfigEditor history', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('continuous JSON typing is one undo step', () => {
    const { result } = renderHook(useLevelConfigEditor);
    const initialMoves = result.current.editConfig.moves;
    const typeMoves = (moves: number) =>
      act(() => result.current.importJson(JSON.stringify({ ...result.current.editConfig, moves })));

    typeMoves(7);
    typeMoves(71);
    typeMoves(712);

    expect(result.current.editConfig.moves).toBe(712);

    act(() => result.current.undo());

    expect(result.current.editConfig.moves).toBe(initialMoves);
    expect(result.current.canUndo).toBe(false);
  });

  it('an edit that returns the same config writes no history step', () => {
    const { result } = renderHook(useLevelConfigEditor);

    act(() => result.current.updateEditConfig(result.current.editConfig));

    expect(result.current.canUndo).toBe(false);
  });
});

describe('useLevelConfigEditor pack', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('opens the main pack and edits its level straight into the pack draft', () => {
    const { result } = renderHook(useLevelConfigEditor);

    expect(result.current.pack.id).toBe(DEFAULT_LEVEL_PACK.id);
    expect(result.current.editConfig).toBe(DEFAULT_LEVEL_PACK.levels[0]);

    act(() => result.current.openLevel(2));
    act(() => result.current.updateEditConfig({ ...result.current.editConfig, moves: 99 }));

    expect(result.current.pack.levels[2].moves).toBe(99);
    expect(result.current.activePackOption?.hasDraft).toBe(true);
  });

  it('switching the level forgets the history of the previous one and plays the new one', () => {
    const { result } = renderHook(useLevelConfigEditor);
    const revision = result.current.appliedConfigRevision;

    act(() => result.current.updateEditConfig({ ...result.current.editConfig, moves: 42 }));
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.openLevel(1));

    expect(result.current.canUndo).toBe(false);
    expect(result.current.appliedConfig).toEqual(DEFAULT_LEVEL_PACK.levels[1]);
    expect(result.current.appliedConfigRevision).toBe(revision + 1);
  });

  it('a level number is its position: adding a level renumbers the rest', () => {
    const { result } = renderHook(useLevelConfigEditor);

    act(() => result.current.addLevel());

    expect(result.current.levelIndex).toBe(1);
    expect(result.current.pack.levels.map((level) => level.id)).toEqual(
      Array.from({ length: DEFAULT_LEVEL_PACK.levels.length + 1 }, (_, index) => index + 1)
    );
    expect(result.current.pack.levels[2].title).toBe(DEFAULT_LEVEL_PACK.levels[1].title);
  });
});

describe('useLevelConfigEditor persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const storedText = () => window.localStorage.getItem(EDITOR_WORKSPACE_STORAGE_KEY) ?? '';

  it('writes the workspace after a pause, not on every edit', () => {
    const { result } = renderHook(useLevelConfigEditor);

    act(() => result.current.updateEditConfig({ ...result.current.editConfig, moves: 98 }));
    act(() =>
      result.current.updateEditConfig({ ...result.current.editConfig, moves: 99 }, { merge: true })
    );

    expect(storedText()).not.toContain('"moves":99');

    act(() => {
      vi.advanceTimersByTime(EDITOR_WORKSPACE_SAVE_DELAY_MS);
    });

    expect(storedText()).toContain('"moves":99');
  });

  it('flushes a pending write on pagehide and on unmount', () => {
    const { result, unmount } = renderHook(useLevelConfigEditor);

    act(() => result.current.updateEditConfig({ ...result.current.editConfig, moves: 77 }));
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(storedText()).toContain('"moves":77');

    act(() => result.current.updateEditConfig({ ...result.current.editConfig, moves: 66 }));
    unmount();

    expect(storedText()).toContain('"moves":66');
  });
});

describe('useLevelConfigEditor preview', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('a broken draft from storage is not applied to the preview', () => {
    writeEditorWorkspace({
      drafts: [
        {
          id: DEFAULT_LEVEL_PACK.id,
          title: DEFAULT_LEVEL_PACK.title,
          // Длинное название нормализация оставляет, а валидация отвергает.
          levels: [
            { ...DEFAULT_LEVEL_PACK.levels[0], title: 'Я'.repeat(LEVEL_TITLE_MAX_LENGTH + 1) },
          ],
        },
      ],
      packId: DEFAULT_LEVEL_PACK.id,
      levelIndex: 0,
    });

    const { result } = renderHook(useLevelConfigEditor);

    expect(result.current.validationErrors.length).toBeGreaterThan(0);
    expect(result.current.appliedConfig).toBeNull();
  });

  it('a valid level is applied to the preview right away', () => {
    const { result } = renderHook(useLevelConfigEditor);

    expect(result.current.appliedConfig).toEqual(DEFAULT_LEVEL_PACK.levels[0]);
  });
});

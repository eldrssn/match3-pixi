import { describe, expect, it } from 'vitest';
import { INITIAL_MINIGAME_LEVEL_CONFIG } from '@/entities/game';
import type { ILevelPack } from '@/entities/level';
import {
  addPackLevel,
  canRenamePack,
  createEditorPack,
  createEditorWorkspace,
  discardPackDraft,
  duplicatePackLevel,
  EDITOR_WORKSPACE_STORAGE_KEY,
  importEditorPack,
  listEditorPackOptions,
  movePackLevel,
  readEditorWorkspace,
  removePackLevel,
  replaceActiveLevel,
  resolveActivePack,
  writeEditorWorkspace,
  type IEditorWorkspace,
} from './editorWorkspace';

const level = (id: number, title?: string) => ({
  ...INITIAL_MINIGAME_LEVEL_CONFIG,
  id,
  ...(title ? { title } : {}),
});

const REPO: readonly ILevelPack[] = [
  { id: 'main', title: 'Основной', levels: [level(1, 'А'), level(2, 'Б'), level(3, 'В')] },
];

const titles = (workspace: IEditorWorkspace) =>
  resolveActivePack(workspace, REPO).levels.map((item) => `${item.id}${item.title ?? ''}`);

const memoryStorage = (): Storage => {
  const items = new Map<string, string>();

  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, value),
  };
};

describe('editorWorkspace', () => {
  it('shows a repo pack as is until the first edit, then edits a copy', () => {
    const workspace = createEditorWorkspace();

    expect(resolveActivePack(workspace, REPO).levels[0]).toBe(REPO[0].levels[0]);

    const edited = replaceActiveLevel(workspace, REPO, { ...level(1, 'А'), moves: 3 });

    expect(edited.drafts).toHaveLength(1);
    expect(resolveActivePack(edited, REPO).levels[0].moves).toBe(3);
    expect(REPO[0].levels[0].moves).toBe(INITIAL_MINIGAME_LEVEL_CONFIG.moves);
  });

  it('adds and duplicates right after the open level, numbers follow positions', () => {
    const opened = { ...createEditorWorkspace(), levelIndex: 0 };
    const added = addPackLevel(opened, REPO);

    expect(added.levelIndex).toBe(1);
    expect(titles(added)).toEqual(['1А', '2', '3Б', '4В']);

    const duplicated = duplicatePackLevel({ ...opened, levelIndex: 2 }, REPO);

    expect(duplicated.levelIndex).toBe(3);
    expect(titles(duplicated)).toEqual(['1А', '2Б', '3В', '4В']);
  });

  it('moves the open level with its neighbour and stops at the pack edges', () => {
    const workspace = { ...createEditorWorkspace(), levelIndex: 1 };
    const moved = movePackLevel(workspace, REPO, 1);

    expect(moved.levelIndex).toBe(2);
    expect(titles(moved)).toEqual(['1А', '2В', '3Б']);

    const atStart = { ...workspace, levelIndex: 0 };

    expect(movePackLevel(atStart, REPO, -1)).toBe(atStart);
  });

  it('removes the open level but never the last one', () => {
    const removed = removePackLevel({ ...createEditorWorkspace(), levelIndex: 2 }, REPO);

    expect(removed.levelIndex).toBe(1);
    expect(titles(removed)).toEqual(['1А', '2Б']);

    const single = importEditorPack(createEditorWorkspace(), {
      id: 'one',
      title: 'Один',
      levels: [level(1)],
    });

    expect(removePackLevel(single, REPO)).toBe(single);
  });

  it('creates and renames new packs, but never takes or renames a repo pack', () => {
    const created = createEditorPack(createEditorWorkspace(), REPO);

    expect(created.packId).toBe('pack-2');
    expect(canRenamePack(created, REPO, 'main')).toBe(false);
    expect(canRenamePack(created, REPO, 'winter')).toBe(true);
    expect(canRenamePack(createEditorWorkspace(), REPO, 'winter')).toBe(false);
    expect(listEditorPackOptions(created, REPO)).toEqual([
      { id: 'main', title: 'Основной', isInRepo: true, hasDraft: false },
      { id: 'pack-2', title: 'Новый пак', isInRepo: false, hasDraft: true },
    ]);
  });

  it('renames only to a valid pack id', () => {
    const created = createEditorPack(createEditorWorkspace(), REPO);

    expect(canRenamePack(created, REPO, 'winter_2-a')).toBe(true);
    expect(canRenamePack(created, REPO, '')).toBe(false);
    expect(canRenamePack(created, REPO, 'Winter')).toBe(false);
    expect(canRenamePack(created, REPO, 'зима')).toBe(false);
    expect(canRenamePack(created, REPO, 'win ter')).toBe(false);
    expect(canRenamePack(created, REPO, 'x'.repeat(33))).toBe(false);
  });

  it('a stale packId falls back to the main pack, which cannot be renamed', () => {
    const stale: IEditorWorkspace = { ...createEditorWorkspace(), packId: 'gone' };

    expect(resolveActivePack(stale, REPO).id).toBe('main');
    expect(canRenamePack(stale, REPO, 'winter')).toBe(false);
    expect(canRenamePack(stale, REPO, 'gone')).toBe(false);
  });

  it('a draft id is taken for another new pack', () => {
    const first = createEditorPack(createEditorWorkspace(), REPO);
    const second = createEditorPack(first, REPO);

    expect(second.packId).toBe('pack-3');
    expect(canRenamePack(second, REPO, 'pack-2')).toBe(false);
    expect(canRenamePack(second, REPO, 'pack-3')).toBe(true);
  });

  it('discarding a draft restores the repo pack or drops a new one', () => {
    const edited = replaceActiveLevel(createEditorWorkspace(), REPO, level(1, 'Х'));

    expect(titles(discardPackDraft(edited, REPO))).toEqual(['1А', '2Б', '3В']);

    const created = createEditorPack(createEditorWorkspace(), REPO);
    const dropped = discardPackDraft(created, REPO);

    expect(dropped.drafts).toEqual([]);
    expect(dropped.packId).toBe('main');
  });

  it('a written workspace reads back as is', () => {
    const storage = memoryStorage();
    const workspace = createEditorPack(createEditorWorkspace(), REPO);

    writeEditorWorkspace(workspace, storage);

    expect(readEditorWorkspace(storage)).toEqual(workspace);
  });

  it('a broken record is an empty workspace, not a crash', () => {
    const storage = memoryStorage();

    storage.setItem(EDITOR_WORKSPACE_STORAGE_KEY, '{oops');

    expect(readEditorWorkspace(storage)).toEqual(createEditorWorkspace());
    expect(readEditorWorkspace(null)).toEqual(createEditorWorkspace());
  });
});

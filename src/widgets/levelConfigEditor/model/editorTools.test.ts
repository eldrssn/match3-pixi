import { describe, expect, it } from 'vitest';
import { MINIGAME_ELEMENT_IDS } from '@/entities/game';
import { getElementLabel } from '@/entities/skin';
import {
  applyEditorTool,
  describeGridCell,
  EDITOR_TOOL_GROUPS,
  EDITOR_TOOLS,
  explainToolRefusal,
  listEditorToolGroups,
  parseEditorToolId,
  resolveActiveToolId,
  resolveSpecialToolId,
  resolveToolElementId,
} from './editorTools';

describe('EDITOR_TOOLS', () => {
  it('splits the palette into chips, helpers, blockers and tools without losing any', () => {
    const groups = Object.fromEntries(
      EDITOR_TOOL_GROUPS.map(({ group, tools }) => [group, tools.map((tool) => tool.id)])
    );

    expect(groups.helpers).toEqual([
      'laserHorizontal',
      'laserVertical',
      'bomb',
      'propeller',
      'rainbow',
    ]);
    expect(groups.tools).toEqual(['HOLE', 'erase']);
    expect(groups.blockers).not.toContain('HOLE');
    expect(EDITOR_TOOL_GROUPS.flatMap(({ tools }) => tools)).toHaveLength(EDITOR_TOOLS.length);
  });

  it('gives every helper its origin shape and hit area', () => {
    for (const tool of EDITOR_TOOLS.filter(({ group }) => group === 'helpers')) {
      expect(tool.origin).toBeTruthy();
      expect(tool.area).toBeTruthy();
    }
  });

  it('builds a tool for every format element from the skin registry', () => {
    const covered = new Set(EDITOR_TOOLS.map(({ id }) => resolveToolElementId(id)));

    expect(MINIGAME_ELEMENT_IDS.filter((id) => !covered.has(id))).toEqual([]);
    expect(EDITOR_TOOLS.find(({ id }) => id === 'stone')?.label).toBe(getElementLabel('stone'));
  });
});

describe('resolveToolElementId', () => {
  it('maps both rocket axes to the laser element and the eraser to nothing', () => {
    expect(resolveToolElementId('laserHorizontal')).toBe('laser');
    expect(resolveToolElementId('laserVertical')).toBe('laser');
    expect(resolveToolElementId('cargo')).toBe('cargo');
    expect(resolveToolElementId('erase')).toBeNull();
  });
});

describe('applyEditorTool', () => {
  it('places a chip like a palette drop', () => {
    expect(applyEditorTool({ id: '', floor: 1 }, 'red')).toEqual({ id: 'red', floor: 1 });
  });

  it('places helpers with the rocket axis, keeping the floor and dropping the overlay', () => {
    expect(applyEditorTool({ id: 'red', overlay: 'ice', floor: 2 }, 'laserVertical')).toEqual({
      id: 'laser',
      direction: 'vertical',
      floor: 2,
    });
    expect(applyEditorTool({ id: 'red' }, 'rainbow')).toEqual({ id: 'rainbow' });
  });

  it('erases the top layer', () => {
    expect(applyEditorTool({ id: 'red', overlay: 'chain' }, 'erase')).toEqual({ id: 'red' });
  });

  it('toggles on click but only sets while stroking', () => {
    const iced = { id: 'red', overlay: 'ice' } as const;

    expect(applyEditorTool(iced, 'ice', 'click')).toEqual({ id: 'red' });
    expect(applyEditorTool(iced, 'ice', 'stroke')).toEqual(iced);
    expect(applyEditorTool({ id: 'red' }, 'ice', 'stroke')).toEqual(iced);

    expect(applyEditorTool({ id: 'cargo', layers: 2 }, 'cargo', 'click')).toEqual({
      id: 'cargo',
      layers: 3,
    });
    expect(applyEditorTool({ id: 'cargo', layers: 2 }, 'cargo', 'stroke')).toEqual({
      id: 'cargo',
      layers: 2,
    });

    expect(applyEditorTool({ id: 'red', floor: 1 }, 'floor', 'stroke')).toEqual({
      id: 'red',
      floor: 1,
    });
  });
});

describe('explainToolRefusal', () => {
  it('warns when an overlay or a floor has nowhere to go', () => {
    expect(explainToolRefusal({ id: 'stone' }, 'ice')).toBe('Лёд ложится только на фишку');
    expect(explainToolRefusal({ id: 'HOLE' }, 'floor')).toBe('Под дырой подложки не бывает');
    expect(explainToolRefusal({ id: 'random' }, 'chain')).toBeNull();
    expect(explainToolRefusal({ id: 'stone' }, 'bomb')).toBeNull();
  });
});

describe('resolveSpecialToolId', () => {
  it('maps a placed helper back to its tool', () => {
    expect(resolveSpecialToolId({ id: 'laser' })).toBe('laserHorizontal');
    expect(resolveSpecialToolId({ id: 'laser', direction: 'vertical' })).toBe('laserVertical');
    expect(resolveSpecialToolId({ id: 'propeller' })).toBe('propeller');
    expect(resolveSpecialToolId({ id: 'red' })).toBeNull();
  });
});

describe('parseEditorToolId', () => {
  it('accepts tool ids and rejects any other dropped text', () => {
    expect(parseEditorToolId('chain')).toBe('chain');
    expect(parseEditorToolId('laserVertical')).toBe('laserVertical');
    expect(parseEditorToolId('https://example.com')).toBeNull();
    expect(parseEditorToolId('')).toBeNull();
    expect(parseEditorToolId('toString')).toBeNull();
  });
});

describe('listEditorToolGroups', () => {
  it('shows only the level colors among chips and keeps every other tool', () => {
    const groups = listEditorToolGroups(['green', 'blue']);
    const chips = groups.find(({ group }) => group === 'chips')?.tools.map(({ id }) => id);

    expect(chips).toEqual(['green', 'blue', 'random']);
    expect(groups.flatMap(({ tools }) => tools)).toHaveLength(EDITOR_TOOLS.length - 4);
  });
});

describe('resolveActiveToolId', () => {
  it('moves the brush off a color the level no longer has', () => {
    expect(resolveActiveToolId('red', ['red', 'blue'])).toBe('red');
    expect(resolveActiveToolId('yellow', ['green', 'blue', 'red'])).toBe('green');
    expect(resolveActiveToolId('yellow', [])).toBe('random');
    expect(resolveActiveToolId('stone', [])).toBe('stone');
  });
});

describe('describeGridCell', () => {
  it('lists layers from top to bottom', () => {
    expect(describeGridCell({ id: 'cargo', layers: 3, floor: 1 })).toBe('Ящик ×3 / Подложка ×1');
    expect(describeGridCell({ id: '' })).toBe('Пусто');
  });

  it('names a special chip by the tool that places it', () => {
    expect(describeGridCell({ id: 'laser', direction: 'vertical' })).toBe('Ракета ↕');
    expect(describeGridCell({ id: 'bomb', floor: 2 })).toBe('Бомба / Подложка ×2');
  });
});

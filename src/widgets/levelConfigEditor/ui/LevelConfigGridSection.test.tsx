import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { IMinigameLevelConfig } from '@/entities/game';
import type { TEditorToolId } from '../model/editorTools';
import { LevelConfigGridSection } from './LevelConfigGridSection';

// В jsdom нет `PointerEvent`: без него `fireEvent.pointerDown` собирает
// голый `Event`, и `button` до обработчика не доходит.
if (typeof window.PointerEvent === 'undefined') {
  window.PointerEvent = class extends MouseEvent {} as typeof PointerEvent;
}

const config: IMinigameLevelConfig = {
  formatVersion: 2,
  id: 1,
  moves: 10,
  colors: ['red', 'blue', 'green'],
  levelGoals: [],
  grid: [
    [{ id: 'red' }, { id: 'blue' }],
    [{ id: 'green' }, { id: 'red', overlay: 'ice' }],
  ],
};

const renderGrid = (toolId: TEditorToolId = 'stone', gridConfig = config) => {
  const onChange = vi.fn();

  render(
    <LevelConfigGridSection
      config={gridConfig}
      toolId={toolId}
      canUndo={false}
      canRedo={false}
      onChange={onChange}
      onUndo={vi.fn()}
      onRedo={vi.fn()}
      onRegenerateChips={vi.fn()}
      onGenerate={vi.fn()}
      onRandomize={vi.fn()}
      onClear={vi.fn()}
    />
  );

  return onChange;
};

const cell = (name: RegExp) => screen.getByRole('button', { name });

describe('LevelConfigGridSection', () => {
  it('places the selected tool on click', () => {
    const onChange = renderGrid();

    fireEvent.pointerDown(cell(/^0:0 /), { button: 0 });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ grid: [[{ id: 'stone' }, { id: 'blue' }], config.grid[1]] })
    );
  });

  it('erases the top layer on right click', () => {
    const onChange = renderGrid();

    fireEvent.pointerDown(cell(/^1:1 /), { button: 2 });

    expect(onChange.mock.calls[0][0].grid[1][1]).toEqual({ id: 'red' });
  });

  it('paints every cell of a stroke as one merged edit', () => {
    const onChange = renderGrid();

    fireEvent.pointerDown(cell(/^0:0 /), { button: 0 });
    fireEvent.pointerEnter(cell(/^0:1 /), { buttons: 1 });
    fireEvent.pointerEnter(cell(/^1:0 /), { buttons: 1 });
    fireEvent.pointerUp(window);
    fireEvent.pointerEnter(cell(/^1:1 /), { buttons: 1 });

    expect(onChange).toHaveBeenCalledTimes(3);
    expect(onChange.mock.calls[2][1]).toEqual({ merge: true });
    expect(onChange.mock.calls[2][0].grid).toEqual([
      [{ id: 'stone' }, { id: 'stone' }],
      [{ id: 'stone' }, { id: 'red', overlay: 'ice' }],
    ]);
  });

  it('ends the stroke when the button was released outside the window', () => {
    const onChange = renderGrid();

    fireEvent.pointerDown(cell(/^0:0 /), { button: 0 });
    fireEvent.pointerEnter(cell(/^0:1 /), { buttons: 0 });
    fireEvent.pointerEnter(cell(/^1:0 /), { buttons: 1 });

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('a refused first cell does not merge the stroke into the previous edit', () => {
    const onChange = renderGrid('ice', {
      ...config,
      grid: [[{ id: 'stone' }, { id: 'blue' }], config.grid[1]],
    });

    fireEvent.pointerDown(cell(/^0:0 /), { button: 0 });

    expect(onChange).not.toHaveBeenCalled();

    fireEvent.pointerEnter(cell(/^0:1 /), { buttons: 1 });
    fireEvent.pointerEnter(cell(/^1:0 /), { buttons: 1 });

    expect(onChange.mock.calls[0]).toHaveLength(1);
    expect(onChange.mock.calls[0][0].grid[0][1]).toEqual({ id: 'blue', overlay: 'ice' });
    expect(onChange.mock.calls[1][1]).toEqual({ merge: true });
  });

  it('shows the hovered cell and why the tool does not fit', () => {
    renderGrid();

    fireEvent.pointerEnter(cell(/^1:1 /));

    expect(screen.getByText('1:1 · Лёд / Красная')).toBeInTheDocument();
  });
});

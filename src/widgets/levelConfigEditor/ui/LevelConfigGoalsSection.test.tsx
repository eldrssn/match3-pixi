import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { IMinigameLevelConfig } from '@/entities/game';
import { LevelConfigGoalsSection } from './LevelConfigGoalsSection';

// В jsdom нет `scrollIntoView`: список докручивает до активного пункта.
Element.prototype.scrollIntoView = vi.fn();

const config: IMinigameLevelConfig = {
  formatVersion: 2,
  id: 1,
  moves: 10,
  colors: ['red', 'blue', 'green'],
  levelGoals: [],
  grid: [[{ id: 'red' }]],
};

const renderSection = () => {
  const onChange = vi.fn();

  render(<LevelConfigGoalsSection config={config} onChange={onChange} />);

  return { onChange };
};

describe('LevelConfigGoalsSection', () => {
  it('shows palette icons in the goal list and adds the picked goal', () => {
    const { onChange } = renderSection();

    fireEvent.click(screen.getByRole('button', { name: /Элемент/ }));

    const option = screen.getByRole('option', { name: 'Красная' });

    expect(option.querySelector('img')).not.toBeNull();

    fireEvent.click(option);
    expect(screen.queryByRole('listbox')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ levelGoals: [{ id: 'red', count: 10 }] })
    );
  });

  it('picks a goal from the keyboard', () => {
    const { onChange } = renderSection();
    const trigger = screen.getByRole('button', { name: /Элемент/ });

    fireEvent.keyDown(trigger, { key: 'ArrowDown' });

    const listbox = screen.getByRole('listbox');

    expect(document.activeElement).toBe(listbox);

    fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    fireEvent.keyDown(listbox, { key: 'Enter' });

    expect(document.activeElement).toBe(trigger);
    expect(trigger).toHaveAccessibleName('Элемент Красная');

    fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ levelGoals: [{ id: 'red', count: 10 }] })
    );
  });
});

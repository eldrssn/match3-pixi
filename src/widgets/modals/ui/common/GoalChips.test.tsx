import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GoalChips } from './GoalChips';

describe('GoalChips', () => {
  it('подписывает каждую цель так, что её можно прочитать без иконки', () => {
    render(
      <GoalChips
        goals={[
          { id: 'cargo', count: 5 },
          { id: 'red', count: 12 },
        ]}
      />
    );

    const items = screen.getAllByRole('listitem');

    expect(items.map((item) => item.textContent)).toEqual(['5', '12']);
    expect(screen.getByRole('img', { name: 'Ящик' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Красная' })).toBeTruthy();
  });
});

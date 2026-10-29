import { describe, expect, it, vi } from 'vitest';
import { RuntimeInput } from './RuntimeInput';

describe('RuntimeInput', () => {
  it('выставляет eventMode корня по стартовому состоянию', () => {
    const root = { eventMode: 'auto' };

    new RuntimeInput(root, false);
    expect(root.eventMode).toBe('none');

    new RuntimeInput(root, true);
    expect(root.eventMode).toBe('static');
  });

  it('сбрасывает жесты на реальном переходе замка', () => {
    const root = { eventMode: 'auto' };
    const input = new RuntimeInput(root, true);
    const reset = vi.fn();

    input.addResetHook(reset);
    input.setEnabled(false);

    expect(reset).toHaveBeenCalledTimes(1);
    expect(root.eventMode).toBe('none');

    input.setEnabled(true);

    expect(reset).toHaveBeenCalledTimes(2);
    expect(root.eventMode).toBe('static');
  });

  it('не обрывает жест при повторной установке того же состояния', () => {
    const input = new RuntimeInput({ eventMode: 'auto' }, true);
    const reset = vi.fn();

    input.addResetHook(reset);
    input.setEnabled(true);

    expect(reset).not.toHaveBeenCalled();
  });

  it('отписанный и упавший сброс не мешают остальным', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const input = new RuntimeInput({ eventMode: 'auto' }, true);
    const removed = vi.fn();
    const survivor = vi.fn();

    input.addResetHook(() => {
      throw new Error('boom');
    });
    input.addResetHook(removed)();
    input.addResetHook(survivor);
    input.setEnabled(false);

    expect(removed).not.toHaveBeenCalled();
    expect(survivor).toHaveBeenCalledTimes(1);

    consoleError.mockRestore();
  });
});

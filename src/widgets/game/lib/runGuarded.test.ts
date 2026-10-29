import { describe, expect, it, vi } from 'vitest';
import { runGuarded } from './runGuarded';

describe('runGuarded', () => {
  it('ловит асинхронный сбой и зовёт onFailure', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onFailure = vi.fn();
    const error = new Error('boom');

    runGuarded('swap', () => Promise.reject(error), onFailure);
    await Promise.resolve();
    await Promise.resolve();

    expect(onFailure).toHaveBeenCalledWith(error);
    expect(consoleError).toHaveBeenCalledWith('[game] swap failed', error);

    consoleError.mockRestore();
  });

  it('ловит синхронное исключение до первого await', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onFailure = vi.fn();

    expect(() =>
      runGuarded(
        'tap',
        () => {
          throw new Error('sync');
        },
        onFailure
      )
    ).not.toThrow();
    expect(onFailure).toHaveBeenCalledTimes(1);

    consoleError.mockRestore();
  });
});

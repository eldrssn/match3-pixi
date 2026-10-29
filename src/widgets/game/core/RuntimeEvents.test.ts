import { describe, expect, it, vi } from 'vitest';
import { RuntimeEvents } from './RuntimeEvents';

interface ITestEvents {
  ping: number;
  pause: undefined;
}

describe('RuntimeEvents', () => {
  it('доставляет payload подписчикам и отписывает', () => {
    const events = new RuntimeEvents<ITestEvents>();
    const listener = vi.fn();
    const off = events.on('ping', listener);

    events.emit('ping', 1);
    off();
    events.emit('ping', 2);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(1);
  });

  it('once срабатывает один раз', () => {
    const events = new RuntimeEvents<ITestEvents>();
    const listener = vi.fn();

    events.once('pause', listener);
    events.emit('pause');
    events.emit('pause');

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('упавший подписчик не роняет остальных и эмиттер', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const events = new RuntimeEvents<ITestEvents>();
    const survivor = vi.fn();

    events.on('ping', () => {
      throw new Error('boom');
    });
    events.on('ping', survivor);

    expect(() => events.emit('ping', 3)).not.toThrow();
    expect(survivor).toHaveBeenCalledWith(3);
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it('clear снимает всех', () => {
    const events = new RuntimeEvents<ITestEvents>();
    const listener = vi.fn();

    events.on('ping', listener);
    events.clear();
    events.emit('ping', 1);

    expect(listener).not.toHaveBeenCalled();
  });
});

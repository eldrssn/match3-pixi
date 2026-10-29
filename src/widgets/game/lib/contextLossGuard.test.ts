import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTEXT_RESTORE_TIMEOUT_MS, createContextLossGuard } from './contextLossGuard';

describe('createContextLossGuard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const setup = (isLost: () => boolean = () => true) => {
    const onLostChange = vi.fn();
    const onFail = vi.fn();
    const guard = createContextLossGuard({ isStillLost: isLost, onLostChange, onFail });

    return { guard, onLostChange, onFail };
  };

  it('потеря без восстановления - отказ по таймауту', () => {
    const { guard, onLostChange, onFail } = setup();

    guard.lost();
    expect(onLostChange).toHaveBeenLastCalledWith(true);

    vi.advanceTimersByTime(CONTEXT_RESTORE_TIMEOUT_MS - 1);
    expect(onFail).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onFail).toHaveBeenCalledTimes(1);
  });

  it('восстановление снимает потерю и таймер', () => {
    const { guard, onLostChange, onFail } = setup();

    guard.lost();
    guard.restored();
    vi.advanceTimersByTime(CONTEXT_RESTORE_TIMEOUT_MS);

    expect(onLostChange).toHaveBeenLastCalledWith(false);
    expect(onFail).not.toHaveBeenCalled();
  });

  it('догнавший восстановленный контекст таймер ничего не роняет', () => {
    let isLost = true;
    const { guard, onFail } = setup(() => isLost);

    guard.lost();
    isLost = false;
    vi.advanceTimersByTime(CONTEXT_RESTORE_TIMEOUT_MS);

    expect(onFail).not.toHaveBeenCalled();
  });

  it('после dispose молчит', () => {
    const { guard, onLostChange, onFail } = setup();

    guard.lost();
    guard.dispose();
    guard.lost();
    vi.advanceTimersByTime(CONTEXT_RESTORE_TIMEOUT_MS);

    expect(onLostChange).toHaveBeenCalledTimes(1);
    expect(onFail).not.toHaveBeenCalled();
  });
});

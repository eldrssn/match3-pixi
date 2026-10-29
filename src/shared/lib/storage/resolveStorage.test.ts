import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveStorage } from './resolveStorage';

describe('resolveStorage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('отдаёт localStorage окна', () => {
    expect(resolveStorage()).toBe(window.localStorage);
  });

  it('отдаёт null, когда браузер запретил хранилище', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(resolveStorage()).toBeNull();
  });
});

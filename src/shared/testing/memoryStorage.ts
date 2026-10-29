/**
 * Минимальная in-memory реализация `Storage` для тестовой среды: jsdom в
 * текущей конфигурации не отдаёт `window.localStorage`, а на него опирается
 * локальный прогресс уровней (`entities/level`).
 *
 * Экземпляр не наследует `Storage.prototype`: сбой хранилища в тестах
 * имитируется шпионом на самом `localStorage`, а не на прототипе.
 */
export class MemoryStorage implements Storage {
  private readonly store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

export const installMemoryStorage = (key: 'localStorage' | 'sessionStorage'): void => {
  if (window[key]) {
    return;
  }

  Object.defineProperty(window, key, {
    configurable: true,
    value: new MemoryStorage(),
  });
};

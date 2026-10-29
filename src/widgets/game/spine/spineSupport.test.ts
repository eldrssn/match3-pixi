import { describe, expect, it, vi } from 'vitest';
import type { ISkinSpineView } from '@/entities/skin';
import { loadSpineSupport, type ISpineRuntimeModule, type ISpineSupport } from './spineSupport';

const VIEW: ISkinSpineView = {
  kind: 'spine',
  skeleton: '/spine/chip.skel',
  atlas: { url: '/spine/chip.atlas' },
  width: 100,
  animations: { idle: 'idle' },
};

describe('loadSpineSupport', () => {
  it('скин по умолчанию без вида spine - чанк spine не запрашивается', async () => {
    const importRuntime = vi.fn<() => Promise<ISpineRuntimeModule>>();

    await expect(loadSpineSupport(undefined, importRuntime)).resolves.toBeNull();
    expect(importRuntime).not.toHaveBeenCalled();
  });

  it('вид spine в скине - импорт чанка и загрузка всех скелетов до сцены', async () => {
    const support: ISpineSupport = { createActor: vi.fn() };
    const createSpineSupport = vi.fn(async () => support);
    const importRuntime = vi.fn(async () => ({ createSpineSupport }));

    await expect(loadSpineSupport([VIEW], importRuntime)).resolves.toBe(support);
    expect(importRuntime).toHaveBeenCalledTimes(1);
    expect(createSpineSupport).toHaveBeenCalledWith([VIEW]);
  });

  it('ошибка загрузки скелета не глотается: загрузчик партии откажет хосту', async () => {
    const importRuntime = async () => ({
      createSpineSupport: async (): Promise<ISpineSupport> => {
        throw new Error('нет анимаций: idle');
      },
    });

    await expect(loadSpineSupport([VIEW], importRuntime)).rejects.toThrow('idle');
  });
});

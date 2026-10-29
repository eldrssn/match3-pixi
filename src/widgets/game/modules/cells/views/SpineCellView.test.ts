import { Container } from 'pixi.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getElementTexture, skinTextureWidth, type ISkinSpineView } from '@/entities/skin';
import type { GameRuntimeCore } from '../../../core/GameRuntimeCore';
import type { IBoardFx } from '../../../fx/boardFx';
import { RuntimeMotion } from '../../../motion/RuntimeMotion';
import type { ISpineActor, ISpineSupport } from '../../../spine/spineSupport';
import { CELL_VIEW_KINDS } from './cellViewKinds';
import type { ICellLook, ICellViewPlace } from './cellView';
import { SpineCellView } from './SpineCellView';

const SPEC: ISkinSpineView = {
  kind: 'spine',
  skeleton: '/spine/stone.json',
  atlas: { url: '/spine/stone.atlas' },
  width: 200,
  animations: { stages: ['crack', 'whole'], hit: 'hit', destroy: 'pop' },
};

/** Скелет-подделка: журнал анимаций, ручной конец прохода, учёт времени. */
class FakeActor implements ISpineActor {
  readonly display = new Container();
  readonly played: string[] = [];
  elapsedMs = 0;
  private finish: (() => void) | null = null;

  play(animation: string, loop: boolean): Promise<void> {
    this.finish?.();
    this.played.push(`${animation}${loop ? ':loop' : ''}`);

    return loop
      ? Promise.resolve()
      : new Promise((resolve) => {
          this.finish = resolve;
        });
  }

  complete(): void {
    const finish = this.finish;

    this.finish = null;
    finish?.();
  }

  update(deltaMs: number): void {
    this.elapsedMs += deltaMs;
  }

  destroy(): void {
    this.complete();
    this.display.destroy();
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

let motion: RuntimeMotion;

const setup = () => {
  motion = new RuntimeMotion();

  const actor = new FakeActor();
  const support: ISpineSupport = { createActor: vi.fn(() => actor) };
  const emitDestroyBurst = vi.fn();
  const place: ICellViewPlace = {
    runtime: {
      core: { motion, spine: support } as unknown as GameRuntimeCore,
      fx: { emitDestroyBurst } as unknown as IBoardFx,
    },
    container: new Container(),
    id: 'stone',
  };
  const look: ICellLook = { texture: () => getElementTexture('stone'), baseScale: 0.5 };

  return { actor, support, emitDestroyBurst, place, look };
};

afterEach(() => {
  motion.destroy();
});

describe('SpineCellView', () => {
  it('реестр видов создаёт для spine скелет из загруженной поддержки', () => {
    const { place, look, support } = setup();
    const view = CELL_VIEW_KINDS.spine(place, look, SPEC);

    expect(view).toBeInstanceOf(SpineCellView);
    view.create(10, 20, 2);
    expect(support.createActor).toHaveBeenCalledWith(SPEC);
    expect(view.display?.position).toMatchObject({ x: 10, y: 20 });
  });

  it('масштаб скелета - ширина текстуры покоя элемента на его ширину', () => {
    const { place, look } = setup();
    const view = new SpineCellView(place, look, SPEC);
    const expected = (0.5 * skinTextureWidth(getElementTexture('stone'))) / SPEC.width;

    view.create(0, 0, 1);
    expect(view.baseScale).toBeCloseTo(expected);
    expect(view.display?.scale.x).toBeCloseTo(expected);
  });

  it('без загруженного Spine - явная ошибка, а не пустая клетка', () => {
    const { place, look } = setup();
    const bare = { ...place, runtime: { ...place.runtime, core: { motion } as GameRuntimeCore } };

    expect(() => new SpineCellView(bare, look, SPEC).create(0, 0, 1)).toThrow('spine');
  });

  it('покой по стадии, удар - проход hit и покой новой стадии', async () => {
    const { place, look, actor } = setup();
    const view = new SpineCellView(place, look, SPEC);

    view.create(0, 0, 2);
    expect(actor.played).toEqual(['whole:loop']);

    view.hit(1);
    expect(actor.played.at(-1)).toBe('hit');

    actor.complete();
    await flush();
    expect(actor.played.at(-1)).toBe('crack:loop');
  });

  it('время скелета - часы рантайма: темп ускоряет, пауза останавливает', () => {
    const { place, look, actor } = setup();
    const view = new SpineCellView(place, look, SPEC);

    view.create(0, 0, 1);
    motion.update(10);
    motion.setTimeScale(2);
    motion.update(10);
    motion.pause();
    motion.update(10);

    expect(actor.elapsedMs).toBe(30);
  });

  it('разрушение - сноп частиц на старте и проход destroy до конца', async () => {
    const { place, look, actor, emitDestroyBurst } = setup();
    const view = new SpineCellView(place, look, SPEC);
    let isDone = false;

    view.create(5, 6, 1);

    const destroying = Promise.resolve(view.destroy()).then(() => {
      isDone = true;
    });

    expect(emitDestroyBurst).toHaveBeenCalledWith(5, 6, expect.any(Number));
    expect(actor.played.at(-1)).toBe('pop');
    await flush();
    expect(isDone).toBe(false);

    actor.complete();
    await destroying;
    expect(isDone).toBe(true);
  });

  it('dispose снимает скелет и отписывает его от часов', () => {
    const { place, look, actor } = setup();
    const view = new SpineCellView(place, look, SPEC);

    view.create(0, 0, 1);
    view.dispose();
    motion.update(16);

    expect(actor.display.destroyed).toBe(true);
    expect(actor.elapsedMs).toBe(0);
    expect(view.display).toBeNull();
  });
});

import { AnimatedSprite, Container, Texture } from 'pixi.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TSkinCellView } from '@/entities/skin';
import type { GameRuntimeCore } from '../../../core/GameRuntimeCore';
import type { IBoardFx } from '../../../fx/boardFx';
import { RuntimeMotion } from '../../../motion/RuntimeMotion';
import type { ICellLook, ICellViewPlace } from './cellView';
import { FrameCellView } from './FrameCellView';

type TFramesSpec = Extract<TSkinCellView, { kind: 'frames' }>;

/** Свой лист на клип: по `sprite.textures` видно, какой клип сейчас играет. */
const SHEETS: Record<string, Texture[]> = {
  idle: [Texture.WHITE, Texture.WHITE],
  hit: [Texture.WHITE, Texture.WHITE, Texture.WHITE],
  destroy: [Texture.WHITE, Texture.WHITE, Texture.WHITE, Texture.WHITE],
};

const SPEC: TFramesSpec = {
  kind: 'frames',
  clips: {
    idle: { texture: 'idle', frameRate: 10, repeat: -1 },
    hit: { texture: 'hit', frameRate: 10 },
    destroy: { texture: 'destroy', frameRate: 10 },
  },
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

let motion: RuntimeMotion;

const setup = () => {
  motion = new RuntimeMotion();

  const textures = { get: () => Texture.WHITE, frames: (key: string) => SHEETS[key] };
  const place: ICellViewPlace = {
    runtime: {
      core: { motion, textures } as unknown as GameRuntimeCore,
      fx: { emitDestroyBurst: vi.fn() } as unknown as IBoardFx,
    },
    container: new Container(),
    id: 'stone',
  };
  const look: ICellLook = { texture: () => 'stone', baseScale: 0.5 };
  const view = new FrameCellView(place, look, SPEC);

  view.create(0, 0, 2);

  const sprite = view.display;

  if (!(sprite instanceof AnimatedSprite)) {
    throw new Error('покадровый вид обязан создать AnimatedSprite');
  }

  return { view, sprite };
};

afterEach(() => {
  motion.destroy();
});

describe('FrameCellView', () => {
  it('после удара возвращается к клипу покоя', async () => {
    const { view, sprite } = setup();

    view.hit(1);
    expect(sprite.textures).toHaveLength(SHEETS.hit.length);

    motion.update(1000);
    await flush();
    expect(sprite.textures).toHaveLength(SHEETS.idle.length);
  });

  it('разрушение, сменившее удар, не обрывается возвратом к покою', async () => {
    const { view, sprite } = setup();

    view.hit(1);
    void view.destroy();
    await flush();

    expect(sprite.textures).toHaveLength(SHEETS.destroy.length);
  });
});

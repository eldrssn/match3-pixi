import { Particle, ParticleContainer, type Texture } from 'pixi.js';
import {
  resolveSpawnCount,
  spawnParticle,
  stepParticle,
  type IParticleConfig,
  type IParticleState,
} from '../lib/particleMotion';

interface ILiveParticle {
  state: IParticleState;
  sprite: Particle;
}

/**
 * Слой частиц одного вида: один `ParticleContainer` Pixi v8 (одна текстура,
 * один вызов отрисовки на слой) и пул `Particle`, физика - чистое
 * `lib/particleMotion`.
 *
 * Своего тикера у слоя нет: кадр двигает `fx/FxScene` с часов рантайма
 * (`RuntimeMotion.onFrame` с `timeScale: 'ignore'`), поэтому пауза партии
 * частицы останавливает, а темп доски (ускорение финала) на них не действует. Состав контейнера меняется только на рождении и смерти
 * частиц - тогда и зовётся `update()`; позиция, поворот, масштаб и цвет
 * объявлены динамическими и уходят в буфер каждый кадр.
 */
export class ParticleLayer {
  readonly view: ParticleContainer<Particle>;
  private readonly config: IParticleConfig;
  private readonly texture: Texture;
  private live: ILiveParticle[] = [];
  private readonly pool: Particle[] = [];
  private destroyed = false;

  constructor(texture: Texture, config: IParticleConfig, label: string) {
    this.texture = texture;
    this.config = config;
    this.view = new ParticleContainer<Particle>({
      label,
      texture,
      dynamicProperties: { position: true, rotation: true, vertex: true, color: true, uvs: false },
    });
  }

  get aliveCount(): number {
    return this.live.length;
  }

  get isDestroyed(): boolean {
    return this.destroyed || this.view.destroyed;
  }

  /** Пачка `count` частиц цвета `tint` в точке слоя (в пределах `maxAlive`). */
  emit(x: number, y: number, count: number, tint: number): void {
    if (this.isDestroyed) {
      return;
    }

    const spawn = resolveSpawnCount(this.config, this.live.length, count);

    for (let index = 0; index < spawn; index++) {
      const state = spawnParticle(this.config, x, y, tint);
      const sprite =
        this.pool.pop() ?? new Particle({ texture: this.texture, anchorX: 0.5, anchorY: 0.5 });

      sprite.tint = tint;
      this.apply(state, sprite);
      this.live.push({ state, sprite });
      this.view.particleChildren.push(sprite);
    }

    if (spawn > 0) {
      this.view.update();
    }
  }

  /** Кадр жизни всех частиц слоя. */
  update(deltaMs: number): void {
    if (this.isDestroyed || this.live.length === 0) {
      return;
    }

    let died = false;
    const survivors: ILiveParticle[] = [];

    for (const entry of this.live) {
      if (stepParticle(this.config, entry.state, deltaMs)) {
        this.apply(entry.state, entry.sprite);
        survivors.push(entry);
      } else {
        died = true;
        this.pool.push(entry.sprite);
      }
    }

    if (died) {
      this.live = survivors;
      this.view.particleChildren = survivors.map((entry) => entry.sprite);
      this.view.update();
    }
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.live = [];
    this.pool.length = 0;

    if (!this.view.destroyed) {
      this.view.destroy();
    }
  }

  private apply(state: IParticleState, sprite: Particle): void {
    sprite.x = state.x;
    sprite.y = state.y;
    sprite.rotation = state.rotation;
    sprite.scaleX = state.scaleX;
    sprite.scaleY = state.scaleY;
    sprite.alpha = state.alpha;
  }
}

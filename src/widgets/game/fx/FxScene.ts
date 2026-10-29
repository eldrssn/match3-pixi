import { Sprite, type Container, type Texture } from 'pixi.js';
import { SKIN } from '@/entities/skin';
import { BURST_PARTICLES, getRenderQuality } from '../configs/renderQuality';
import type { GameRuntimeCore } from '../core/GameRuntimeCore';
import { TILE_STEP_Y } from '../lib/boardGeometry';
import { advanceParticleFlow, type IParticleConfig } from '../lib/particleMotion';
import { addDisplayTween, destroyDisplay, type IDisplayTweenProps } from '../motion/displayMotion';
import type {
  IMotionTween,
  ITweenOptions,
  RuntimeMotion,
  TMotionProps,
} from '../motion/RuntimeMotion';
import type { IFallTrail } from './boardFx';
import { ParticleLayer } from './ParticleLayer';

/** Ключ текстуры частиц скина - общий для всех слоёв частиц. */
const PARTICLE_TEXTURE = 'particle';

/** Сноп разрушения клетки (эталон: `getBurstEmitter`). */
const BURST_CONFIG: IParticleConfig = {
  lifespan: { min: 320, max: 650 },
  speed: { min: 70, max: 200 },
  angle: { min: 0, max: 360 },
  gravityY: 350,
  rotate: { min: -180, max: 180 },
  scale: { start: 0.14, end: 0 },
  alpha: { start: 1, end: 0.4 },
};

/**
 * Потолок живых частиц хвоста падения - предохранитель fill-rate: на доске
 * крупнее 6x6 бюджет рос бы квадратично, на пределе впрыск пропускается.
 */
const FALL_TRAIL_MAX_ALIVE = 120;

/**
 * Хвост падения (эталон: `getFallTrailEmitter`): частица остаётся там, где
 * её оставила фишка, и вытянута по вертикали - цепочка читается смазом.
 */
const FALL_TRAIL_CONFIG: IParticleConfig = {
  lifespan: { min: 120, max: 190 },
  alpha: { start: 0.5, end: 0 },
  scaleX: { start: 0.07, end: 0.03 },
  scaleY: { start: 0.22, end: 0.1 },
  maxAlive: FALL_TRAIL_MAX_ALIVE,
};

/** С какой длины падения фишка оставляет за собой смаз (строки). */
const FALL_TRAIL_MIN_ROWS = 3;
/** Шаг впрыска по пути падения - полклетки: соседние частицы перекрываются. */
const FALL_TRAIL_STEP_PX = TILE_STEP_Y / 2;

/** Хвост летящего спрайта (эталон: `createFlightTrail`): конус против хода. */
const FLIGHT_TRAIL_CONFIG: IParticleConfig = {
  speed: { min: 50, max: 140 },
  angle: { min: 140, max: 220 },
  lifespan: { min: 500, max: 1200 },
  scale: { min: 0.05, max: 0.14 },
  alpha: { start: 1, end: 0.7 },
  rotate: { min: -120, max: 120 },
  zone: { x: -3, y: -40, width: 6, height: 80 },
};
const FLIGHT_TRAIL_FREQUENCY_MS = 90;
/** Корма спрайта: точка потока сдвинута назад от его центра. */
const FLIGHT_TRAIL_OFFSET_X = -10;

/** Хвост летящего спрайта: `stop` гасит поток, частицы догорают сами. */
export interface IFlightTrail {
  stop: () => void;
}

interface IFlightTrailEntry {
  layer: ParticleLayer;
  follow: Container | null;
  counterMs: number;
}

/**
 * Общая обвязка эффектов доски над сценой Pixi: контейнер доски, текстуры,
 * твины на часах рантайма, слои частиц и учёт всего, что эффекты положили в
 * сцену.
 *
 * Учёт - ради жизненного цикла: эффект живёт дольше хода (попап, хвост,
 * полёт к цели, кольца луча), и `destroy` обязан снять твины до объектов -
 * Pixi бросает на записи в снятый объект, - а сами объекты убрать до
 * контейнера доски. Утечь между партиями нечему: всё, что создаёт эффект,
 * проходит через `add`/`tween`, и `destroy` гасит остаток.
 */
export class FxScene {
  readonly core: GameRuntimeCore;
  readonly motion: RuntimeMotion;
  /** Контейнер доски: дизайн-координаты клеток (`lib/boardGeometry`). */
  readonly container: Container;
  private readonly displays = new Set<Container>();
  private readonly tweens = new Set<IMotionTween>();
  private readonly frameHooks = new Set<(deltaMs: number) => void>();
  /** Уборка того, что не объект сцены (свои текстуры-обрезки волны). */
  private readonly disposers = new Set<() => void>();
  private readonly flightTrails = new Set<IFlightTrailEntry>();
  private burstLayer: ParticleLayer | null = null;
  private fallLayer: ParticleLayer | null = null;
  private readonly offFrame: () => void;
  private destroyed = false;
  /**
   * Слой фишек в том же контейнере: хвост падения ложится сразу под него -
   * поверх подложки `floor`, но под фишками. Геттер: проигрыватель шагов,
   * владелец слоя, создаётся уже после эффектов.
   */
  private readonly piecesLayer: () => Container | undefined;

  constructor(
    core: GameRuntimeCore,
    container: Container,
    piecesLayer: () => Container | undefined = () => undefined
  ) {
    this.core = core;
    this.motion = core.motion;
    this.container = container;
    this.piecesLayer = piecesLayer;
    // Реальное время кадра, без темпа доски: у эталона эмиттеры и камера
    // живут на кадре игры, а не на `timeScale` твинов (финал ×1.7 их не
    // ускоряет). Пауза партии их останавливает - часы на паузе молчат.
    this.offFrame = core.motion.onFrame((deltaMs) => this.update(deltaMs), {
      timeScale: 'ignore',
    });
  }

  get isDestroyed(): boolean {
    return this.destroyed;
  }

  texture(key: string): Texture {
    return this.core.textures.get(key);
  }

  /** Спрайт эффекта с якорем по центру (как `scene.add.image` эталона). */
  sprite(key: string, x: number, y: number): Sprite {
    const sprite = new Sprite(this.texture(key));

    sprite.anchor.set(0.5);
    sprite.position.set(x, y);

    return sprite;
  }

  /** Кладёт объект эффекта в сцену (по умолчанию - поверх доски) и учитывает его. */
  add<T extends Container>(display: T, parent: Container = this.container): T {
    parent.addChild(display);
    this.displays.add(display);

    return display;
  }

  /** Снимает объект эффекта: сначала его твины, затем объект. */
  remove(display: Container | null | undefined): void {
    if (!display) {
      return;
    }

    this.displays.delete(display);
    destroyDisplay(this.motion, display);
  }

  /** Твин объекта сцены с учётом (см. `addDisplayTween`). */
  tween(
    display: Container | null | undefined,
    props: IDisplayTweenProps,
    options: ITweenOptions = {}
  ): IMotionTween {
    return this.track(addDisplayTween(this.motion, display, props, options));
  }

  /** Твин произвольного объекта (прогресс полёта, ширина обрезки) с учётом. */
  tweenValue(target: object, props: TMotionProps, options: ITweenOptions = {}): IMotionTween {
    return this.track(this.motion.add(target, props, options));
  }

  /** Покадровый вызов эффекта (тряска, вспышка); снимается возвратом. */
  onFrame(hook: (deltaMs: number) => void): () => void {
    this.frameHooks.add(hook);

    return () => {
      this.frameHooks.delete(hook);
    };
  }

  /**
   * Уборка ресурса эффекта на `destroy`, если эффект не успел убрать его сам;
   * возврат - уборка сейчас (и снятие с учёта).
   */
  onDispose(dispose: () => void): () => void {
    this.disposers.add(dispose);

    return () => {
      if (this.disposers.delete(dispose)) {
        dispose();
      }
    };
  }

  /**
   * Сноп частиц разрушения. Слой один на доску и поднимается наверх на каждый
   * выстрел: каскад с прошлого снопа дописал в контейнер новые фишки, и
   * частицы ушли бы под них (порядок в контейнере - порядок отрисовки).
   */
  emitBurst(x: number, y: number, tint: number): void {
    if (this.destroyed) {
      return;
    }

    this.burstLayer ??= new ParticleLayer(this.texture(PARTICLE_TEXTURE), BURST_CONFIG, 'fxBurst');
    this.container.addChild(this.burstLayer.view);
    this.burstLayer.emit(x, y, BURST_PARTICLES[getRenderQuality()], tint);
  }

  /**
   * Хвост одного падения - замыкание над общим слоем, а не ресурс: фишка,
   * снесённая посреди падения, просто перестаёт впрыскивать. `null` -
   * короткое падение или низкое качество (хвост - чистое украшение).
   */
  createFallTrail(rows: number, startY: number, tint: number): IFallTrail | null {
    if (this.destroyed || rows < FALL_TRAIL_MIN_ROWS || getRenderQuality() === 'low') {
      return null;
    }

    const targetY = startY + TILE_STEP_Y * rows;
    let nextY = startY + FALL_TRAIL_STEP_PX;

    return {
      track: (x, y) => {
        if (y < nextY || this.destroyed) {
          return;
        }

        this.fallTrailLayer().emit(x, y, 1, tint);

        // Догоняем позицию, а не шаг: на просевшем кадре фишка перепрыгивает
        // несколько шагов, и отставший счётчик впрыскивал бы каждый кадр.
        while (nextY <= y) {
          nextY += FALL_TRAIL_STEP_PX;
        }

        // След в клетке приземления перекрыт фишкой - его не рисуем.
        if (nextY >= targetY) {
          nextY = Number.POSITIVE_INFINITY;
        }
      },
    };
  }

  /**
   * Хвост летящего спрайта (пропеллер, шар бустера): свой слой на пролёт,
   * кладётся в контейнер **до** спрайта - след идёт под ним. После `stop`
   * слой живёт, пока не догорит последняя частица.
   */
  createFlightTrail(follow: Container): IFlightTrail {
    if (this.destroyed) {
      return { stop: () => undefined };
    }

    const layer = new ParticleLayer(
      this.texture(PARTICLE_TEXTURE),
      FLIGHT_TRAIL_CONFIG,
      'fxFlightTrail'
    );
    const entry: IFlightTrailEntry = { layer, follow, counterMs: 0 };

    this.container.addChild(layer.view);
    this.flightTrails.add(entry);

    return {
      stop: () => {
        entry.follow = null;
      },
    };
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.offFrame();
    this.frameHooks.clear();
    [...this.tweens].forEach((tween) => tween.kill());
    this.tweens.clear();
    [...this.displays].forEach((display) => destroyDisplay(this.motion, display));
    this.displays.clear();
    this.disposers.forEach((dispose) => dispose());
    this.disposers.clear();
    this.flightTrails.forEach((entry) => entry.layer.destroy());
    this.flightTrails.clear();
    this.burstLayer?.destroy();
    this.fallLayer?.destroy();
    this.burstLayer = null;
    this.fallLayer = null;
  }

  /** Слой хвостов падения - сразу под слоем фишек: смаз идёт под ними, но над подложкой. */
  private fallTrailLayer(): ParticleLayer {
    if (!this.fallLayer) {
      this.fallLayer = new ParticleLayer(
        this.texture(PARTICLE_TEXTURE),
        FALL_TRAIL_CONFIG,
        'fxFallTrail'
      );
      this.container.addChildAt(this.fallLayer.view, this.fallTrailIndex());
    }

    return this.fallLayer;
  }

  private fallTrailIndex(): number {
    const pieces = this.piecesLayer();

    return pieces?.parent === this.container ? this.container.getChildIndex(pieces) : 0;
  }

  private track(tween: IMotionTween): IMotionTween {
    this.tweens.add(tween);
    void tween.finished.then(() => this.tweens.delete(tween));

    return tween;
  }

  private update(deltaMs: number): void {
    if (this.destroyed) {
      return;
    }

    [...this.frameHooks].forEach((hook) => hook(deltaMs));
    this.burstLayer?.update(deltaMs);
    this.fallLayer?.update(deltaMs);
    this.flightTrails.forEach((entry) => this.updateFlightTrail(entry, deltaMs));
  }

  private updateFlightTrail(entry: IFlightTrailEntry, deltaMs: number): void {
    const { layer } = entry;

    if (layer.isDestroyed) {
      this.flightTrails.delete(entry);

      return;
    }

    // Частицы прошлых кадров живут до рождения новых: новая частица в первый
    // свой кадр стоит в точке рождения, как у эталона.
    layer.update(deltaMs);

    const follow = entry.follow;

    if (follow && !follow.destroyed) {
      const flow = advanceParticleFlow(entry.counterMs, deltaMs, FLIGHT_TRAIL_FREQUENCY_MS);

      entry.counterMs = flow.counterMs;
      layer.emit(
        follow.x + FLIGHT_TRAIL_OFFSET_X,
        follow.y,
        flow.emit,
        SKIN.colors.fx.burstDefault
      );

      return;
    }

    entry.follow = null;

    if (layer.aliveCount === 0) {
      layer.destroy();
      this.flightTrails.delete(entry);
    }
  }
}

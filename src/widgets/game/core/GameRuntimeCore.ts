import { UPDATE_PRIORITY, type Application, type Ticker } from 'pixi.js';
import { getRenderDpr, setRenderCanvasSize } from '../configs/renderScale';
import { getSceneInsets } from '../configs/sceneInsets';
import { resolveSceneLayout } from '../lib/sceneLayout';
import { RuntimeMotion } from '../motion/RuntimeMotion';
import type { ISpineSupport } from '../spine/spineSupport';
import type { TextureRegistry } from '../textures/TextureRegistry';
import { destroyApplication } from './destroyApplication';
import { RuntimeEvents, type IRuntimeViewport } from './RuntimeEvents';
import { RuntimeInput } from './RuntimeInput';
import { RuntimeLayers } from './RuntimeLayers';

/** Модуль рантайма глазами ядра: всё, что умеет себя погасить. */
export interface IRuntimeModule {
  destroy?: () => void;
}

/**
 * Ядро одной партии: приложение Pixi, слои, часы и твины, шина событий,
 * текстуры, замок ввода и модули.
 *
 * Ядро передаётся модулям **явно** - конструктором. У Phaser-эталона оно
 * лежало в глобале `GAMECORE`, который модули читали в инициализаторах
 * полей, и вокруг этого выросли правила владения (ставить до сцены, снимать
 * после отложенного `destroy`, не верить ему на выключении). У Pixi
 * `Application.destroy()` синхронный, а глобала нет - нет и гонки, ради
 * которой те правила существовали: модуль умирающей партии физически не
 * может дотянуться до ядра следующей.
 */
export class GameRuntimeCore {
  readonly app: Application;
  readonly layers: RuntimeLayers;
  readonly motion = new RuntimeMotion();
  readonly events = new RuntimeEvents();
  readonly textures: TextureRegistry;
  readonly input: RuntimeInput;
  /**
   * Скелеты Spine партии (вид клетки `spine`); `null` - в скине нет такого
   * вида, и чанк `spine` не грузился (`spine/spineSupport`).
   */
  readonly spine: ISpineSupport | null;
  private readonly modules = new Map<string, IRuntimeModule>();
  private currentViewport: IRuntimeViewport;
  private destroyed = false;

  constructor(
    app: Application,
    textures: TextureRegistry,
    {
      isInputEnabled = true,
      spine = null,
    }: { isInputEnabled?: boolean; spine?: ISpineSupport | null } = {}
  ) {
    this.app = app;
    this.textures = textures;
    this.spine = spine;
    this.layers = new RuntimeLayers(app.stage);
    this.input = new RuntimeInput(app.stage, isInputEnabled);
    // Корень ловит указатель по всему канвасу, а не только над детьми: тап
    // мимо доски снимает бустер-режим, любой тап сдвигает подсказку простоя,
    // а отпускание над пустым местом закрывает жест клетки. Прямоугольник
    // экрана рендерер обновляет на месте, поэтому ресайзу он не нужен.
    app.stage.hitArea = app.screen;
    this.currentViewport = this.measureViewport();

    // Часы рантайма идут по кадрам Pixi и раньше отрисовки: кадр рисует уже
    // сдвинутые твины, а не прошлое их положение.
    app.ticker.add(this.tick, this, UPDATE_PRIORITY.HIGH);
  }

  get isDestroyed(): boolean {
    return this.destroyed;
  }

  /** Последний размер канваса и раскладка мира в координатах сцены (CSS px). */
  get viewport(): IRuntimeViewport {
    return this.currentViewport;
  }

  registerModule<T extends IRuntimeModule>(name: string, instance: T): T {
    this.modules.set(name, instance);

    return instance;
  }

  /**
   * Подгоняет канвас под CSS-размер доски.
   *
   * Канвас рисует в физических пикселях (`resolution` = DPR отрисовки), а на
   * экране занимает CSS-размер доски (`autoDensity` пишет его в стиль): так
   * сцена живёт в CSS px, а бэкбуфер не мылится на плотном экране. Это вся
   * замена обратного `zoom` Phaser-эталона (`docs/PLAN.md`).
   *
   * Отступы сцены к этому моменту уже выставлены (`useGameRuntime` меряет их
   * до вызова). Событие `resize` уходит и при прежнем размере: смена одних
   * отступов или качества доходит до модулей тем же путём.
   */
  resize(cssWidth: number, cssHeight: number): void {
    if (this.destroyed || cssWidth <= 0 || cssHeight <= 0) {
      return;
    }

    const dpr = getRenderDpr();

    this.app.renderer.resize(cssWidth, cssHeight, dpr);
    // Размер в физических пикселях - тот, от которого `getTextResolution`
    // считает разрешение печати текста.
    setRenderCanvasSize(cssWidth * dpr, cssHeight * dpr);
    this.currentViewport = this.measureViewport();
    this.events.emit('resize', this.currentViewport);

    // Ресайз чистит бэкбуфер, а на паузе тикер стоит: без ручного кадра под
    // карточкой хоста остался бы пустой канвас.
    if (!this.app.ticker.started) {
      this.app.render();
    }
  }

  /**
   * Гасит модули, часы, шину и сцену. Сбой одного модуля не останавливает
   * очистку остальных: каждый `destroy()` изолирован. Идемпотентен.
   */
  destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.app.ticker.remove(this.tick, this);
    this.motion.destroy();

    this.modules.forEach((instance, name) => {
      try {
        instance.destroy?.();
      } catch (error) {
        console.error(`[game] module "${name}" destroy failed`, error);
      }
    });
    this.modules.clear();

    this.input.destroy();
    this.events.clear();
    // Спрайты и контейнеры сцены - вместе с приложением; текстуры скина
    // остаются в своих кэшах для следующей партии.
    destroyApplication(this.app);
    this.textures.destroy();
  }

  /**
   * Исключение из твина (запись в уже снятый объект) не должно уносить тикер:
   * Pixi просит следующий кадр только после успешного обновления, и один сбой
   * заморозил бы партию целиком.
   */
  private tick(ticker: Ticker): void {
    try {
      this.motion.update(ticker.deltaMS);
    } catch (error) {
      console.error('[game] motion update failed', error);
    }
  }

  private measureViewport(): IRuntimeViewport {
    const { width, height } = this.app.screen;

    return {
      width,
      height,
      // Сцена в CSS px, поэтому множитель «CSS px -> единицы сцены» - 1.
      layout: resolveSceneLayout({ width, height }, getSceneInsets(), 1),
    };
  }
}

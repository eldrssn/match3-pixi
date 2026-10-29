import type { Container } from 'pixi.js';
import { getElementTexture } from '@/entities/skin';
import { CELL_TEXTURE_WIDTH, GAME_CONFIG } from '../../configs/GAME_CONFIG';
import type { IBoosterFxAnchor, IGoalFlightTarget } from '../../fx/boardFx';
import type { IFallCell } from '../../lib/fallPath';
import { runGuarded } from '../../lib/runGuarded';
import { CellInputController, type ICellInputHost } from './CellInputController';
import {
  CellMover,
  visualCellCenter,
  type ICellMoveOptions,
  type ICellMoverHost,
} from './CellMover';
import type { CellId, ICellRuntime } from './cellsTypes';
import { createCellView } from './views/cellViewKinds';
import type { ICellLook, ICellView, TCellDisplay } from './views/cellView';

/**
 * Дробь «дизайн-px / ширина текстуры», а не готовое десятичное число - см.
 * `CELL_TEXTURE_WIDTH`. При следующей правке размера клетки меняется только
 * `GAME_CONFIG.cellsSize`, а не масштаб здесь и в каждой копии этого числа по
 * наследникам.
 */
export const BASE_SCALE = GAME_CONFIG.cellsSize / CELL_TEXTURE_WIDTH;

/**
 * Текстура покоя сущности - из описания элемента в скине (`ISkinElementBoard`),
 * а не код клетки: скин сам называет свои текстуры. У дыры вида нет.
 */
const resolveRestTexture = (id: CellId): string => (id === 'HOLE' ? id : getElementTexture(id));

/** Где встаёт сущность: рантайм клетки, контейнер доски и клетка. */
export interface IBoardEntityPlace {
  runtime: ICellRuntime;
  container: Container;
  col: number;
  row: number;
}

/**
 * Клетка доски: где она стоит, как туда едет и падает, и что умеет в ходе.
 *
 * Сама сущность ничего не рисует и касаний не ловит:
 * - внешность - вид клетки (`ICellView`, по умолчанию `SpriteCellView`):
 *   появление, покой, нажатие, удар, разрушение, деформация падения. Вид
 *   выбирает скин (`ISkinElementBoard.view`) через реестр `CELL_VIEW_KINDS`,
 *   а что именно рисовать (текстура, масштаб, украшение, разрушение) -
 *   описание элемента в наследнике (`look`);
 * - ввод - `CellInputController`: зона касания, жест, режим цели бустера;
 * - движение - `CellMover`: переезд, возврат домой, дрожь отказа, падение и
 *   въезд добора; публичные методы движения сущность делегирует ему.
 */
export abstract class BoardEntity implements ICellInputHost, ICellMoverHost {
  /** Забывает открытый жест доски - см. `CellInputController.resetActiveDrag`. */
  public static resetActiveDrag(): void {
    CellInputController.resetActiveDrag();
  }

  protected readonly runtime: ICellRuntime;
  readonly id: CellId;
  public hp: number;
  /** Колонка на доске (ось X, слева направо). Контракт - `grid[col][row]`. */
  public x: number;
  /** Строка на доске (ось Y, сверху вниз). */
  public y: number;
  protected readonly parentContainer: Container;
  /** Ввод клетки; блокеры без касаний держат его пустым (`acceptsInput`). */
  protected readonly input: CellInputController;
  private readonly mover: CellMover;
  /**
   * Клетка принимает касания (ход, тап, цель бустера). Неподвижные блокеры -
   * нет: зоны касания у них нет вовсе. Читается в `render()`, уже после
   * инициализации полей наследника.
   */
  protected readonly acceptsInput: boolean = true;

  /** Текущее смещение спрайта за пальцем, в локальных координатах контейнера. */
  private dragOffsetX = 0;
  private dragOffsetY = 0;

  /**
   * Вид создаётся при первом обращении, а не в конструкторе: описание
   * элемента (`look`) читает поля наследников (`LaserEntity.direction`),
   * которые присваиваются уже после `super()`.
   */
  private cellView: ICellView | null = null;

  constructor(id: CellId, hp: number, { runtime, container, col, row }: IBoardEntityPlace) {
    this.id = id;
    this.hp = hp;
    this.x = col;
    this.y = row;
    this.runtime = runtime;
    this.parentContainer = container;
    this.input = new CellInputController(runtime, container, this);
    this.mover = new CellMover(runtime, this, this.input, () => this.cellView);
  }

  /** Сама клетка - для событий ввода (`ICellInputHost`). */
  public get entity(): BoardEntity {
    return this;
  }

  protected get view(): ICellView {
    this.cellView ??= createCellView(
      { runtime: this.runtime, container: this.parentContainer, id: this.id },
      this.look()
    );

    return this.cellView;
  }

  /** Объект клетки на доске; `null` - не нарисована или уже снята. */
  public get image(): TCellDisplay | null {
    return this.cellView?.display ?? null;
  }

  /**
   * Описание элемента для вида: текстура покоя, масштаб, украшение,
   * разрушение. По умолчанию - фишка: кадр атласа в `BASE_SCALE`, замах и
   * схлопывание.
   */
  protected look(): ICellLook {
    const texture = resolveRestTexture(this.id);

    return { texture: () => texture, baseScale: BASE_SCALE, nearestFilter: true };
  }

  /** Снимает вид вместе с зоной касания. */
  protected disposeVisual(): void {
    this.input.dispose();
    this.cellView?.dispose();
  }

  /**
   * Рисует сущность. Вызывается явно на месте создания (`EntityFactory`), а не
   * из конструктора: у наследников собственные поля (`LaserEntity.direction`)
   * присваиваются уже после `super()`, и рендер из конструктора видел бы их
   * `undefined`.
   */
  public render(): void {
    this.disposeVisual();

    const { visualX, visualY } = this.getVisualCoords();

    this.view.create(visualX, visualY, this.hp);

    if (this.acceptsInput) {
      this.input.attach();
    }
  }

  // ------------------------------------------------------------ ввод вида

  /** Палец на клетке (`CellInputController`). */
  public onPress(): void {
    this.view.press();
  }

  /**
   * Вид «не перетаскивают»: масштаб, тинт. Позицию **не** трогает: чем
   * кончится смещение за пальцем, решает жест - доигрывается свапом с того же
   * места или плавно уезжает домой.
   */
  public onRelease(): void {
    this.view.release();
  }

  /**
   * Ставит спрайт в свою клетку плюс смещение за пальцем.
   *
   * Позиция считается **от грида** (`getVisualCoords()`), а не прибавкой к
   * текущей: у относительной арифметики любая потерянная дельта становится
   * вечной. Публичный, потому что вторую половину пары двигает
   * `SwapDragController`.
   */
  public setDragOffset(offsetX: number, offsetY: number): void {
    const image = this.image;

    if (!image || image.destroyed) return;

    const { visualX, visualY } = this.getVisualCoords();

    image.position.set(visualX + offsetX, visualY + offsetY);

    this.dragOffsetX = offsetX;
    this.dragOffsetY = offsetY;
    this.input.sync();
  }

  /**
   * Забывает смещение, **не двигая спрайт**: дальше его ведёт анимация свапа.
   * Без этого следующий сброс вычел бы уже отработавшее смещение и дёрнул бы
   * фишку посреди анимации.
   */
  public forgetDragOffset(): void {
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
  }

  /** Плавный возврат в свою клетку - см. `CellMover.returnHome`. */
  public returnHome(): Promise<void> {
    return this.mover.returnHome();
  }

  /**
   * Мгновенно возвращает себя и соседа в свои клетки - аварийный путь: доска
   * занялась каскадом посреди жеста, клетку снесло под пальцем.
   *
   * Событие уходит даже без смещения: соседа двигает не сама клетка, а
   * `SwapDragController`, и «мы ему ничего не сдвинули» отсюда не видно.
   */
  public clearDragOffset(): void {
    if (this.dragOffsetX !== 0 || this.dragOffsetY !== 0) {
      this.setDragOffset(0, 0);
    }

    this.runtime.core.events.emit('swapDragEnd', false);
  }

  /** Пульс подсказки простоя (`modules/IdleHint`): масштабом владеет вид клетки. */
  public playIdlePulse(): void {
    this.view.pulse(true);
  }

  public stopIdlePulse(): void {
    this.cellView?.pulse(false);
  }

  public getVisualCoords() {
    return visualCellCenter({ col: this.x, row: this.y });
  }

  // ------------------------------------------------------------- движение

  /** Переезд спрайта в другие координаты доски - см. `CellMover.moveToCoords`. */
  public moveToCoords(x: number, y: number, options?: ICellMoveOptions): Promise<void> {
    return this.mover.moveToCoords(x, y, options);
  }

  /** Дрожь отклонённого свапа - см. `CellMover.playRejectShake`. */
  public playRejectShake(): Promise<void> {
    return this.mover.playRejectShake();
  }

  /** Оседание по пути из клеток (шаг `settle`) - см. `CellMover.fall`. */
  public fall(
    from: IFallCell,
    path: readonly IFallCell[],
    delayMs = 0,
    fadeIn = false
  ): Promise<void> {
    return this.mover.fall(from, path, delayMs, fadeIn);
  }

  /** Въезд добора из-за верхней границы - см. `CellMover.enter`. */
  public enter(path: readonly IFallCell[], delayMs = 0): Promise<void> {
    return this.mover.enter(path, delayMs);
  }

  // ------------------------------------------------------------ внешность

  public async appearAnimation(): Promise<void> {
    await this.view.appear();

    this.input.sync();
    this.input.setEnabled(true);
  }

  /** Выскок появившегося спец-элемента (`ICellView.spawn`). */
  public playSpawnPop(): void {
    this.view.spawn();
  }

  public brightCell(): void {
    this.cellView?.bright(true);
  }

  public unbrightCell(): void {
    this.cellView?.bright(false);
  }

  /**
   * Урон без ожидания анимации: прочность после удара уже решил движок доски
   * (`IBoardHit.hp`), вид только показывает её - стадию или разрушение.
   * Разрушение играет параллельно - каскад не ждёт догорания, чтобы начать
   * падение. Из грида рантайма клетку убирает анимация шага `damage` сразу
   * после вызова.
   */
  public takeDamage(hpLeft: number): void {
    this.hp = hpLeft;

    if (this.hp <= 0) {
      this.runDestroy();
      return;
    }

    this.cellView?.hit(hpLeft);
  }

  /**
   * Неожидаемое разрушение из синхронного `takeDamage()`: промис никто не
   * ждёт - без `runGuarded` сбой стал бы unhandled rejection без имени
   * сценария в консоли.
   */
  protected runDestroy(): void {
    runGuarded('cell-destroy', () => this.destroy());
  }

  /**
   * Шаг цели засчитан: копия спрайта взлетает к панели целей. Что идёт в цель,
   * решает правило по шагам движка (`listGoalEvents`); зовёт это проигрыватель
   * до урона - спецфишка гасит свой спрайт синхронно, и лететь было бы нечему.
   */
  public flyCopyToGoalPanel(target: IGoalFlightTarget | null): void {
    // Текстура покоя - у вида: он знает стадию прочности (повреждённый ящик
    // летит повреждённым); без вида - из описания элемента.
    const texture = this.cellView?.restTexture ?? resolveRestTexture(this.id);

    this.runtime.fx.flyToGoalPanel(this.image, texture, target);
  }

  /**
   * Разрушение: анимация вида, затем снятие. Синхронное разрушение вида
   * (спецфишка) снимает спрайт в том же вызове.
   */
  public destroy(): Promise<void> {
    // Жест обрывается сразу, а не после анимации: иначе снесённая под пальцем
    // клетка ещё всю анимацию слала бы `swapRequest`/`cellTap`.
    this.input.cancelGesture();
    this.input.setEnabled(false);

    const motion = this.cellView?.destroy();

    if (!motion) {
      this.disposeVisual();

      return Promise.resolve();
    }

    return motion.then(() => this.disposeVisual());
  }

  /**
   * Тихий уход с доски без разрушения: поглощение слизью, место предуровневого
   * бустера. Ни частиц, ни цели.
   */
  public async vanish(): Promise<void> {
    this.input.cancelGesture();
    this.input.setEnabled(false);

    await this.cellView?.vanish();

    this.disposeVisual();
  }

  public canSwap(): boolean {
    return true;
  }

  public enableBoosterMode(): void {
    this.input.enableBoosterMode();
  }

  public disableBoosterMode(): void {
    this.input.disableBoosterMode();
  }

  // ------------------------------------------------------ эффекты бустеров

  /** Бустер «луч» по этой клетке (`IBoardFx.playBeamStrike`). */
  public async beamCellAnimation(): Promise<void> {
    this.input.setEnabled(false);

    await this.runtime.fx.playBeamStrike(this.fxAnchor());

    this.input.setEnabled(true);
  }

  /** Бустер «лазер» над этой фишкой (`IBoardFx.playPortalSweep`). */
  public async laserCellAnimation(): Promise<void> {
    this.input.setEnabled(false);

    await this.runtime.fx.playPortalSweep(this.fxAnchor());

    this.input.setEnabled(true);
  }

  private fxAnchor(): IBoosterFxAnchor {
    const image = this.image;

    return { x: image?.x || 0, y: image?.y || 0, angle: image?.angle || 0 };
  }
}

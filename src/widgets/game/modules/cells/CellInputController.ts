import { Container, Rectangle, type FederatedPointerEvent } from 'pixi.js';
import { GAME_CONFIG } from '../../configs/GAME_CONFIG';
import { TILE_STEP_X } from '../../lib/boardGeometry';
import { resolveSwipeDirection } from '../../lib/swipeGesture';
import { useGameStore } from '../../store/GameStore';
import type { BoardEntity } from './BoardEntity';
import type { ICellRuntime } from './cellsTypes';
import type { TCellDisplay } from './views/cellView';

/** Размер зоны касания клетки, дизайн-px. */
const HIT_AREA_SIZE = 50;

/** Основная кнопка мыши; у касания и пера `button` тоже ноль. */
const PRIMARY_BUTTON = 0;

/**
 * Что контроллер знает о своей клетке. Решений о ходе здесь нет: жест
 * отдаёт наверх события шины рантайма (`swapDragMove`, `swapRequest`,
 * `cellTap`, `boosterCell*`), а их смысл решают `GameLogic`,
 * `SwapDragController` и `BoosterMode`.
 */
export interface ICellInputHost {
  /** Колонка на доске. */
  readonly x: number;
  /** Строка на доске. */
  readonly y: number;
  /** Объект клетки: к нему привязана зона касания. */
  readonly image: TCellDisplay | null;
  /** Сама клетка - её получают события шины. */
  readonly entity: BoardEntity;
  /** Палец опустился на клетку: отклик вида. */
  onPress(): void;
  /** Жест закрыт: вид покоя (масштаб; позицию не трогает). */
  onRelease(): void;
  /** Плавный возврат в свою клетку. */
  returnHome(): Promise<void>;
  /** Забыть смещение за пальцем, не двигая спрайт: дальше ведёт анимация свапа. */
  forgetDragOffset(): void;
  /** Мгновенный возврат себя и соседа: клетку снесло прямо во время жеста. */
  clearDragOffset(): void;
}

/**
 * Ввод клетки доски: зона касания, жест свайпа и тапа, режим цели бустера.
 *
 * Отдельно от сущности (`BoardEntity`): внешность клетки (вид) и её место на
 * доске меняются чаще, чем правила жеста.
 *
 * Зона касания - пустой `Container` с `hitArea` в контейнере доски. Слежение
 * и отпускание слушаются на корне сцены, а не на зоне: зона гасится на время
 * анимации клетки (`setEnabled(false)`), а жест, начатый до этого, обязан
 * закрыться. Корень ловит указатель по всему канвасу (`hitArea` экрана в
 * `GameRuntimeCore`): отпускание над канвасом - `pointerup` с точкой, за его
 * пределами - `pointerupoutside`. Касание держит указатель на канвасе и за его
 * краем (неявный захват браузера), поэтому «за пределами» решает ещё и точка
 * вне экрана.
 */
export class CellInputController {
  /**
   * Клетка, у которой сейчас открыт жест (одна на всю доску).
   *
   * Страховка от «повисшего» жеста: обычно его закрывает отпускание, но на iOS
   * WKWebView оно иногда не доходит вовсе (касание начали на DOM-заглушке
   * загрузки, а её узел убрали до `touchend`). Новый легитимный `pointerdown` -
   * надёжный сигнал «предыдущий жест точно не в процессе», поэтому он же и
   * закрывает чужой зависший жест, прежде чем открыть свой. Тот же жест
   * закрывает замок ввода (`RuntimeInput` -> `cancelActiveDrag`).
   *
   * Статик переживает партию, поэтому у него есть явный сброс -
   * `resetActiveDrag()`.
   */
  private static activeDrag: CellInputController | null = null;

  /**
   * Забывает открытый жест, не трогая саму клетку: зовут `GameLogic.destroy()`
   * и `bootGameRuntime()`. Без этого зависший на момент уничтожения жест
   * держал бы ссылку на клетку мёртвой партии, а первый `pointerdown` новой
   * закрывал бы его по снятой сцене.
   */
  public static resetActiveDrag(): void {
    CellInputController.activeDrag = null;
  }

  /**
   * Закрывает открытый жест тем же путём, что палец, поднятый за пределами
   * канваса: пара уезжает домой. Хук сброса замка ввода (`RuntimeInput`) -
   * касание, открывшее DOM-слой хоста, иначе оставило бы клетку «в руке».
   */
  public static cancelActiveDrag(): void {
    CellInputController.activeDrag?.onGlobalPointerUpOutside();
  }

  private readonly runtime: ICellRuntime;
  private readonly container: Container;
  private readonly host: ICellInputHost;
  private hitArea: Container | null = null;
  private isDragging = false;
  /** Указатель жеста: второй палец жест не ведёт и не закрывает. */
  private pointerId: number | null = null;
  /**
   * Точка касания, от которой меряется жест - там, где палец опустился, а не
   * центр спрайта: иначе порог свайпа включал бы расстояние от пальца до
   * центра клетки.
   */
  private dragStartX = 0;
  private dragStartY = 0;

  /**
   * Бустер выбран: клетка - цель применения, а не начало хода. Состояние
   * переживает пересоздание зоны касания (`attach`).
   */
  private isBoosterMode = false;

  constructor(runtime: ICellRuntime, container: Container, host: ICellInputHost) {
    this.runtime = runtime;
    this.container = container;
    this.host = host;
  }

  private get stage(): Container {
    return this.runtime.core.app.stage;
  }

  /** Зона касания поверх объекта клетки и её обработчики. */
  attach(): void {
    this.destroyHitArea();

    const image = this.host.image;

    if (!image) return;

    const zone = new Container({ label: 'cellHitArea' });

    zone.hitArea = new Rectangle(
      -HIT_AREA_SIZE / 2,
      -HIT_AREA_SIZE / 2,
      HIT_AREA_SIZE,
      HIT_AREA_SIZE
    );
    zone.position.set(image.x, image.y);
    zone.eventMode = 'static';
    zone.cursor = 'pointer';
    zone.on('pointerdown', this.onPointerDown);
    zone.on('pointerover', this.onBoosterOver);
    zone.on('pointerout', this.onBoosterOut);
    zone.on('pointerup', this.onBoosterUp);
    this.container.addChild(zone);
    this.hitArea = zone;
  }

  /** Зона касания едет за объектом клетки (переезд, падение, смещение за пальцем). */
  sync(): void {
    const image = this.host.image;
    const zone = this.hitArea;

    if (zone && image && !image.destroyed) {
      zone.position.set(image.x, image.y);
    }
  }

  /** Касания на время анимации клетки выключаются и включаются обратно. */
  setEnabled(isEnabled: boolean): void {
    if (!this.hitArea) return;

    this.hitArea.eventMode = isEnabled ? 'static' : 'none';
  }

  /**
   * Обрывает открытый жест синхронно: снимает слушателей корня и забывает
   * `activeDrag`, если жест этой клетки. Зовёт сущность в начале разрушения и
   * тихого ухода - иначе снесённая под пальцем клетка всю анимацию слала бы
   * `swapRequest`/`cellTap`. Сосед по паре остался бы сдвинутым - его
   * возвращает `SwapDragController` (`clearDragOffset` -> `swapDragEnd`).
   */
  cancelGesture(): void {
    if (this.releaseDrag()) {
      this.host.clearDragOffset();
    }
  }

  /** Снимает зону касания вместе с открытым жестом. */
  dispose(): void {
    this.cancelGesture();
    this.destroyHitArea();
  }

  enableBoosterMode(): void {
    if (!this.host.image) return;

    this.isBoosterMode = true;
  }

  disableBoosterMode(): void {
    this.isBoosterMode = false;
  }

  private destroyHitArea(): void {
    const zone = this.hitArea;

    if (!zone) return;

    this.hitArea = null;
    zone.removeAllListeners();
    zone.destroy();
  }

  private onBoosterOver = (): void => {
    if (this.isBoosterMode) {
      this.runtime.core.events.emit('boosterCellOver', this.host.entity);
    }
  };

  private onBoosterOut = (): void => {
    if (this.isBoosterMode) {
      this.runtime.core.events.emit('boosterCellOut', this.host.entity);
    }
  };

  /**
   * Клетка - цель бустера. Всплытие гасится: отпускание дошло бы до корня, и
   * бустер-режим принял бы его за тап мимо доски.
   */
  private onBoosterUp = (event: FederatedPointerEvent): void => {
    if (!this.isBoosterMode) return;

    event.stopPropagation();
    this.runtime.core.events.emit('boosterCellUp', this.host.entity);
  };

  private onPointerDown = (event: FederatedPointerEvent): void => {
    // Выбран бустер: клетка - цель применения (`boosterCellUp`), а не начало
    // хода. Выход обязан быть до `beginDrag`/нажатия: сброс нажатого масштаба
    // живёт в отпускании жеста, а нажатие без жеста оставило бы фишку
    // раздутой навсегда.
    if (this.isBoosterMode) return;

    if (!this.beginDrag(event)) return;

    this.host.onPress();
  };

  /**
   * Начало жеста: запоминает точку захвата и подписывается на корень сцены.
   *
   * `false` - жест начинать нельзя. Проверка `isDragging` не формальность:
   * `pointerdown` может прийти повторно без отпускания (второй палец), и
   * лишняя подписка пережила бы жест - один свайп отправлял бы несколько
   * `swapRequest`.
   */
  private beginDrag(event: FederatedPointerEvent): boolean {
    if (event.button !== PRIMARY_BUTTON) return false;
    if (this.isDragging) return false;

    // Чужой жест ещё «открыт» (см. `activeDrag`) - закрываем его тем же путём,
    // что и палец, поднятый за пределами доски: пара просто уезжает домой.
    if (CellInputController.activeDrag && CellInputController.activeDrag !== this) {
      CellInputController.activeDrag.onGlobalPointerUpOutside();
    }

    this.isDragging = true;
    this.pointerId = event.pointerId;
    CellInputController.activeDrag = this;

    const stage = this.stage;

    stage.on('pointerup', this.onGlobalPointerUp);
    stage.on('pointerupoutside', this.onGlobalPointerUpOutside);
    // Слежение за пальцем: фишка едет за ним, а не ждёт конца жеста.
    stage.on('globalpointermove', this.onGlobalPointerMove);

    this.dragStartX = event.global.x;
    this.dragStartY = event.global.y;

    return true;
  }

  /** Конец жеста: снимает слушателей корня. `false` - жеста и не было. */
  private releaseDrag(): boolean {
    if (!this.isDragging) return false;

    this.isDragging = false;
    this.pointerId = null;

    if (CellInputController.activeDrag === this) {
      CellInputController.activeDrag = null;
    }

    const stage = this.stage;

    if (!stage.destroyed) {
      stage.off('pointerup', this.onGlobalPointerUp);
      stage.off('pointerupoutside', this.onGlobalPointerUpOutside);
      stage.off('globalpointermove', this.onGlobalPointerMove);
    }

    return true;
  }

  private isOwnPointer(event: FederatedPointerEvent | undefined): boolean {
    return !event || this.pointerId === null || event.pointerId === this.pointerId;
  }

  /**
   * Палец отпущен за пределами канваса. Ходом это не считается ни при каком
   * смещении: пара уезжает домой, жест закрывается как любой другой.
   */
  private onGlobalPointerUpOutside = (event?: FederatedPointerEvent): void => {
    if (!this.isOwnPointer(event) || !this.releaseDrag()) return;

    this.host.onRelease();
    void this.host.returnHome();
    this.runtime.core.events.emit('swapDragEnd', true);
  };

  /**
   * Минимальная длина свайпа в пикселях сцены под текущий размер доски.
   * Считается, а не задаётся константой: доска масштабируется под экран.
   */
  private getSwipeThreshold(): number {
    return TILE_STEP_X * this.getBoardScale() * GAME_CONFIG.swipeThresholdTiles;
  }

  /**
   * Во сколько раз единица сцены больше дизайн-пикселя контейнера доски.
   * Мировой масштаб контейнера, а не пересчёт раскладки: поле больше 6×6
   * дополнительно ужато под свою область (`lib/boardFit`), и копия формулы
   * здесь разъехалась бы с ним.
   */
  private getBoardScale(): number {
    const origin = this.container.toGlobal({ x: 0, y: 0 });
    const unit = this.container.toGlobal({ x: 1, y: 0 });

    return Math.hypot(unit.x - origin.x, unit.y - origin.y) || 1;
  }

  /**
   * Жест в движении: фишка едет за пальцем. Ход отсюда **не** заявляется -
   * только на отпускании (`onGlobalPointerUp`): коммит на пересечении порога
   * отбирал бы у игрока право передумать.
   */
  private onGlobalPointerMove = (event: FederatedPointerEvent): void => {
    if (!this.isDragging || !this.isOwnPointer(event)) return;

    // Пока доска занята каскадом, за пальцем не едем: смещение писало бы
    // позицию спрайту, которым в тот же кадр распоряжается твин гравитации.
    // Сам свайп не теряется: на отпускании он уйдёт в `PendingBoardInput`.
    if (useGameStore.getState().isBoardBusy) {
      this.host.clearDragOffset();

      return;
    }

    const dx = event.global.x - this.dragStartX;
    const dy = event.global.y - this.dragStartY;
    const { dirX, dirY } = resolveSwipeDirection(dx, dy);
    // Ось выбрана - за пальцем едем только по ней.
    const dominant = dirX !== 0 ? dx : dy;

    // Геометрию пары считает `SwapDragController` и двигает **обе** половины:
    // предел зависит от того, умеет ли сосед меняться местами, а грид знает
    // только `GameLogic`. Жест отдаёт наверх сырой ход пальца в дизайн-px.
    this.runtime.core.events.emit('swapDragMove', {
      row: this.host.y,
      col: this.host.x,
      dCol: dirX,
      dRow: dirY,
      offset: dominant / this.getBoardScale(),
    });
  };

  /**
   * Отправляет ход, передав анимации то место, где палец бросил пару:
   * смещение **забывается**, а не снимается, и свап доигрывает остаток пути.
   * Порядок обязателен: `handleSwapRequest` синхронно доходит до твина свапа.
   */
  private commitSwap(dirX: number, dirY: number): void {
    const { events } = this.runtime.core;

    this.host.forgetDragOffset();
    events.emit('swapDragHandOff');

    // Свайп в экранных осях: dirX - по колонкам, dirY - по строкам.
    events.emit('swapRequest', {
      row: this.host.y,
      col: this.host.x,
      targetRow: this.host.y + dirY,
      targetCol: this.host.x + dirX,
    });
  }

  /**
   * Палец поднят - **единственная** точка, где жест превращается в ход.
   *
   * Порог меряется по доминирующей оси - по тому, что игрок видел: фишка ехала
   * ровно по ней. Перевалила порог - свап с того места, где её бросили; не
   * дотянула - плавно уезжает по своим клеткам, и жест засчитывается тапом
   * (`cellTap`: выбор, ход двумя тапами, спецфишка - решает `GameLogic`).
   */
  private onGlobalPointerUp = (event: FederatedPointerEvent): void => {
    if (!this.isOwnPointer(event)) return;

    // Касание держит указатель на канвасе и за его краем: такое отпускание
    // приходит обычным `pointerup`, но ходом не считается, как и у мыши.
    if (!this.runtime.core.app.screen.contains(event.global.x, event.global.y)) {
      this.onGlobalPointerUpOutside(event);

      return;
    }

    if (!this.releaseDrag()) return;

    this.host.onRelease();

    const dx = event.global.x - this.dragStartX;
    const dy = event.global.y - this.dragStartY;
    const { dirX, dirY } = resolveSwipeDirection(dx, dy);
    const dominant = dirX !== 0 ? dx : dy;

    if (Math.abs(dominant) < this.getSwipeThreshold()) {
      const { events } = this.runtime.core;

      void this.host.returnHome();
      events.emit('swapDragEnd', true);
      events.emit('cellTap', this.host.entity);

      return;
    }

    this.commitSwap(dirX, dirY);
  };
}

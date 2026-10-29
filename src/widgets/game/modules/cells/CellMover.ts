import { BOARD_TIMING } from '../../configs/timing';
import { resolveDestroyTint } from '../../lib/destroyTint';
import { resolveFallDurationMs } from '../../lib/boardTempo';
import { resolveFallSegments, type IFallCell, type IFallSegment } from '../../lib/fallPath';
import { cellCenter, TILE_STEP_X } from '../../lib/boardGeometry';
import { tweenDisplay } from '../../motion/displayMotion';
import type { CellInputController } from './CellInputController';
import type { CellId, ICellRuntime } from './cellsTypes';
import type { ICellView, TCellDisplay } from './views/cellView';

/**
 * Кривая падения. `Back.easeOut` физически неверна дважды: она замедляется к
 * приземлению и перелетает - настоящее падение разгоняется.
 */
const FALL_EASE = 'Quad.easeIn';
/** Амплитуда дрожи пары на отклонённом свапе, в дизайн-пикселях. */
const REJECT_SHAKE_OFFSET_PX = 3;

/** Центр клетки в координатах спрайта (`visualX`/`visualY`, как у `getVisualCoords`). */
export const visualCellCenter = (cell: IFallCell): { visualX: number; visualY: number } => {
  const { x, y } = cellCenter(cell);

  return { visualX: x, visualY: y };
};

/** Параметры переезда (`moveToCoords`). */
export interface ICellMoveOptions {
  durationMs?: number;
  ease?: string;
  scaleToDistance?: boolean;
}

/**
 * Что движение знает о своей клетке. Вложенные шаги (`returnHome` ->
 * `moveToCoords`, `enter` -> `fall`) идут через хозяина, а не напрямую:
 * наследник сущности, переопределивший переезд или падение, получает их и
 * изнутри соседних движений.
 */
export interface ICellMoverHost {
  readonly id: CellId;
  /** Колонка на доске: откуда въезжает добор без пути. */
  readonly x: number;
  readonly image: TCellDisplay | null;
  getVisualCoords(): { visualX: number; visualY: number };
  forgetDragOffset(): void;
  render(): void;
  moveToCoords(x: number, y: number, options?: ICellMoveOptions): Promise<void>;
  fall(
    from: IFallCell,
    path: readonly IFallCell[],
    delayMs?: number,
    fadeIn?: boolean
  ): Promise<void>;
}

/**
 * Движение клетки доски: переезд свапа, возврат домой, дрожь отказа, оседание
 * по пути и въезд добора. Отдельно от сущности (`BoardEntity`) по той же
 * причине, что `CellInputController`: темп и кривые движения правятся
 * независимо от внешности и ввода. Публичный API движения остаётся у сущности
 * - она делегирует сюда.
 */
export class CellMover {
  private readonly runtime: ICellRuntime;
  private readonly host: ICellMoverHost;
  private readonly input: CellInputController;
  /** Вид клетки, если он уже создан: движение его не создаёт. */
  private readonly peekView: () => ICellView | null;

  constructor(
    runtime: ICellRuntime,
    host: ICellMoverHost,
    input: CellInputController,
    peekView: () => ICellView | null
  ) {
    this.runtime = runtime;
    this.host = host;
    this.input = input;
    this.peekView = peekView;
  }

  private get motion() {
    return this.runtime.core.motion;
  }

  /**
   * Плавно возвращает спрайт в свою клетку, если он оттуда смещён.
   *
   * Два вызывающих, и оба обязательны: жест, не дотянувший до порога, и
   * `GameLogic` на путях, где ход отклонён **до** всякой анимации (сосед-блокер,
   * дыра, край доски, занятая доска) - смещение к тому моменту уже передано
   * анимации свапа, которой не будет. Уже дома - выходим молча.
   */
  async returnHome(): Promise<void> {
    const image = this.host.image;

    this.host.forgetDragOffset();

    if (!image) return;

    const { visualX, visualY } = this.host.getVisualCoords();

    if (Math.abs(image.x - visualX) < 0.5 && Math.abs(image.y - visualY) < 0.5) {
      return;
    }

    await this.host.moveToCoords(visualX, visualY, {
      durationMs: BOARD_TIMING.swap.rejectMs,
      ease: 'Quad.easeOut',
      scaleToDistance: true,
    });
  }

  /**
   * Сколько должен занять переезд, которому осталось пройти `distancePx`:
   * номинал заявлен на полный шаг клетки, доля пути даёт долю времени. Ниже
   * пола не опускаемся - мгновенная подстановка видна как щелчок.
   */
  private resolveMoveDurationMs(nominalMs: number, distancePx: number): number {
    const share = Math.min(Math.max(distancePx / TILE_STEP_X, 0), 1);

    return Math.max(BOARD_TIMING.swap.minDurationMs, nominalMs * share);
  }

  /**
   * Переезд спрайта в другие координаты доски.
   *
   * `durationMs`/`ease` нужны отказу: отклонённый свап едет быстрее валидного
   * и **без перелёта**. `scaleToDistance` - для переездов, которые продолжают
   * жест игрока: палец уже прошёл часть пути, доигрывается остаток. Перемешке
   * доски он противопоказан - там «доля клетки» ничего не значит.
   */
  async moveToCoords(x: number, y: number, options?: ICellMoveOptions): Promise<void> {
    this.input.setEnabled(false);

    const nominalMs = options?.durationMs ?? BOARD_TIMING.swap.durationMs;
    const image = this.host.image;
    const durationMs =
      options?.scaleToDistance && image
        ? this.resolveMoveDurationMs(nominalMs, Math.hypot(x - image.x, y - image.y))
        : nominalMs;

    // `Back.easeOut` с лёгким перелётом: свап стартует мгновенно и «пружинит»
    // в клетку.
    await tweenDisplay(
      this.motion,
      image,
      { x, y },
      {
        duration: durationMs,
        ease: options?.ease ?? 'Back.easeOut',
        onUpdate: () => {
          this.input.sync();
        },
      }
    );

    this.input.setEnabled(true);
  }

  /**
   * Короткая дрожь по горизонтали - «нет» отклонённого свапа. Тряска пары, а
   * не камеры: камера держится за наградами, и отдай её отказу - неудача и
   * успех перестали бы отличаться на ощупь.
   */
  async playRejectShake(): Promise<void> {
    const image = this.host.image;

    if (!image) return;

    // Дом берётся из грида, а не из текущей позиции спрайта: твин возврата
    // пары мог не доиграть (страховка часов), и дрожь вокруг промежуточного
    // кадра прибила бы фишку мимо клетки.
    const { visualX, visualY } = this.host.getVisualCoords();

    await tweenDisplay(
      this.motion,
      image,
      { x: visualX + REJECT_SHAKE_OFFSET_PX },
      {
        duration: BOARD_TIMING.swap.rejectShakeMs,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: 1,
        onUpdate: () => {
          this.input.sync();
        },
      }
    );

    // Снятый на середине твин (уход клетки, ранний резолв по страховке)
    // оставил бы фишку смещённой навсегда - позицию ей задаёт только твин.
    if (!image.destroyed) {
      image.position.set(visualX, visualY);
      this.input.sync();
    }
  }

  /**
   * Оседание по пути из клеток (анимация шага `settle`): прямые участки - одним
   * падением с разгоном, диагональные шаги - соскальзыванием под неподвижный
   * блокер (отрезки - `lib/fallPath`).
   *
   * Длительность отрезка - от расстояния (`resolveFallDurationMs`). `delayMs` -
   * сдвиг старта относительно соседки под собой, и передаётся он твину, а не
   * отстаивается задержкой перед ним: иначе промис резолвился бы раньше
   * конца падения. Куда лететь в конце, спрашиваем у грида (`getVisualCoords()`
   * по уже проставленным `x`/`y`), а не у пути: догони клетку второй проход
   * гравитации, пока твин ещё в воздухе, и «от пути» фишка приземлилась бы мимо.
   */
  async fall(
    from: IFallCell,
    path: readonly IFallCell[],
    delayMs = 0,
    fadeIn = false
  ): Promise<void> {
    this.input.setEnabled(false);

    const segments = resolveFallSegments(from, path);

    for (let index = 0; index < segments.length; index++) {
      await this.playFallSegment(
        segments[index],
        index === 0 ? delayMs : 0,
        index === segments.length - 1,
        fadeIn && index === 0
      );
    }

    // Squash при приземлении не ждём: он доигрывает параллельно со спавном
    // новых фишек, а на снесённую сразу после каскада фишку его глушит
    // `stopMotion()` в разрушении.
    this.peekView()?.land();

    this.input.setEnabled(true);
  }

  private async playFallSegment(
    segment: IFallSegment,
    delayMs: number,
    isLast: boolean,
    fadeIn: boolean
  ): Promise<void> {
    const image = this.host.image;
    const view = this.peekView();

    if (!image || !view) return;

    const target = isLast ? this.host.getVisualCoords() : visualCellCenter(segment.to);
    const isStraight = segment.dCol === 0;

    // Хвост фишке не принадлежит: эффекты отдают замыкание над общим
    // эмиттером доски, и снесённая посреди падения фишка просто перестаёт
    // впрыскивать.
    const trail = isStraight
      ? this.runtime.fx.createFallTrail(segment.rows, image.y, resolveDestroyTint(this.host.id))
      : null;
    // Второй писатель масштаба помимо собственных твинов вида - единственный,
    // и безопасен ровно потому, что за последним отрезком идёт `land()`,
    // который перезадаёт масштаб.
    const scale = isStraight
      ? view.fallScale(segment.rows)
      : { scaleX: view.baseScale, scaleY: view.baseScale };

    await tweenDisplay(
      this.motion,
      image,
      {
        x: target.visualX,
        y: target.visualY,
        scaleX: scale.scaleX,
        scaleY: scale.scaleY,
        ...(fadeIn ? { alpha: 1 } : {}),
      },
      {
        duration: resolveFallDurationMs(Math.max(1, segment.rows)),
        delay: delayMs,
        ease: isStraight ? FALL_EASE : 'Sine.easeInOut',
        onUpdate: () => {
          if (image.destroyed) return;

          this.input.sync();
          trail?.track(image.x, image.y);
        },
      }
    );
  }

  /**
   * Въезд новой фишки из-за верхней границы по её пути оседания: тот же темп и
   * та же кривая, что у гравитации - добор это верх движения колонки, а не
   * второе событие после него. `delayMs` держит порядок внутри колонки, иначе
   * новые фишки из одной точки над доской пролетали бы сквозь друг друга.
   */
  enter(path: readonly IFallCell[], delayMs = 0): Promise<void> {
    const entry = { col: path[0]?.col ?? this.host.x, row: -1 };

    this.placeAboveColumn(entry.col);

    return this.host.fall(entry, path, delayMs, true);
  }

  /** Ставит СВОЙ спрайт над верхней границей колонки `col`, откуда он въедет. */
  private placeAboveColumn(col: number): void {
    if (!this.host.image) {
      this.host.render();
    }

    const image = this.host.image;
    const view = this.peekView();

    if (!image || !view) return;

    const { visualX, visualY } = visualCellCenter({ col, row: -1 });

    image.position.set(visualX, visualY);
    image.scale.set(view.baseScale, view.baseScale);
    image.alpha = 0;

    this.input.sync();
  }
}

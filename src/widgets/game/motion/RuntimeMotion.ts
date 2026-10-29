import { gsap } from 'gsap';
import { toGsapEase } from './easeNames';
import {
  DEFAULT_TWEEN_DURATION_MS,
  estimateTweenLifetimeMs,
  type ITweenTiming,
} from './tweenLifetime';

/** Цели твина: объект или список объектов (`sprite`, `sprite.scale`, ...). */
export type TMotionTargets = object | readonly (object | null | undefined)[] | null | undefined;

/** Что твин меняет у цели: конечные значения свойств. */
export type TMotionProps = Record<string, number | string>;

export interface ITweenOptions extends ITweenTiming {
  /** Кривая - Phaser-имя эталона (`'Back.easeOut'`) или GSAP-имя (`easeNames`). */
  ease?: string;
  onStart?: () => void;
  /** Кадр твина; `progress` - доля пройденного пути с учётом повторов, 0..1. */
  onUpdate?: (progress: number) => void;
  onComplete?: () => void;
}

/** Живой твин: промис его конца и досрочная остановка. */
export interface IMotionTween {
  /** Резолвится на конце, на остановке (`kill`, `killTweensOf`) и по страховке. */
  finished: Promise<void>;
  kill: () => void;
}

const SECOND_MS = 1000;

/** Как покадровый подписчик (`RuntimeMotion.onFrame`) относится к темпу рантайма. */
export type TFrameTimeScale = 'follow' | 'ignore';

/**
 * Есть ли на чём проигрывать твин. `null` у уничтоженной сущности (клетка
 * `HOLE` без спрайта) - не повод ждать анимацию, которой не будет.
 */
const hasLiveTargets = (targets: TMotionTargets): targets is object => {
  if (!targets) {
    return false;
  }

  if (Array.isArray(targets)) {
    return targets.some((target) => Boolean(target));
  }

  return true;
};

const liveTargets = (targets: object): object | object[] =>
  Array.isArray(targets) ? targets.filter((target): target is object => Boolean(target)) : targets;

/**
 * Часы и твины рантайма партии - единственный путь анимировать что-либо на
 * доске (замена `scene.tweens` и `scene.time` Phaser-эталона).
 *
 * **Один корневой таймлайн.** Все твины и задержки рантайма - дети одного
 * GSAP-таймлайна, поэтому пауза партии, ускорение под буферизованный ход
 * (`timeScale`) и уничтожение рантайма - по одной точке, а не обход всех
 * живых твинов. Разъедься твины и задержки по разным часам, страховочный
 * таймер твина срабатывал бы раньше честного конца на ускоренной доске и
 * рвал бы каскад на середине (см. «Темп доски» в `docs/game-flow.md`).
 *
 * **Часы - тикер Pixi, а не GSAP.** Корневой таймлайн стоит на паузе для
 * глобального тикера GSAP, а время ему двигает рантайм (`update`) из тикера
 * `Application`. Так анимации идут ровно по кадрам отрисовки: остановленный
 * тикер (пауза партии, скрытая вкладка) останавливает и их, и задержки, и
 * страховочные таймеры - тот же контракт, что у часов сцены эталона. Заодно
 * часы детерминированы: тест двигает их руками.
 *
 * Дочерние твины ставятся в позицию собственного счётчика времени `elapsed`,
 * а не `root.time()`: у таймлайна без детей время прижато к длительности (0),
 * а счётчик идёт всегда. Отыгравшие дети удаляются сами
 * (`autoRemoveChildren`), так что таймлайн не копит партию целиком.
 */
export class RuntimeMotion {
  private readonly root = gsap.timeline({ paused: true, autoRemoveChildren: true });
  /** Время корневого таймлайна, с: растёт только в `update`. */
  private elapsed = 0;
  private scale = 1;
  private paused = false;
  private destroyed = false;
  /** Покадровые подписчики часов (`onFrame`): частицы, тряска, вспышка, скелеты Spine. */
  private readonly frameCallbacks = new Map<(deltaMs: number) => void, TFrameTimeScale>();

  /** Сдвигает часы на `deltaMs` реального времени (кадр тикера). */
  update(deltaMs: number): void {
    if (this.paused || this.destroyed || deltaMs <= 0) {
      return;
    }

    const scaledMs = deltaMs * this.scale;

    this.elapsed += scaledMs / SECOND_MS;
    this.root.time(this.elapsed);

    // Копия: подписчик может сняться (или снять соседа) прямо в своём кадре.
    [...this.frameCallbacks].forEach(([callback, timeScale]) => {
      if (this.frameCallbacks.has(callback)) {
        callback(timeScale === 'ignore' ? deltaMs : scaledMs);
      }
    });
  }

  /**
   * Покадровый вызов на часах рантайма; на паузе и после уничтожения не
   * зовётся. То, что интегрирует время само, подписывается сюда, а не на
   * тикер Pixi: пауза партии останавливает его так же, как твины.
   *
   * Темп (`timeScale`) - выбор подписчика (`options.timeScale`):
   * - `'follow'` (по умолчанию) - время кадра умножено на темп, как у твинов:
   *   скелеты Spine (клип клетки обязан идти вровень с её твинами);
   * - `'ignore'` - реальное время кадра: частицы, тряска и вспышка. У
   *   Phaser-эталона эмиттеры и эффекты камеры живут на кадре игры, а не на
   *   `tweens.timeScale`/`time.timeScale`, поэтому на финале ×1.7 они идут в
   *   своём темпе - здесь так же.
   */
  onFrame(
    callback: (deltaMs: number) => void,
    options: { timeScale?: TFrameTimeScale } = {}
  ): () => void {
    if (this.destroyed) {
      return () => undefined;
    }

    this.frameCallbacks.set(callback, options.timeScale ?? 'follow');

    return () => {
      this.frameCallbacks.delete(callback);
    };
  }

  /**
   * Темп всего рантайма: твины, задержки и страховочные таймеры вместе
   * (ускорение каскада под буферизованный ход, финал).
   */
  setTimeScale(scale: number): void {
    this.scale = scale > 0 ? scale : 1;
  }

  get timeScale(): number {
    return this.scale;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  /**
   * Твин как промис, который нельзя потерять.
   *
   * Обычная обёртка `new Promise((resolve) => gsap.to(..., { onComplete:
   * resolve }))` резолвится ровно одним способом, и его легко не дождаться:
   * `killTweensOf` (снятие подсветки, зачистка эффектов) не зовёт
   * `onComplete`. Наверху такой промис ждут под `try/finally` (обработка
   * хода), и один потерянный конец оставлял бы доску занятой навсегда.
   *
   * Поэтому промис settl'ится по трём независимым причинам: конец, остановка
   * (`onInterrupt`) и страховочный таймер на расчётной длительности
   * (`estimateTweenLifetimeMs`) - на тех же часах, что и сам твин. На
   * уничтожении рантайма промис не резолвится вовсе: асинхронная цепочка
   * обрывается там же, где оборвалась партия, а не доигрывает на обломках.
   */
  tween(targets: TMotionTargets, props: TMotionProps, options: ITweenOptions = {}): Promise<void> {
    return this.add(targets, props, options).finished;
  }

  /** То же, что `tween`, но с ручкой остановки - для бесконечных (`repeat: -1`). */
  add(targets: TMotionTargets, props: TMotionProps, options: ITweenOptions = {}): IMotionTween {
    if (this.destroyed || !hasLiveTargets(targets)) {
      return { finished: Promise.resolve(), kill: () => undefined };
    }

    const {
      duration = DEFAULT_TWEEN_DURATION_MS,
      delay = 0,
      repeat = 0,
      yoyo = false,
      ease,
      onStart,
      onUpdate,
      onComplete,
    } = options;
    let settle: () => void = () => undefined;
    let safety: { kill: () => void } | null = null;
    const finished = new Promise<void>((resolve) => {
      let isSettled = false;

      settle = () => {
        if (isSettled || this.destroyed) {
          return;
        }

        isSettled = true;
        safety?.kill();
        resolve();
      };
    });

    // Phaser-`yoyo` - проход туда и обратно на каждый повтор, у GSAP каждый
    // повтор меняет направление: `repeat: r` эталона = `2r + 1` у GSAP.
    const gsapRepeat = repeat < 0 ? -1 : yoyo ? repeat * 2 + 1 : repeat;
    const tween = gsap.to(liveTargets(targets), {
      ...props,
      duration: duration / SECOND_MS,
      delay: delay / SECOND_MS,
      ease: toGsapEase(ease),
      repeat: gsapRepeat,
      yoyo,
      onStart,
      onUpdate: onUpdate
        ? function (this: gsap.core.Tween) {
            onUpdate(this.totalProgress());
          }
        : undefined,
      onComplete: () => {
        onComplete?.();
        settle();
      },
      onInterrupt: () => settle(),
    });

    this.root.add(tween, this.elapsed);

    const lifetimeMs = estimateTweenLifetimeMs({ duration, delay, repeat, yoyo });
    safety = lifetimeMs === null ? null : this.schedule(lifetimeMs, () => settle());

    return {
      finished,
      kill: () => {
        tween.kill();
        settle();
      },
    };
  }

  /**
   * Пауза на часах рантайма (замена `sceneDelay`). `setTimeout` пережил бы
   * уничтожение рантайма, и колбэк отработал бы по мёртвой доске; задержка
   * на часах рантайма на уничтожении просто не резолвится.
   */
  delay(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      this.schedule(ms, resolve);
    });
  }

  /**
   * Отложенный вызов на часах рантайма с ручкой отмены (замена
   * `scene.time.delayedCall` для отложенных подписок, которые надо снимать
   * на досрочном выходе).
   */
  schedule(ms: number, callback: () => void): { kill: () => void } {
    if (this.destroyed) {
      return { kill: () => undefined };
    }

    const call = gsap.delayedCall(Math.max(0, ms) / SECOND_MS, () => {
      if (!this.destroyed) {
        callback();
      }
    });

    this.root.add(call, this.elapsed);

    return { kill: () => call.kill() };
  }

  /** Останавливает твины целей; их промисы резолвятся (`onInterrupt`). */
  killTweensOf(targets: TMotionTargets): void {
    if (!hasLiveTargets(targets)) {
      return;
    }

    gsap.killTweensOf(liveTargets(targets));
  }

  /**
   * Гасит все твины и задержки рантайма. Промисы при этом не резолвятся (см.
   * `tween`): ожидающие цепочки обрываются вместе с партией.
   */
  destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.frameCallbacks.clear();
    this.root.getChildren(true, true, true).forEach((child) => child.kill());
    this.root.kill();
  }
}

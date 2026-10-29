import type { Container } from 'pixi.js';
import type { IMotionTween, ITweenOptions, RuntimeMotion, TMotionProps } from './RuntimeMotion';

/**
 * Что твин меняет у объекта сцены - словарь Phaser-твина эталона: позиция,
 * масштаб (общий или по осям), прозрачность и угол в градусах.
 */
export interface IDisplayTweenProps {
  x?: number;
  y?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  alpha?: number;
  angle?: number;
}

/** Объект сцены, которому пишет твин: спрайт, контейнер, графика. */
export type TTweenDisplay = Container;

const splitProps = ({ scale, scaleX, scaleY, ...own }: IDisplayTweenProps) => {
  const ownProps: TMotionProps = {};
  const scaleProps: TMotionProps = {};

  Object.entries(own).forEach(([key, value]) => {
    if (value !== undefined) {
      ownProps[key] = value;
    }
  });

  const x = scaleX ?? scale;
  const y = scaleY ?? scale;

  if (x !== undefined) {
    scaleProps.x = x;
  }

  if (y !== undefined) {
    scaleProps.y = y;
  }

  return { ownProps, scaleProps };
};

/**
 * Твин объекта сцены одной ручкой - замена `scene.tweens.add({ targets:
 * image, x, scale, alpha })` эталона.
 *
 * У Pixi масштаб - не число, а точка (`display.scale`), и GSAP не умеет
 * анимировать её как одно свойство. Поэтому твин делится на два - свойства
 * самого объекта и его `scale` - на одних часах, с одной кривой и
 * длительностью, а наружу отдаётся одна ручка: промис конца обоих и общая
 * остановка. `onUpdate` вешается на один из них - кадр всё равно общий.
 */
export const addDisplayTween = (
  motion: RuntimeMotion,
  display: TTweenDisplay | null | undefined,
  props: IDisplayTweenProps,
  options: ITweenOptions = {}
): IMotionTween => {
  if (!display || display.destroyed) {
    return { finished: Promise.resolve(), kill: () => undefined };
  }

  const { ownProps, scaleProps } = splitProps(props);
  const hasOwn = Object.keys(ownProps).length > 0;
  const hasScale = Object.keys(scaleProps).length > 0;
  const { onUpdate, onComplete, onStart, ...timing } = options;
  const tweens: IMotionTween[] = [];

  if (hasOwn) {
    tweens.push(motion.add(display, ownProps, { ...timing, onUpdate, onStart }));
  }

  if (hasScale) {
    tweens.push(
      motion.add(display.scale, scaleProps, {
        ...timing,
        onUpdate: hasOwn ? undefined : onUpdate,
        onStart: hasOwn ? undefined : onStart,
      })
    );
  }

  const finished = Promise.all(tweens.map((tween) => tween.finished)).then(() => {
    onComplete?.();
  });

  return {
    finished,
    kill: () => tweens.forEach((tween) => tween.kill()),
  };
};

/** Тот же твин промисом - для анимаций, которые ждут (`await`). */
export const tweenDisplay = (
  motion: RuntimeMotion,
  display: TTweenDisplay | null | undefined,
  props: IDisplayTweenProps,
  options: ITweenOptions = {}
): Promise<void> => addDisplayTween(motion, display, props, options).finished;

/**
 * Снимает все твины объекта (позиция, прозрачность, масштаб). Их промисы
 * резолвятся (`RuntimeMotion.killTweensOf`): ждущий каскад идёт дальше, а не
 * висит до страховки.
 */
export const killDisplayTweens = (
  motion: RuntimeMotion,
  display: TTweenDisplay | null | undefined
): void => {
  if (!display || display.destroyed) {
    return;
  }

  motion.killTweensOf([display, display.scale]);
};

/**
 * Снимает объект со сцены. Сначала - его твины: Pixi бросает на записи в
 * уничтоженный объект, и твин, доигрывающий по снятому спрайту, ронял бы
 * кадр часов рантайма.
 */
export const destroyDisplay = (
  motion: RuntimeMotion,
  display: TTweenDisplay | null | undefined
): void => {
  if (!display || display.destroyed) {
    return;
  }

  killDisplayTweens(motion, display);
  display.destroy({ children: true });
};

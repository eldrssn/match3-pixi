import type {
  TBoardStepType,
  TStepAnimation,
  TStepAnimationOverride,
  TStepAnimationOverrides,
  TStepAnimations,
} from './stepAnimationTypes';

/**
 * Анимации шагов партии: значения по умолчанию, поверх которых встают
 * переопределения проекта. Переопределение получает анимацию по умолчанию
 * третьим аргументом (`playDefault`) и само решает, звать ли её.
 *
 * Слияние одно и при старте проигрывателя: переопределение не может
 * «потерять» вид шага - всё, чего в нём нет, играется по умолчанию.
 */
export const resolveStepAnimations = (
  defaults: TStepAnimations,
  overrides: TStepAnimationOverrides
): TStepAnimations => {
  const resolved: Partial<Record<TBoardStepType, TStepAnimation>> = {};

  for (const type of Object.keys(defaults) as TBoardStepType[]) {
    const fallback = defaults[type] as TStepAnimation;
    const override = overrides[type] as TStepAnimationOverride | undefined;

    resolved[type] = override
      ? (context, step) =>
          override(context, step, async () => {
            await fallback(context, step);
          })
      : fallback;
  }

  return resolved as TStepAnimations;
};

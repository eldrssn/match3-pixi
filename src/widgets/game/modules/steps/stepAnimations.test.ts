import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_STEP_ANIMATIONS } from './defaultStepAnimations';
import { resolveStepAnimations } from './resolveStepAnimations';
import { STEP_ANIMATION_OVERRIDES } from './stepAnimationOverrides';
import type {
  IStepAnimationContext,
  TBoardStepType,
  TStepAnimation,
  TStepAnimations,
} from './stepAnimationTypes';

/** Все виды шагов протокола: запись по типу - новый вид шага сломает компиляцию теста. */
const STEP_TYPES = Object.keys({
  swap: true,
  detonate: true,
  transform: true,
  beam: true,
  colorSweep: true,
  rowsBlast: true,
  damage: true,
  matches: true,
  special: true,
  settle: true,
  collect: true,
  cascadePause: true,
  shuffle: true,
  spread: true,
  bonus: true,
  preBoost: true,
} satisfies Record<TBoardStepType, true>) as TBoardStepType[];

const context = {} as IStepAnimationContext;

const fakeDefaults = (log: string[]): TStepAnimations =>
  Object.fromEntries(
    STEP_TYPES.map((type) => [type, () => void log.push(`default:${type}`)])
  ) as unknown as TStepAnimations;

const play = (animations: TStepAnimations, type: TBoardStepType) =>
  (animations[type] as TStepAnimation)(context, { type } as never);

describe('DEFAULT_STEP_ANIMATIONS', () => {
  it('анимирует каждый вид шага протокола', () => {
    expect(Object.keys(DEFAULT_STEP_ANIMATIONS).sort()).toEqual([...STEP_TYPES].sort());
    expect(
      STEP_TYPES.filter((type) => typeof DEFAULT_STEP_ANIMATIONS[type] !== 'function')
    ).toEqual([]);
  });

  it('переопределения шаблона пусты: копия проекта начинает с анимаций по умолчанию', () => {
    expect(STEP_ANIMATION_OVERRIDES).toEqual({});
  });
});

describe('resolveStepAnimations', () => {
  it('без переопределений отдаёт анимации по умолчанию как есть', () => {
    const defaults = fakeDefaults([]);
    const resolved = resolveStepAnimations(defaults, {});

    STEP_TYPES.forEach((type) => expect(resolved[type]).toBe(defaults[type]));
  });

  it('переопределение получает анимацию по умолчанию и может доиграть поверх', async () => {
    const log: string[] = [];
    const resolved = resolveStepAnimations(fakeDefaults(log), {
      matches: async (_context, step, playDefault) => {
        log.push(`before:${step.type}`);
        await playDefault();
        log.push('after');
      },
    });

    await play(resolved, 'matches');
    await play(resolved, 'swap');

    expect(log).toEqual(['before:matches', 'default:matches', 'after', 'default:swap']);
  });

  it('переопределение без playDefault заменяет анимацию целиком', async () => {
    const log: string[] = [];
    const replacement = vi.fn();
    const resolved = resolveStepAnimations(fakeDefaults(log), { damage: replacement });

    await play(resolved, 'damage');

    expect(replacement).toHaveBeenCalledOnce();
    expect(log).toEqual([]);
  });
});

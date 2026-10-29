import { describe, expect, it } from 'vitest';
import { createPerfGovernor, PERF_GOVERNOR_OPTIONS } from './perfGovernor';

const feed = (samples: readonly number[]) => {
  const judge = createPerfGovernor();

  return samples.map((fps) => judge(fps));
};

describe('createPerfGovernor', () => {
  it('прогрев не в счёт, устойчивая просадка понижает качество один раз', () => {
    const low = PERF_GOVERNOR_OPTIONS.lowFps - 10;
    const verdicts = feed([5, 5, 5, low, low, low, low, low, low]);

    expect(verdicts.slice(0, 6)).toEqual([false, false, false, false, false, false]);
    expect(verdicts[6]).toBe(true);
    // Решение одно на партию.
    expect(verdicts.slice(7)).toEqual([false, false]);
  });

  it('одиночная просадка серию обнуляет', () => {
    const low = PERF_GOVERNOR_OPTIONS.lowFps - 10;
    const verdicts = feed([60, 60, 60, low, low, low, 60, low, low, low]);

    expect(verdicts.includes(true)).toBe(false);
  });
});

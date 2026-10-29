import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD_TIMING } from '../configs/timing';
import { mergeBoardTiming } from './mergeBoardTiming';

describe('mergeBoardTiming', () => {
  it('без переопределения отдаёт значения по умолчанию', () => {
    expect(mergeBoardTiming(DEFAULT_BOARD_TIMING, undefined)).toBe(DEFAULT_BOARD_TIMING);
    expect(mergeBoardTiming(DEFAULT_BOARD_TIMING, {})).toEqual(DEFAULT_BOARD_TIMING);
  });

  it('меняет только названные числа, соседей по группе оставляет', () => {
    const timing = mergeBoardTiming(DEFAULT_BOARD_TIMING, { fall: { baseMs: 999 } });

    expect(timing.fall.baseMs).toBe(999);
    expect(timing.fall.perRowMs).toBe(DEFAULT_BOARD_TIMING.fall.perRowMs);
    expect(timing.swap).toEqual(DEFAULT_BOARD_TIMING.swap);
  });

  it('не трогает значения по умолчанию', () => {
    mergeBoardTiming(DEFAULT_BOARD_TIMING, { swap: { durationMs: 1 } });

    expect(DEFAULT_BOARD_TIMING.swap.durationMs).not.toBe(1);
  });

  it('пропускает пустые и нечисловые значения и чужие ключи', () => {
    const timing = mergeBoardTiming(DEFAULT_BOARD_TIMING, {
      swap: { durationMs: undefined, rejectMs: Number.NaN },
      ...({ unknown: { value: 1 } } as object),
    });

    expect(timing.swap).toEqual(DEFAULT_BOARD_TIMING.swap);
    expect(timing).not.toHaveProperty('unknown');
  });
});

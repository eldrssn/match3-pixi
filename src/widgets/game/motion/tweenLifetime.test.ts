import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TWEEN_DURATION_MS,
  estimateTweenLifetimeMs,
  TWEEN_TIMEOUT_SAFETY_MS,
} from './tweenLifetime';

describe('estimateTweenLifetimeMs', () => {
  it('задержка + проход + запас', () => {
    expect(estimateTweenLifetimeMs({ duration: 200, delay: 50 })).toBe(
      250 + TWEEN_TIMEOUT_SAFETY_MS
    );
  });

  it('без длительности - дефолт эталона', () => {
    expect(estimateTweenLifetimeMs({})).toBe(DEFAULT_TWEEN_DURATION_MS + TWEEN_TIMEOUT_SAFETY_MS);
  });

  it('yoyo удваивает проход, повторы умножают его', () => {
    expect(estimateTweenLifetimeMs({ duration: 100, yoyo: true, repeat: 2 })).toBe(
      600 + TWEEN_TIMEOUT_SAFETY_MS
    );
  });

  it('бесконечный или непосчитанный твин страховки не получает', () => {
    expect(estimateTweenLifetimeMs({ duration: 100, repeat: -1 })).toBeNull();
    expect(estimateTweenLifetimeMs({ duration: Number.NaN })).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { resolveClipFrames, resolveClipRepeat } from './frameClip';

describe('resolveClipFrames', () => {
  it('без списка - все кадры листа по порядку', () => {
    expect(resolveClipFrames(4, undefined)).toEqual([0, 1, 2, 3]);
  });

  it('список кадров - в своём порядке, с повторами', () => {
    expect(resolveClipFrames(4, [3, 1, 1, 0])).toEqual([3, 1, 1, 0]);
  });

  it('кадры за пределами листа отбрасываются', () => {
    expect(resolveClipFrames(2, [0, 2, -1, 1.5, 1])).toEqual([0, 1]);
  });
});

describe('resolveClipRepeat', () => {
  it('по умолчанию один проход', () => {
    expect(resolveClipRepeat(undefined)).toBe(0);
  });

  it('-1 - бесконечно, остальное - целое число повторов', () => {
    expect(resolveClipRepeat(-1)).toBe(-1);
    expect(resolveClipRepeat(2)).toBe(2);
  });
});

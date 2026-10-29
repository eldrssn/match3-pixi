import { describe, expect, it } from 'vitest';

import { resolveComboPhraseFontSizePx } from './comboPhraseFit';

describe('resolveComboPhraseFontSizePx', () => {
  it('не трогает кегль, если фраза уже помещается', () => {
    expect(resolveComboPhraseFontSizePx(200, 320, 42, 26)).toBe(42);
    expect(resolveComboPhraseFontSizePx(320, 320, 42, 26)).toBe(42);
  });

  it('ужимает пропорционально превышению ширины', () => {
    expect(resolveComboPhraseFontSizePx(640, 320, 42, 10)).toBe(21);
  });

  it('не опускается ниже предела - дальше перенос делает CSS', () => {
    expect(resolveComboPhraseFontSizePx(1000, 320, 42, 30)).toBe(30);
  });

  it('вырожденные замеры возвращают базовый кегль', () => {
    expect(resolveComboPhraseFontSizePx(0, 320, 42, 26)).toBe(42);
    expect(resolveComboPhraseFontSizePx(400, 0, 42, 26)).toBe(42);
    expect(resolveComboPhraseFontSizePx(400, 320, 0, 26)).toBe(0);
  });
});

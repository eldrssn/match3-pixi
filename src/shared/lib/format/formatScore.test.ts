import { describe, expect, it } from 'vitest';
import { formatScore } from './formatScore';

describe('formatScore', () => {
  it('разбивает тысячи узким пробелом и округляет', () => {
    expect(formatScore(0)).toBe('0');
    expect(formatScore(999.6)).toBe('1 000');
    expect(formatScore(1_234_567)).toBe('1 234 567');
  });
});

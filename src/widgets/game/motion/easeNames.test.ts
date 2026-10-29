import { describe, expect, it } from 'vitest';
import { toGsapEase } from './easeNames';

describe('toGsapEase', () => {
  it('переводит все кривые, которые использует Phaser-эталон', () => {
    expect(toGsapEase('Linear')).toBe('none');
    expect(toGsapEase('Back.easeIn')).toBe('back.in');
    expect(toGsapEase('Back.easeOut')).toBe('back.out');
    expect(toGsapEase('Cubic.easeOut')).toBe('power2.out');
    expect(toGsapEase('Quad.easeIn')).toBe('power1.in');
    expect(toGsapEase('Quad.easeOut')).toBe('power1.out');
    expect(toGsapEase('Sine.easeIn')).toBe('sine.in');
    expect(toGsapEase('Sine.easeOut')).toBe('sine.out');
    expect(toGsapEase('Sine.easeInOut')).toBe('sine.inOut');
  });

  it('семейство без направления - easeOut, как у Phaser', () => {
    expect(toGsapEase('Quad')).toBe('power1.out');
    expect(toGsapEase('Power2')).toBe('power2.out');
  });

  it('без кривой - линейная (дефолт Phaser-твина)', () => {
    expect(toGsapEase(undefined)).toBe('none');
    expect(toGsapEase('')).toBe('none');
  });

  it('GSAP-имена проходят как есть', () => {
    expect(toGsapEase('back.out(2)')).toBe('back.out(2)');
    expect(toGsapEase('power2.inOut')).toBe('power2.inOut');
    expect(toGsapEase('none')).toBe('none');
  });

  it('незнакомое Phaser-имя - исключение, а не тихая линейная кривая', () => {
    expect(() => toGsapEase('Quadd.easeOut')).toThrow();
    expect(() => toGsapEase('Quad.easeSideways')).toThrow();
  });
});

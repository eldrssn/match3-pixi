import { describe, expect, it } from 'vitest';
import { createRandomSeed, createSeededRandom, normalizeSeed } from './seededRandom';

const take = (random: () => number, count: number): number[] =>
  Array.from({ length: count }, () => random());

describe('createSeededRandom', () => {
  it('одно зерно - одна и та же последовательность', () => {
    expect(take(createSeededRandom(42), 20)).toEqual(take(createSeededRandom(42), 20));
  });

  it('разные зёрна - разные последовательности', () => {
    expect(take(createSeededRandom(1), 5)).not.toEqual(take(createSeededRandom(2), 5));
  });

  it('отдаёт числа из [0, 1)', () => {
    const values = take(createSeededRandom(7), 1000);

    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it('распределение не вырождено: все корзины по 10% заполнены', () => {
    const buckets = new Array<number>(10).fill(0);

    take(createSeededRandom(123), 10_000).forEach((value) => {
      buckets[Math.floor(value * 10)]++;
    });

    expect(buckets.every((count) => count > 800 && count < 1200)).toBe(true);
  });
});

describe('normalizeSeed', () => {
  it('приводит к беззнаковому 32-битному целому', () => {
    expect(normalizeSeed(5.9)).toBe(5);
    expect(normalizeSeed(-3)).toBe(3);
    expect(normalizeSeed(0x1_0000_0001)).toBe(1);
    expect(normalizeSeed(Number.NaN)).toBe(0);
  });
});

describe('createRandomSeed', () => {
  it('отдаёт допустимое зерно', () => {
    const seed = createRandomSeed();

    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBe(normalizeSeed(seed));
  });
});

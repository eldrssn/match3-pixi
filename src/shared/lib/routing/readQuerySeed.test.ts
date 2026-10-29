import { describe, expect, it } from 'vitest';
import { readQuerySeed } from './readQuerySeed';

describe('readQuerySeed', () => {
  it('reads a non-negative integer seed', () => {
    expect(readQuerySeed('?seed=42')).toBe(42);
    expect(readQuerySeed('?level=2&seed= 0 ')).toBe(0);
    expect(readQuerySeed('?seed=4294967295')).toBe(4294967295);
  });

  it('returns null without the flag', () => {
    expect(readQuerySeed('')).toBeNull();
    expect(readQuerySeed('?level=3')).toBeNull();
  });

  it('ignores invalid values', () => {
    expect(readQuerySeed('?seed=')).toBeNull();
    expect(readQuerySeed('?seed=-1')).toBeNull();
    expect(readQuerySeed('?seed=1.5')).toBeNull();
    expect(readQuerySeed('?seed=abc')).toBeNull();
    expect(readQuerySeed('?seed=4294967296')).toBeNull();
  });
});

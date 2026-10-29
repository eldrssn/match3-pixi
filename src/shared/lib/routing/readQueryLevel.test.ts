import { describe, expect, it } from 'vitest';
import { readQueryLevel } from './readQueryLevel';

describe('readQueryLevel', () => {
  it('reads a positive integer level', () => {
    expect(readQueryLevel('?level=5')).toBe(5);
    expect(readQueryLevel('?x=1&level=3')).toBe(3);
  });

  it('returns null without the flag', () => {
    expect(readQueryLevel('')).toBeNull();
    expect(readQueryLevel('?gameDebug=true')).toBeNull();
  });

  it('ignores non-positive and non-integer values', () => {
    expect(readQueryLevel('?level=0')).toBeNull();
    expect(readQueryLevel('?level=-2')).toBeNull();
    expect(readQueryLevel('?level=2.5')).toBeNull();
    expect(readQueryLevel('?level=abc')).toBeNull();
    expect(readQueryLevel('?level=')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { readQueryPerf } from './readQueryPerf';

describe('readQueryPerf', () => {
  it('читает low и high, остальное игнорирует', () => {
    expect(readQueryPerf('?perf=low')).toBe('low');
    expect(readQueryPerf('?perf=HIGH')).toBe('high');
    expect(readQueryPerf('?perf=')).toBeNull();
    expect(readQueryPerf('?perf=ultra')).toBeNull();
    expect(readQueryPerf('')).toBeNull();
  });
});

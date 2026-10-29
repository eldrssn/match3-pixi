import { describe, expect, it } from 'vitest';
import { readQueryGameDebug } from './readQueryGameDebug';

describe('readQueryGameDebug', () => {
  it('enables debug controls only for an explicit true value', () => {
    expect(readQueryGameDebug('?gameDebug=true')).toBe(true);
    expect(readQueryGameDebug('?token=dev&gameDebug=true')).toBe(true);
    expect(readQueryGameDebug('?gameDebug=%20TRUE%20')).toBe(true);
  });

  it('keeps debug controls hidden for missing or non-true values', () => {
    expect(readQueryGameDebug('')).toBe(false);
    expect(readQueryGameDebug('?other=1')).toBe(false);
    expect(readQueryGameDebug('?gameDebug=')).toBe(false);
    expect(readQueryGameDebug('?gameDebug=false')).toBe(false);
    expect(readQueryGameDebug('?gameDebug=1')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { readQueryInsets } from './readQueryInsets';

describe('readQueryInsets', () => {
  it('reads top and bottom insets', () => {
    expect(readQueryInsets('?insets=47,34')).toEqual({ top: 47, bottom: 34 });
    expect(readQueryInsets('?level=2&insets= 59 , 21 ')).toEqual({ top: 59, bottom: 21 });
  });

  it('treats a single value as the top inset', () => {
    expect(readQueryInsets('?insets=47')).toEqual({ top: 47, bottom: 0 });
  });

  it('returns null without the flag', () => {
    expect(readQueryInsets('')).toBeNull();
    expect(readQueryInsets('?insets=')).toBeNull();
  });

  it('ignores malformed values entirely', () => {
    expect(readQueryInsets('?insets=47,abc')).toBeNull();
    expect(readQueryInsets('?insets=-1,34')).toBeNull();
    expect(readQueryInsets('?insets=1,2,3')).toBeNull();
  });
});

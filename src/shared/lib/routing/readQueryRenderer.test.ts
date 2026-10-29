import { describe, expect, it } from 'vitest';
import { readQueryRenderer } from './readQueryRenderer';

describe('readQueryRenderer', () => {
  it('читает webgl и webgpu, остальное игнорирует', () => {
    expect(readQueryRenderer('?renderer=webgl')).toBe('webgl');
    expect(readQueryRenderer('?renderer=WebGPU')).toBe('webgpu');
    expect(readQueryRenderer('?renderer=canvas')).toBeNull();
    expect(readQueryRenderer('?renderer=')).toBeNull();
    expect(readQueryRenderer('')).toBeNull();
  });
});

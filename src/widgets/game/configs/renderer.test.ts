import { describe, expect, it } from 'vitest';
import { resolveRendererPreference, toRendererKind } from './renderer';

describe('resolveRendererPreference', () => {
  it('auto и webgpu просят WebGPU, webgl - WebGL', () => {
    expect(resolveRendererPreference('auto')).toBe('webgpu');
    expect(resolveRendererPreference('webgpu')).toBe('webgpu');
    expect(resolveRendererPreference('webgl')).toBe('webgl');
  });
});

describe('toRendererKind', () => {
  it('узнаёт только WebGL и WebGPU', () => {
    expect(toRendererKind('webgl')).toBe('webgl');
    expect(toRendererKind('webgpu')).toBe('webgpu');
    expect(toRendererKind('canvas')).toBeNull();
  });
});

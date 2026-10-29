import { describe, expect, it } from 'vitest';
import { resolveSheetFrames } from './sheetFrames';

describe('resolveSheetFrames', () => {
  it('режет лист слева направо, сверху вниз', () => {
    expect(resolveSheetFrames(200, 200, 100, 100)).toEqual([
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 100, y: 0, width: 100, height: 100 },
      { x: 0, y: 100, width: 100, height: 100 },
      { x: 100, y: 100, width: 100, height: 100 },
    ]);
  });

  it('лента в одну колонку - кадры сверху вниз', () => {
    expect(resolveSheetFrames(168, 504, 168, 168).map(({ y }) => y)).toEqual([0, 168, 336]);
  });

  it('неполный кадр у края не берётся', () => {
    expect(resolveSheetFrames(250, 120, 100, 100)).toHaveLength(2);
  });

  it('пустой размер кадра - нет кадров', () => {
    expect(resolveSheetFrames(100, 100, 0, 100)).toEqual([]);
  });
});

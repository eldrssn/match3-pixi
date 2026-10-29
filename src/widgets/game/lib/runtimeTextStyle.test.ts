import { describe, expect, it } from 'vitest';
import { toRuntimeTextStyle } from './runtimeTextStyle';

const base = {
  fontFamily: 'Nunito',
  fontSize: '15px',
  color: '#ffffff',
  fontStyle: 'bold',
  align: 'center',
  resolution: 2,
};

describe('toRuntimeTextStyle', () => {
  it('переводит конфиг эталона в стиль Pixi', () => {
    expect(toRuntimeTextStyle(base)).toEqual({
      fontFamily: 'Nunito',
      fontSize: 15,
      fill: '#ffffff',
      fontWeight: 'bold',
      align: 'center',
    });
  });

  it('берёт размер из переопределения', () => {
    expect(toRuntimeTextStyle(base, { fontSize: '16px' }).fontSize).toBe(16);
  });

  it('без bold - обычное начертание, неизвестное выравнивание отбрасывается', () => {
    const style = toRuntimeTextStyle({ ...base, fontStyle: undefined, align: 'middle' });

    expect(style.fontWeight).toBe('normal');
    expect(style).not.toHaveProperty('align');
  });

  it('обводка - цветом и толщиной', () => {
    expect(toRuntimeTextStyle({ ...base, stroke: '#ff8a2a', strokeThickness: 6 }).stroke).toEqual({
      color: '#ff8a2a',
      width: 6,
    });
  });
});

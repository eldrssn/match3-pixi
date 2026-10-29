import { describe, expect, it } from 'vitest';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../configs/designSize';
import { resolveSceneLayout } from './sceneLayout';

const NO_INSETS = { top: 0, bottom: 0 };

describe('resolveSceneLayout', () => {
  it('без отступов вписывает мир в весь канвас', () => {
    const layout = resolveSceneLayout({ width: 720, height: 2000 }, NO_INSETS, 2);

    expect(layout.scale).toBe(720 / DESIGN_WIDTH);
    expect(layout.top).toBe(0);
    expect(layout.bottom).toBe(2000);
    expect(layout.centerY).toBe(1000);
  });

  it('переводит отступы из CSS px в пиксели канваса', () => {
    const layout = resolveSceneLayout({ width: 1125, height: 2001 }, { top: 47, bottom: 34 }, 3);

    expect(layout.top).toBe(141);
    expect(layout.bottom).toBe(2001 - 102);
    expect(layout.centerY).toBe(141 + (2001 - 141 - 102) / 2);
  });

  it('на коротком экране с вырезом масштаб считается по безопасной высоте', () => {
    // 375x667 CSS px при DPR 2, вырез 47 сверху: полная высота дала бы масштаб
    // по высоте канваса, и шапка, сдвинутая на вырез, наехала бы на доску.
    const canvas = { width: 750, height: 1334 };
    const layout = resolveSceneLayout(canvas, { top: 47, bottom: 0 }, 2);

    expect(layout.scale).toBe((1334 - 94) / DESIGN_HEIGHT);
    expect(layout.scale).toBeLessThan(resolveSceneLayout(canvas, NO_INSETS, 2).scale);
  });

  it('на широком канвасе масштаб по-прежнему ограничен шириной', () => {
    const layout = resolveSceneLayout({ width: 360, height: 5000 }, { top: 50, bottom: 50 }, 1);

    expect(layout.scale).toBe(1);
  });

  it('отступы больше канваса схлопывают зону, а не выворачивают её', () => {
    const layout = resolveSceneLayout({ width: 360, height: 100 }, { top: 80, bottom: 80 }, 1);

    expect(layout.top).toBe(80);
    expect(layout.bottom).toBe(80);
    expect(layout.scale).toBe(0);
  });

  it('нулевой или отрицательный пересчёт пикселей трактуется как 1', () => {
    const layout = resolveSceneLayout({ width: 360, height: 744 }, { top: 10, bottom: 0 }, 0);

    expect(layout.top).toBe(10);
    expect(layout.scale).toBe((744 - 10) / DESIGN_HEIGHT);
  });
});

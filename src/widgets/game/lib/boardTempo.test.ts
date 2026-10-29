import { describe, expect, it } from 'vitest';

import { BOARD_TIMING } from '../configs/timing';
import {
  resolveBoardIntroDelayMs,
  resolveCascadeIterationDelayMs,
  resolveFallDelayMs,
  resolveFallDurationMs,
  resolvePropellerFlightMs,
} from './boardTempo';

describe('resolveFallDurationMs', () => {
  it('makes a longer fall take longer', () => {
    // Главное свойство: при фиксированной длительности падение на пять строк
    // шло бы впятеро быстрее падения на одну.
    expect(resolveFallDurationMs(5)).toBeGreaterThan(resolveFallDurationMs(1));
  });

  it('grows linearly by the per-row step', () => {
    expect(resolveFallDurationMs(2) - resolveFallDurationMs(1)).toBe(BOARD_TIMING.fall.perRowMs);
  });

  it('never returns a non-positive duration', () => {
    // Отрицательная длительность завершила бы твин в тот же кадр, и фишка
    // осталась бы стоять мимо клетки: позицию ей задаёт только твин.
    expect(resolveFallDurationMs(0)).toBe(BOARD_TIMING.fall.baseMs);
    expect(resolveFallDurationMs(-3)).toBe(BOARD_TIMING.fall.baseMs);
  });
});

describe('resolveFallDelayMs', () => {
  it('starts the bottom cell of a column first', () => {
    expect(resolveFallDelayMs(0)).toBe(0);
  });

  it('delays each next cell above by one stagger step', () => {
    expect(resolveFallDelayMs(2) - resolveFallDelayMs(1)).toBe(BOARD_TIMING.fall.staggerMs);
  });

  it('never returns a negative delay', () => {
    expect(resolveFallDelayMs(-1)).toBe(0);
  });
});

describe('resolveCascadeIterationDelayMs', () => {
  it('keeps the full pause on the first iteration', () => {
    expect(resolveCascadeIterationDelayMs(1)).toBe(BOARD_TIMING.cascade.iterationDelayMs);
  });

  it('speeds the chain up with depth', () => {
    expect(resolveCascadeIterationDelayMs(2)).toBeLessThan(resolveCascadeIterationDelayMs(1));
    expect(resolveCascadeIterationDelayMs(3)).toBeLessThan(resolveCascadeIterationDelayMs(2));
  });

  it('never drops below the floor', () => {
    // Без пола глубокая цепочка превратилась бы в кашу без пауз между звеньями.
    expect(resolveCascadeIterationDelayMs(50)).toBe(BOARD_TIMING.cascade.iterationDelayMinMs);
  });

  it('treats a zero or negative iteration as the first one', () => {
    expect(resolveCascadeIterationDelayMs(0)).toBe(BOARD_TIMING.cascade.iterationDelayMs);
  });
});

describe('resolveBoardIntroDelayMs', () => {
  // Поле 5x5: центр приходится ровно на клетку (2, 2).
  it('starts the wave at the centre cell of an odd board', () => {
    expect(resolveBoardIntroDelayMs(2, 2, 5, 5)).toBe(0);
  });

  it('reaches the corners last', () => {
    expect(resolveBoardIntroDelayMs(0, 0, 5, 5)).toBeGreaterThan(
      resolveBoardIntroDelayMs(1, 1, 5, 5)
    );
    expect(resolveBoardIntroDelayMs(1, 1, 5, 5)).toBeGreaterThan(
      resolveBoardIntroDelayMs(2, 2, 5, 5)
    );
  });

  it('is symmetric around the centre on both axes', () => {
    expect(resolveBoardIntroDelayMs(0, 2, 5, 5)).toBe(resolveBoardIntroDelayMs(4, 2, 5, 5));
    expect(resolveBoardIntroDelayMs(2, 0, 5, 5)).toBe(resolveBoardIntroDelayMs(2, 4, 5, 5));
  });

  // Чётная сторона: центр лежит между клетками, поэтому все четыре центральные
  // стартуют одновременно. Округление к клетке сдвигало бы волну на полшага.
  it('splits the centre between cells on an even board', () => {
    const centre = resolveBoardIntroDelayMs(2, 2, 6, 6);

    expect(resolveBoardIntroDelayMs(3, 3, 6, 6)).toBe(centre);
    expect(resolveBoardIntroDelayMs(2, 3, 6, 6)).toBe(centre);
    expect(resolveBoardIntroDelayMs(3, 2, 6, 6)).toBe(centre);
  });

  it('scales with the configured wave step', () => {
    // Ровно одна клетка от центра по горизонтали.
    expect(resolveBoardIntroDelayMs(3, 2, 5, 5)).toBe(BOARD_TIMING.intro.waveStepMs);
  });

  // Тотальность: на вырожденном поле движок твинов принял бы `delay: NaN` молча, и
  // клетка не появилась бы вовсе.
  it('stays finite on a degenerate board', () => {
    expect(resolveBoardIntroDelayMs(0, 0, 1, 1)).toBe(0);
    expect(resolveBoardIntroDelayMs(0, 0, 0, 0)).toBe(0);
  });
});

describe('resolvePropellerFlightMs', () => {
  it('к соседней клетке летит минимум, дальше - шаг на клетку', () => {
    const { flightMinMs, flightMsPerCell } = BOARD_TIMING.special;

    expect(resolvePropellerFlightMs(1)).toBe(flightMinMs);
    expect(resolvePropellerFlightMs(3)).toBe(flightMinMs + 2 * flightMsPerCell);
  });

  it('через всё поле упирается в потолок, а не висит в воздухе', () => {
    expect(resolvePropellerFlightMs(12)).toBe(BOARD_TIMING.special.flightMaxMs);
    expect(resolvePropellerFlightMs(0)).toBe(BOARD_TIMING.special.flightMinMs);
  });
});

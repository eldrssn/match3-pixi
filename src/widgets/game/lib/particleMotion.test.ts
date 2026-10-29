import { describe, expect, it } from 'vitest';
import {
  advanceParticleFlow,
  resolveSpawnCount,
  spawnParticle,
  stepParticle,
  type IParticleConfig,
} from './particleMotion';

const BURST: IParticleConfig = {
  lifespan: { min: 320, max: 650 },
  speed: { min: 70, max: 200 },
  angle: { min: 0, max: 360 },
  gravityY: 350,
  rotate: { min: -180, max: 180 },
  scale: { start: 0.14, end: 0 },
  alpha: { start: 1, end: 0.4 },
};

/** Случайность-константа: середина каждого диапазона. */
const half = () => 0.5;

describe('particleMotion', () => {
  it('рождает частицу серединой диапазонов при random = 0.5', () => {
    const particle = spawnParticle(BURST, 10, 20, 0xff0000, half);

    expect(particle.lifeMs).toBeCloseTo(485);
    // Угол 180°: летит влево со скоростью 135 px/с.
    expect(particle.vx).toBeCloseTo(-135);
    expect(particle.vy).toBeCloseTo(0);
    expect(particle.rotation).toBeCloseTo(0);
    expect(particle.scaleX).toBe(0.14);
    expect(particle.alpha).toBe(1);
    expect(particle.tint).toBe(0xff0000);
    expect({ x: particle.x, y: particle.y }).toEqual({ x: 10, y: 20 });
  });

  it('кадр: гравитация в скорость, скорость в позицию, вид по доле жизни', () => {
    const particle = spawnParticle(BURST, 0, 0, 0xffffff, half);

    expect(stepParticle(BURST, particle, 100)).toBe(true);
    expect(particle.vy).toBeCloseTo(35);
    expect(particle.x).toBeCloseTo(-13.5);
    expect(particle.y).toBeCloseTo(3.5);

    const t = 100 / 485;

    expect(particle.scaleX).toBeCloseTo(0.14 * (1 - t));
    expect(particle.alpha).toBeCloseTo(1 - 0.6 * t);
  });

  it('частица умирает в кадре, где срок вышел', () => {
    const particle = spawnParticle(BURST, 0, 0, 0xffffff, half);

    expect(stepParticle(BURST, particle, 480)).toBe(true);
    expect(stepParticle(BURST, particle, 10)).toBe(false);
  });

  it('статичный случайный масштаб общий для осей, а оси перекрывают его', () => {
    const random = () => 0.25;
    const config: IParticleConfig = {
      lifespan: { min: 100, max: 100 },
      scale: { min: 0.05, max: 0.13 },
      alpha: { start: 1, end: 0.7 },
    };
    const particle = spawnParticle(config, 0, 0, 0, random);

    expect(particle.scaleX).toBeCloseTo(0.07);
    expect(particle.scaleY).toBeCloseTo(0.07);

    const smear = spawnParticle(
      {
        lifespan: { min: 100, max: 100 },
        scaleX: { start: 0.07, end: 0.03 },
        scaleY: { start: 0.22, end: 0.1 },
        alpha: { start: 0.5, end: 0 },
      },
      0,
      0,
      0,
      half
    );

    stepParticle({ lifespan: { min: 100, max: 100 }, alpha: { start: 0.5, end: 0 } }, smear, 50);
    expect(smear.scaleX).toBeCloseTo(0.05);
    expect(smear.scaleY).toBeCloseTo(0.16);
    expect(smear.alpha).toBeCloseTo(0.25);
  });

  it('зона рождения сдвигает точку на случайную точку прямоугольника', () => {
    const particle = spawnParticle(
      {
        lifespan: { min: 1, max: 1 },
        alpha: { start: 1, end: 1 },
        zone: { x: -3, y: -40, width: 6, height: 80 },
      },
      100,
      100,
      0,
      () => 1
    );

    expect({ x: particle.x, y: particle.y }).toEqual({ x: 103, y: 140 });
  });

  it('потолок живых частиц режет пачку', () => {
    const config: IParticleConfig = { ...BURST, maxAlive: 120 };

    expect(resolveSpawnCount(config, 118, 5)).toBe(2);
    expect(resolveSpawnCount(config, 130, 5)).toBe(0);
    expect(resolveSpawnCount(BURST, 1000, 5)).toBe(5);
  });

  it('поток: первая частица сразу, дальше по одной на период, просадка догоняет', () => {
    let state = advanceParticleFlow(0, 16, 90);

    expect(state.emit).toBe(1);
    expect(state.counterMs).toBe(74);

    state = advanceParticleFlow(state.counterMs, 50, 90);
    expect(state.emit).toBe(0);

    state = advanceParticleFlow(state.counterMs, 250, 90);
    expect(state.emit).toBe(3);
    expect(state.counterMs).toBe(44);
  });
});

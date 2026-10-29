/**
 * Чистая физика частиц эффектов доски - порт семантики эмиттера Phaser-эталона
 * (`add.particles`), без движка отрисовки: из чего рождается частица и как она
 * живёт кадр за кадром. Pixi-обвязка (`fx/ParticleLayer`) только переносит
 * состояние в `Particle` контейнера.
 *
 * Словарь конфига - тот же, что у эталона: `{ min, max }` - случайное значение
 * на рождении (статичное всю жизнь), `{ start, end }` - линейный переход по
 * доле прожитого (`Linear` - кривая по умолчанию у Phaser). Скорость - px/с,
 * гравитация - px/с², углы - градусы.
 */

/** Случайное значение на рождении частицы. */
export interface IParticleRange {
  min: number;
  max: number;
}

/** Линейный переход от рождения к смерти частицы. */
export interface IParticleEase {
  start: number;
  end: number;
}

/** Прямоугольник рождения вокруг точки эмиттера (`emitZone` типа `random`). */
export interface IParticleZone {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IParticleConfig {
  lifespan: IParticleRange;
  speed?: IParticleRange;
  /** Направление разлёта, градусы (0 - вправо, 90 - вниз). */
  angle?: IParticleRange;
  gravityY?: number;
  /** Поворот спрайта частицы, градусы - статичный. */
  rotate?: IParticleRange;
  /** Общий масштаб: переход или статичный случайный. */
  scale?: IParticleEase | IParticleRange;
  /** Масштаб по осям (перекрывает `scale`): вытянутый смаз хвоста падения. */
  scaleX?: IParticleEase;
  scaleY?: IParticleEase;
  alpha: IParticleEase;
  /** Потолок живых частиц: на пределе новые не рождаются. */
  maxAlive?: number;
  zone?: IParticleZone;
}

export interface IParticleState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ageMs: number;
  lifeMs: number;
  /** Поворот, радианы. */
  rotation: number;
  scaleX: number;
  scaleY: number;
  alpha: number;
  tint: number;
  /** Концы масштаба по осям: у статичного масштаба они равны. */
  scaleFromX: number;
  scaleToX: number;
  scaleFromY: number;
  scaleToY: number;
}

export type TRandom = () => number;

const DEG_TO_RAD = Math.PI / 180;
const SECOND_MS = 1000;

const between = ({ min, max }: IParticleRange, random: TRandom): number =>
  min + (max - min) * random();

const isEase = (value: IParticleEase | IParticleRange): value is IParticleEase => 'start' in value;

const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

/** Концы масштаба одной оси: своя ось, иначе общий масштаб, иначе 1. */
const resolveScaleEnds = (
  axis: IParticleEase | undefined,
  uniform: IParticleEase | IParticleRange | undefined,
  random: TRandom,
  fixed: { value: number | null }
): [number, number] => {
  if (axis) {
    return [axis.start, axis.end];
  }

  if (!uniform) {
    return [1, 1];
  }

  if (isEase(uniform)) {
    return [uniform.start, uniform.end];
  }

  // Статичный случайный масштаб общий для обеих осей: одна выборка на частицу.
  fixed.value ??= between(uniform, random);

  return [fixed.value, fixed.value];
};

/** Новая частица в точке эмиттера `(x, y)` (плюс случайная точка зоны). */
export const spawnParticle = (
  config: IParticleConfig,
  x: number,
  y: number,
  tint: number,
  random: TRandom = Math.random
): IParticleState => {
  const zone = config.zone;
  const spawnX = zone ? x + zone.x + zone.width * random() : x;
  const spawnY = zone ? y + zone.y + zone.height * random() : y;
  const speed = config.speed ? between(config.speed, random) : 0;
  const angle = (config.angle ? between(config.angle, random) : 0) * DEG_TO_RAD;
  const rotation = (config.rotate ? between(config.rotate, random) : 0) * DEG_TO_RAD;
  const fixedScale = { value: null as number | null };
  const [scaleFromX, scaleToX] = resolveScaleEnds(config.scaleX, config.scale, random, fixedScale);
  const [scaleFromY, scaleToY] = resolveScaleEnds(config.scaleY, config.scale, random, fixedScale);

  return {
    x: spawnX,
    y: spawnY,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    ageMs: 0,
    lifeMs: Math.max(1, between(config.lifespan, random)),
    rotation,
    scaleX: scaleFromX,
    scaleY: scaleFromY,
    alpha: config.alpha.start,
    tint,
    scaleFromX,
    scaleToX,
    scaleFromY,
    scaleToY,
  };
};

/**
 * Кадр жизни частицы - порядок эталона: сначала возраст (частица, чей срок
 * вышел, умирает в этом же кадре), затем скорость с гравитацией, затем
 * позиция и вид по доле прожитого. `false` - частица умерла.
 */
export const stepParticle = (
  config: IParticleConfig,
  particle: IParticleState,
  deltaMs: number
): boolean => {
  particle.ageMs += deltaMs;

  if (particle.ageMs >= particle.lifeMs) {
    return false;
  }

  const step = deltaMs / SECOND_MS;

  particle.vy += (config.gravityY ?? 0) * step;
  particle.x += particle.vx * step;
  particle.y += particle.vy * step;

  const t = particle.ageMs / particle.lifeMs;

  particle.scaleX = lerp(particle.scaleFromX, particle.scaleToX, t);
  particle.scaleY = lerp(particle.scaleFromY, particle.scaleToY, t);
  particle.alpha = lerp(config.alpha.start, config.alpha.end, t);

  return true;
};

/** Сколько частиц разрешено родить сейчас при потолке `maxAlive`. */
export const resolveSpawnCount = (
  config: IParticleConfig,
  aliveCount: number,
  requested: number
): number =>
  config.maxAlive === undefined
    ? requested
    : Math.max(0, Math.min(requested, config.maxAlive - aliveCount));

/**
 * Поток частиц с частотой `frequencyMs` (хвост полёта): сколько выпустить за
 * кадр и остаток счётчика. Первая частица - сразу на старте потока, дальше по
 * одной на каждый полный период; просевший кадр выпускает догоняющую пачку,
 * как счётчик потока эталона.
 */
export const advanceParticleFlow = (
  counterMs: number,
  deltaMs: number,
  frequencyMs: number
): { emit: number; counterMs: number } => {
  let counter = counterMs - deltaMs;
  let emit = 0;

  while (counter <= 0) {
    emit += 1;
    counter += frequencyMs;
  }

  return { emit, counterMs: counter };
};

import type { ICanvasArt } from '../../../lib/canvasArt';

/**
 * Текстуры эффектов: кадры луча ракеты, луч и кольца бустера «луч», звезда
 * бустера «лазер», волна бустера «шар» и частица разрушения. Всё рисуется
 * светлым: эффекты красятся тинтом и складываются поверх доски.
 *
 * Масштабы потребителей (`specialFx`, `boosterFx`, `BoardEntity`) делят на
 * ширину холста через `skinTextureWidth`, а не на свою копию числа.
 */

const GLOW = '120, 220, 255';

/** Кадр луча ракеты: луч шире доски с запасом. */
const BEAM_FRAME_WIDTH = 1088;
const BEAM_HEIGHT = 98;
/** Луч бустера «луч» - квадрат: штрих идёт по его диагонали. */
const LIGHT_TEXTURE_SIZE = 960;
/** Кольцо ударной волны: диаметр кольца с ореолом - ширина холста. */
const RING_TEXTURE_SIZE = 312;
/** Звезда бустера «лазер». */
const PORTAL_TEXTURE_SIZE = 480;
/** Волна бустера «шар»: шире доски, светлая полоса - в строку. */
const WAVE_TEXTURE_WIDTH = 1280;
const WAVE_TEXTURE_HEIGHT = 281;
const PARTICLE_SIZE = 160;

/**
 * Кадры луча ракеты (`laser1`..`laser9`, их число рантайм берёт из
 * `ROCKET_BEAM_FRAME_COUNT`): луч выстреливает на всю длину,
 * держится и истончается. `reach` - доля длины, `thickness` - доля высоты.
 */
const BEAM_FRAMES = [
  { reach: 0.3, thickness: 0.45, alpha: 1 },
  { reach: 0.55, thickness: 0.7, alpha: 1 },
  { reach: 0.8, thickness: 0.9, alpha: 1 },
  { reach: 1, thickness: 1, alpha: 1 },
  { reach: 1, thickness: 0.95, alpha: 0.95 },
  { reach: 1, thickness: 0.8, alpha: 0.85 },
  { reach: 1, thickness: 0.6, alpha: 0.7 },
  { reach: 1, thickness: 0.4, alpha: 0.5 },
  { reach: 1, thickness: 0.25, alpha: 0.3 },
] as const;

const capsule = (
  ctx: CanvasRenderingContext2D,
  length: number,
  thickness: number,
  cy: number
): void => {
  const r = thickness / 2;

  ctx.beginPath();
  ctx.moveTo(r, cy - r);
  ctx.lineTo(length - r, cy - r);
  ctx.arc(length - r, cy, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(r, cy + r);
  ctx.arc(r, cy, r, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
};

const drawBeamFrame =
  ({ reach, thickness, alpha }: (typeof BEAM_FRAMES)[number]): ICanvasArt['draw'] =>
  (ctx) => {
    const cy = BEAM_HEIGHT / 2;
    const length = BEAM_FRAME_WIDTH * reach;
    const fade = (color: string, from: number) => {
      const gradient = ctx.createLinearGradient(0, 0, length, 0);

      gradient.addColorStop(0, `rgba(${color}, ${from})`);
      gradient.addColorStop(0.75, `rgba(${color}, ${from * 0.7})`);
      gradient.addColorStop(1, `rgba(${color}, 0)`);

      return gradient;
    };

    capsule(ctx, length, BEAM_HEIGHT * 0.8 * thickness, cy);
    ctx.fillStyle = fade(GLOW, alpha * 0.45);
    ctx.fill();

    ctx.save();
    ctx.shadowColor = `rgba(${GLOW}, ${alpha})`;
    ctx.shadowBlur = 16;
    capsule(ctx, length, BEAM_HEIGHT * 0.3 * thickness, cy);
    ctx.fillStyle = fade('255, 255, 255', alpha);
    ctx.fill();
    ctx.restore();
  };

/** Луч бустера «луч»: сужающийся штрих из левого нижнего угла в правый верхний. */
const drawLight: ICanvasArt['draw'] = (ctx) => {
  const start = { x: 40, y: 920 };
  const end = { x: 940, y: 20 };
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const normal = { x: -Math.sin(angle), y: Math.cos(angle) };
  const startHalf = 20;
  const endHalf = 3;
  const gradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);

  gradient.addColorStop(0, 'rgba(235, 248, 255, 0.95)');
  gradient.addColorStop(1, 'rgba(235, 248, 255, 0)');

  ctx.save();
  ctx.shadowColor = `rgba(${GLOW}, 0.9)`;
  ctx.shadowBlur = 24;
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(start.x + normal.x * startHalf, start.y + normal.y * startHalf);
  ctx.lineTo(end.x + normal.x * endHalf, end.y + normal.y * endHalf);
  ctx.lineTo(end.x - normal.x * endHalf, end.y - normal.y * endHalf);
  ctx.lineTo(start.x - normal.x * startHalf, start.y - normal.y * startHalf);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(start.x, start.y, startHalf, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

/** Кольцо ударной волны: диаметр - ширина текстуры (`RING_TEXTURE_SIZE`). */
const drawRing: ICanvasArt['draw'] = (ctx) => {
  const c = RING_TEXTURE_SIZE / 2;

  ctx.save();
  ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
  ctx.shadowBlur = 10;
  ctx.lineWidth = 24;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.beginPath();
  ctx.arc(c, c, 130, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
};

/** Звезда бустера «лазер»: восемь лучей и россыпь ромбов вокруг яркой середины. */
const drawPortal: ICanvasArt['draw'] = (ctx) => {
  const c = PORTAL_TEXTURE_SIZE / 2;
  const rays = 8;

  for (let index = 0; index < rays; index++) {
    const angle = (index / rays) * Math.PI * 2;
    const tipX = c + Math.cos(angle) * 228;
    const tipY = c + Math.sin(angle) * 228;
    const side = { x: -Math.sin(angle) * 22, y: Math.cos(angle) * 22 };
    const gradient = ctx.createLinearGradient(c, c, tipX, tipY);

    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(c + side.x, c + side.y);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(c - side.x, c - side.y);
    ctx.closePath();
    ctx.fill();

    const gemAngle = angle + Math.PI / rays;
    const gx = c + Math.cos(gemAngle) * 150;
    const gy = c + Math.sin(gemAngle) * 150;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.moveTo(gx, gy - 16);
    ctx.lineTo(gx + 12, gy);
    ctx.lineTo(gx, gy + 16);
    ctx.lineTo(gx - 12, gy);
    ctx.closePath();
    ctx.fill();
  }

  const core = ctx.createRadialGradient(c, c, 0, c, c, 70);

  core.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  core.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(c, c, 70, 0, Math.PI * 2);
  ctx.fill();
};

/**
 * Волна бустера «шар»: энергетическая лента. Открывается кропом слева
 * направо, поэтому ярче всего - правый край, где летит шар.
 */
const drawWave: ICanvasArt['draw'] = (ctx) => {
  const width = WAVE_TEXTURE_WIDTH;
  const cy = 140;
  const fade = ctx.createLinearGradient(0, 0, width, 0);

  fade.addColorStop(0, `rgba(${GLOW}, 0)`);
  fade.addColorStop(1, `rgba(${GLOW}, 0.5)`);
  ctx.fillStyle = fade;
  ctx.fillRect(0, cy - 60, width, 120);

  ctx.save();
  ctx.shadowColor = `rgba(${GLOW}, 1)`;
  ctx.shadowBlur = 14;
  ctx.lineCap = 'round';

  [
    { amplitude: 50, period: 260, phase: 0, line: 10 },
    { amplitude: 34, period: 180, phase: 1.6, line: 7 },
    { amplitude: 20, period: 120, phase: 3.1, line: 5 },
  ].forEach(({ amplitude, period, phase, line }) => {
    const stroke = ctx.createLinearGradient(0, 0, width, 0);

    stroke.addColorStop(0, 'rgba(255, 255, 255, 0)');
    stroke.addColorStop(1, 'rgba(255, 255, 255, 0.95)');
    ctx.strokeStyle = stroke;
    ctx.lineWidth = line;
    ctx.beginPath();

    for (let x = 0; x <= width; x += 8) {
      ctx.lineTo(x, cy + Math.sin((x / period) * Math.PI * 2 + phase) * amplitude);
    }

    ctx.stroke();
  });
  ctx.restore();
};

/** Частица: белая четырёхлучевая искра, цвет даёт тинт эмиттера. */
const drawParticle: ICanvasArt['draw'] = (ctx) => {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(80, 4);
  ctx.quadraticCurveTo(92, 68, 156, 80);
  ctx.quadraticCurveTo(92, 92, 80, 156);
  ctx.quadraticCurveTo(68, 92, 4, 80);
  ctx.quadraticCurveTo(68, 68, 80, 4);
  ctx.closePath();
  ctx.fill();
};

export const FX_TEXTURES = {
  ...Object.fromEntries(
    BEAM_FRAMES.map((frame, index) => [
      `laser${index + 1}`,
      { width: BEAM_FRAME_WIDTH, height: BEAM_HEIGHT, draw: drawBeamFrame(frame) },
    ])
  ),
  light: { width: LIGHT_TEXTURE_SIZE, height: LIGHT_TEXTURE_SIZE, draw: drawLight },
  ellipse: { width: RING_TEXTURE_SIZE, height: RING_TEXTURE_SIZE, draw: drawRing },
  portal: { width: PORTAL_TEXTURE_SIZE, height: PORTAL_TEXTURE_SIZE, draw: drawPortal },
  wave: { width: WAVE_TEXTURE_WIDTH, height: WAVE_TEXTURE_HEIGHT, draw: drawWave },
  particle: { width: PARTICLE_SIZE, height: PARTICLE_SIZE, draw: drawParticle },
} satisfies Record<string, ICanvasArt>;

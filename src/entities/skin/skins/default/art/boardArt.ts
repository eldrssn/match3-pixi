import { cssColor, drawHighlight, roundRectPath, type ICanvasArt } from '../../../lib/canvasArt';
import { CELL_TEXTURE_WIDTH } from '../metrics';
import { FLOOR_DARK_COLOR, FLOOR_LIGHT_COLOR, RAINBOW_COLORS } from '../palette';

/**
 * Текстуры доски, которых нет файлами: клетки поля, слизь, предмет «опусти
 * вниз», колесо радуги и подложка. Предметы и радуга - `CELL_TEXTURE_WIDTH`
 * (общий `BASE_SCALE` доски), подложка - своя ширина (масштаб считается от неё
 * через `skinTextureWidth`), клетка поля - любая (`setDisplaySize`).
 */

const TILE_SIZE = 200;
/** Подложка - плитка 57 дизайн-px x 4. */
const FLOOR_TEXTURE_SIZE = 228;
const ITEM_SIZE = CELL_TEXTURE_WIDTH;

/** Колесо радуги чуть меньше клетки: фишки нарезаны с полями, и радуга не должна быть крупнее их. */
const WHEEL_RADIUS = ITEM_SIZE * 0.45;
const WHEEL_CORE_RADIUS = WHEEL_RADIUS * 0.34;
const WHEEL_RIM_WIDTH = 8;

const drawTile =
  (fill: string): ICanvasArt['draw'] =>
  (ctx) => {
    roundRectPath(ctx, 4, 4, TILE_SIZE - 8, TILE_SIZE - 8, 44);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.stroke();
  };

/** Слизь: зелёная капля с волнистым верхом, подтёками и пузырями. */
const drawSlime: ICanvasArt['draw'] = (ctx) => {
  const gradient = ctx.createLinearGradient(0, 24, 0, 156);

  gradient.addColorStop(0, '#9be35a');
  gradient.addColorStop(1, '#3a9e2c');

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowOffsetY = 4;
  ctx.shadowBlur = 6;
  ctx.fillStyle = gradient;

  ctx.beginPath();
  ctx.moveTo(20, 74);
  ctx.bezierCurveTo(18, 40, 46, 26, 64, 40);
  ctx.bezierCurveTo(74, 16, 108, 16, 116, 40);
  ctx.bezierCurveTo(136, 30, 152, 48, 148, 74);
  ctx.lineTo(148, 118);
  ctx.quadraticCurveTo(148, 128, 138, 128);
  ctx.lineTo(30, 128);
  ctx.quadraticCurveTo(20, 128, 20, 118);
  ctx.closePath();
  ctx.fill();

  // Подтёки - капсулы одного цвета с телом: одна заливка, без шва.
  [
    { x: 34, width: 20, bottom: 150 },
    { x: 76, width: 16, bottom: 140 },
    { x: 114, width: 20, bottom: 156 },
  ].forEach(({ x, width, bottom }) => {
    roundRectPath(ctx, x, 110, width, bottom - 110, width / 2);
    ctx.fill();
  });
  ctx.restore();

  drawHighlight(ctx, 54, 58, 20, 10, 0.45, -0.4);

  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  [
    { x: 104, y: 74, r: 9 },
    { x: 122, y: 100, r: 5 },
    { x: 64, y: 100, r: 6 },
  ].forEach(({ x, y, r }) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  });
};

/** «Опусти вниз»: янтарный гранёный кристалл. */
const drawDropGem: ICanvasArt['draw'] = (ctx) => {
  const top = 36;
  const girdle = 66;
  const bottom = 148;
  const facets: { points: [number, number][]; fill: string }[] = [
    // Корона
    {
      points: [
        [30, girdle],
        [56, top],
        [70, girdle],
      ],
      fill: '#ffd864',
    },
    {
      points: [
        [56, top],
        [112, top],
        [98, girdle],
        [70, girdle],
      ],
      fill: '#ffe89a',
    },
    {
      points: [
        [112, top],
        [138, girdle],
        [98, girdle],
      ],
      fill: '#ffc23d',
    },
    // Павильон
    {
      points: [
        [30, girdle],
        [70, girdle],
        [84, bottom],
      ],
      fill: '#f7a81f',
    },
    {
      points: [
        [70, girdle],
        [98, girdle],
        [84, bottom],
      ],
      fill: '#ffc23d',
    },
    {
      points: [
        [98, girdle],
        [138, girdle],
        [84, bottom],
      ],
      fill: '#e38a12',
    },
  ];

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowOffsetY = 4;
  ctx.shadowBlur = 6;
  ctx.fillStyle = '#b8640f';
  ctx.beginPath();
  ctx.moveTo(56, top);
  ctx.lineTo(112, top);
  ctx.lineTo(138, girdle);
  ctx.lineTo(84, bottom);
  ctx.lineTo(30, girdle);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  facets.forEach(({ points, fill }) => {
    ctx.beginPath();
    points.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  });

  ctx.lineJoin = 'round';
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#b8640f';
  ctx.beginPath();
  ctx.moveTo(56, top);
  ctx.lineTo(112, top);
  ctx.lineTo(138, girdle);
  ctx.lineTo(84, bottom);
  ctx.lineTo(30, girdle);
  ctx.closePath();
  ctx.stroke();

  drawHighlight(ctx, 72, 48, 10, 5, 0.8, -0.3);
};

/**
 * Радуга: цветовое колесо из цветов фишек с белой серединой и ободом. Своего
 * арта у радуги нет, а полупрозрачные эффекты (звезда портала, кольцо волны)
 * на тёмной клетке не читались ни с тинтом, ни со сложением цветов.
 */
const drawRainbowWheel: ICanvasArt['draw'] = (ctx) => {
  const center = ITEM_SIZE / 2;
  const sector = (Math.PI * 2) / RAINBOW_COLORS.length;

  // Белый диск под секторами: сглаженные стыки секторов светлеют, а не
  // просвечивают тёмной клеткой.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(center, center, WHEEL_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  RAINBOW_COLORS.forEach((color, index) => {
    ctx.fillStyle = cssColor(color);
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.arc(center, center, WHEEL_RADIUS, index * sector, (index + 1) * sector);
    ctx.closePath();
    ctx.fill();
  });

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(center, center, WHEEL_CORE_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = WHEEL_RIM_WIDTH;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.beginPath();
  ctx.arc(center, center, WHEEL_RADIUS - WHEEL_RIM_WIDTH / 2, 0, Math.PI * 2);
  ctx.stroke();
};

/** Подложка: светлая плитка в один слой, тёмная с внутренней рамкой - в два. */
const drawFloor =
  (layers: 1 | 2): ICanvasArt['draw'] =>
  (ctx) => {
    roundRectPath(ctx, 8, 8, FLOOR_TEXTURE_SIZE - 16, FLOOR_TEXTURE_SIZE - 16, 40);
    ctx.fillStyle =
      layers === 2 ? cssColor(FLOOR_DARK_COLOR, 0.8) : cssColor(FLOOR_LIGHT_COLOR, 0.45);
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = cssColor(FLOOR_DARK_COLOR);
    ctx.stroke();

    if (layers === 2) {
      roundRectPath(ctx, 30, 30, FLOOR_TEXTURE_SIZE - 60, FLOOR_TEXTURE_SIZE - 60, 24);
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    [
      [48, 48],
      [180, 48],
      [48, 180],
      [180, 180],
    ].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    });
  };

export const BOARD_TEXTURES = {
  tile: { width: TILE_SIZE, height: TILE_SIZE, draw: drawTile('#262c3e') },
  tileBright: { width: TILE_SIZE, height: TILE_SIZE, draw: drawTile('#30374f') },
  slime: { width: ITEM_SIZE, height: ITEM_SIZE, draw: drawSlime },
  drop: { width: ITEM_SIZE, height: ITEM_SIZE, draw: drawDropGem },
  rainbowWheel: { width: ITEM_SIZE, height: ITEM_SIZE, draw: drawRainbowWheel },
  floor: { width: FLOOR_TEXTURE_SIZE, height: FLOOR_TEXTURE_SIZE, draw: drawFloor(1) },
  floor2: { width: FLOOR_TEXTURE_SIZE, height: FLOOR_TEXTURE_SIZE, draw: drawFloor(2) },
} satisfies Record<string, ICanvasArt>;

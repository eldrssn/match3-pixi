import {
  cssColor,
  drawHighlight,
  roundRectPath,
  starPath,
  type ICanvasArt,
} from '../../../lib/canvasArt';
import {
  HUD_PANEL_BORDER_COLOR,
  HUD_PANEL_COLOR,
  HUD_PLATE_COLOR,
  HUD_RIM_COLOR,
} from '../palette';

/**
 * Текстуры интерфейса партии: панели целей и бустеров, плашки шапки, кнопка
 * звука, подсветка выбранного бустера и иконки трёх бустеров. Модули рантайма
 * (`MovesCounter`, `ExitButton`, `SoundToggle`, `boosterFx`) делят на ширину
 * холста через `skinTextureWidth`, а не на свою копию числа.
 */

/** Ширина плашек шапки и кнопки звука (`exit`, `num`, `soundToggleOn/Off`). */
const PLATE_TEXTURE_SIZE = 512;
/** Иконки бустеров (`boosterBeam`, `boosterLaser`, `boosterBall`). */
const BOOSTER_ICON_SIZE = 512;

const ICON_COLOR = '#ffffff';

/** Плашка: тёмная основа с нейтральным ободом - у выхода, ходов и кнопки звука. */
const drawPlate = (ctx: CanvasRenderingContext2D, width: number, height: number): void => {
  roundRectPath(ctx, 28, 28, width - 56, height - 56, 110);
  ctx.fillStyle = cssColor(HUD_PLATE_COLOR);
  ctx.fill();
  ctx.lineWidth = 34;
  ctx.strokeStyle = cssColor(HUD_RIM_COLOR);
  ctx.stroke();
};

const drawPanel = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  radius: number
): void => {
  roundRectPath(ctx, 8, 8, width - 16, height - 16, radius);
  ctx.fillStyle = cssColor(HUD_PANEL_COLOR, 0.92);
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = cssColor(HUD_PANEL_BORDER_COLOR);
  ctx.stroke();
};

/** Панель целей: «пилюля» без обводки с язычком снизу по центру. */
const drawGoalPanel: ICanvasArt['draw'] = (ctx) => {
  ctx.fillStyle = cssColor(HUD_PANEL_COLOR);
  roundRectPath(ctx, 258, 196, 180, 72, 24);
  ctx.fill();
  roundRectPath(ctx, 8, 8, 680, 224, 112);
  ctx.fill();
  // Прозрачность панели - одним проходом по готовому силуэту: заливка с
  // альфой по каждой фигуре отдельно затемняла бы место, где язычок заходит
  // под пилюлю.
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.92)';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
};

const drawExit: ICanvasArt['draw'] = (ctx) => {
  drawPlate(ctx, PLATE_TEXTURE_SIZE, PLATE_TEXTURE_SIZE);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 56;
  ctx.strokeStyle = ICON_COLOR;
  ctx.beginPath();
  ctx.moveTo(352, 256);
  ctx.lineTo(166, 256);
  ctx.moveTo(250, 168);
  ctx.lineTo(160, 256);
  ctx.lineTo(250, 344);
  ctx.stroke();
};

/** Динамик кнопки звука: корпус и раструб. */
const drawSpeaker = (ctx: CanvasRenderingContext2D): void => {
  ctx.fillStyle = ICON_COLOR;
  ctx.fillRect(150, 212, 62, 88);
  ctx.beginPath();
  ctx.moveTo(196, 212);
  ctx.lineTo(290, 140);
  ctx.lineTo(290, 372);
  ctx.lineTo(196, 300);
  ctx.closePath();
  ctx.fill();
};

/** Звук включён: динамик и две дуги волны. */
const drawSoundOn: ICanvasArt['draw'] = (ctx) => {
  drawPlate(ctx, PLATE_TEXTURE_SIZE, PLATE_TEXTURE_SIZE);
  drawSpeaker(ctx);

  ctx.lineWidth = 24;
  ctx.strokeStyle = ICON_COLOR;
  [56, 100].forEach((radius) => {
    ctx.beginPath();
    ctx.arc(300, 256, radius, -0.8, 0.8);
    ctx.stroke();
  });
};

/** Звук выключен: динамик и крестик. */
const drawSoundOff: ICanvasArt['draw'] = (ctx) => {
  drawPlate(ctx, PLATE_TEXTURE_SIZE, PLATE_TEXTURE_SIZE);
  drawSpeaker(ctx);

  ctx.lineWidth = 26;
  ctx.strokeStyle = ICON_COLOR;
  ctx.beginPath();
  ctx.moveTo(320, 206);
  ctx.lineTo(404, 306);
  ctx.moveTo(404, 206);
  ctx.lineTo(320, 306);
  ctx.stroke();
};

/** Подсветка выбранного бустера: квадрат с градиентом снизу вверх. */
const drawTargetedBooster: ICanvasArt['draw'] = (ctx) => {
  const gradient = ctx.createLinearGradient(0, 8, 0, 232);

  gradient.addColorStop(0, 'rgba(91, 45, 122, 0.85)');
  gradient.addColorStop(1, cssColor(HUD_PANEL_BORDER_COLOR, 0.95));
  roundRectPath(ctx, 8, 8, 224, 224, 56);
  ctx.fillStyle = gradient;
  ctx.fill();
};

const withIconShadow = (ctx: CanvasRenderingContext2D, paint: () => void): void => {
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowOffsetY = 14;
  ctx.shadowBlur = 20;
  paint();
  ctx.restore();
};

/** Луч - удар по одной клетке: мишень с перекрестием. */
const drawBeamIcon: ICanvasArt['draw'] = (ctx) => {
  const c = BOOSTER_ICON_SIZE / 2;
  const disc = ctx.createRadialGradient(c - 60, c - 60, 20, c, c, 200);

  disc.addColorStop(0, '#ff8f93');
  disc.addColorStop(1, '#d6343b');

  withIconShadow(ctx, () => {
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(c, c, 190, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.lineWidth = 34;
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(c, c, 124, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(c, c, 46, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineCap = 'round';
  ctx.lineWidth = 26;
  ctx.strokeStyle = '#ffffff';
  [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ].forEach(([dx, dy]) => {
    ctx.beginPath();
    ctx.moveTo(c + dx * 160, c + dy * 160);
    ctx.lineTo(c + dx * 226, c + dy * 226);
    ctx.stroke();
  });

  drawHighlight(ctx, c - 80, c - 96, 48, 24, 0.35, -0.6);
};

/** Лазер - снимает цвет: волшебная палочка со звездой. */
const drawLaserIcon: ICanvasArt['draw'] = (ctx) => {
  withIconShadow(ctx, () => {
    ctx.lineCap = 'round';
    ctx.lineWidth = 56;
    ctx.strokeStyle = cssColor(HUD_PLATE_COLOR);
    ctx.beginPath();
    ctx.moveTo(110, 410);
    ctx.lineTo(300, 220);
    ctx.stroke();
  });

  ctx.lineCap = 'round';
  ctx.lineWidth = 56;
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(250, 270);
  ctx.lineTo(300, 220);
  ctx.stroke();

  withIconShadow(ctx, () => {
    starPath(ctx, 330, 186, 5, 136, 62);
    ctx.fillStyle = '#ffd24d';
    ctx.fill();
  });
  starPath(ctx, 330, 186, 5, 136, 62);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#f29a1d';
  ctx.stroke();
  drawHighlight(ctx, 300, 160, 26, 14, 0.55, -0.5);

  ctx.fillStyle = '#ffffff';
  [
    { x: 150, y: 140, r: 30 },
    { x: 440, y: 360, r: 24 },
  ].forEach(({ x, y, r }) => {
    starPath(ctx, x, y, 4, r, r * 0.3);
    ctx.fill();
  });
};

/** Шар - волна по трём строкам: глянцевый мяч с полосами скорости. */
const drawBallIcon: ICanvasArt['draw'] = (ctx) => {
  const cx = 290;
  const cy = 256;
  const ball = ctx.createRadialGradient(cx - 60, cy - 70, 20, cx, cy, 180);

  ball.addColorStop(0, '#9fdcff');
  ball.addColorStop(1, '#2864cf');

  ctx.lineCap = 'round';
  ctx.lineWidth = 24;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  [
    { y: cy - 80, from: 30, to: 110 },
    { y: cy, from: 12, to: 96 },
    { y: cy + 80, from: 30, to: 110 },
  ].forEach(({ y, from, to }) => {
    ctx.beginPath();
    ctx.moveTo(from, y);
    ctx.lineTo(to, y);
    ctx.stroke();
  });

  withIconShadow(ctx, () => {
    ctx.fillStyle = ball;
    ctx.beginPath();
    ctx.arc(cx, cy, 170, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.lineWidth = 18;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, 170, 60, -0.35, 0, Math.PI * 2);
  ctx.stroke();

  drawHighlight(ctx, cx - 62, cy - 84, 52, 28, 0.6, -0.6);
};

export const HUD_TEXTURES = {
  goalPannel: { width: 696, height: 280, draw: drawGoalPanel },
  boostersBg: { width: 944, height: 336, draw: (ctx) => drawPanel(ctx, 944, 336, 90) },
  num: {
    width: PLATE_TEXTURE_SIZE,
    height: 446,
    draw: (ctx) => drawPlate(ctx, PLATE_TEXTURE_SIZE, 446),
  },
  exit: { width: PLATE_TEXTURE_SIZE, height: PLATE_TEXTURE_SIZE, draw: drawExit },
  soundToggleOn: { width: PLATE_TEXTURE_SIZE, height: PLATE_TEXTURE_SIZE, draw: drawSoundOn },
  soundToggleOff: { width: PLATE_TEXTURE_SIZE, height: PLATE_TEXTURE_SIZE, draw: drawSoundOff },
  targetedBooster: { width: 240, height: 240, draw: drawTargetedBooster },
  boosterBeam: { width: BOOSTER_ICON_SIZE, height: BOOSTER_ICON_SIZE, draw: drawBeamIcon },
  boosterLaser: { width: BOOSTER_ICON_SIZE, height: BOOSTER_ICON_SIZE, draw: drawLaserIcon },
  boosterBall: { width: BOOSTER_ICON_SIZE, height: BOOSTER_ICON_SIZE, draw: drawBallIcon },
} satisfies Record<string, ICanvasArt>;

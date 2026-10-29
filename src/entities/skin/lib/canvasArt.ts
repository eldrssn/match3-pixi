/**
 * Процедурная текстура: размер холста и рисование на нём средствами Canvas 2D.
 *
 * Размер - это «ширина исходника» в смысле правила игровых текстур: масштабы
 * спрайтов пишутся дробью «дизайн-px / ширина текстуры», и процедурная
 * текстура подчиняется ему так же, как загруженная (`skinTextureWidth`).
 *
 * Здесь же - общие помощники рисования, которыми пользуется любой скин
 * (`skins/<name>/art`). Движка отрисовки они не знают: холст в менеджер текстур кладёт
 * рантайм (`widgets/game/textures/registerProceduralTextures`).
 */
export interface ICanvasArt {
  readonly width: number;
  readonly height: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
}

/** `0xRRGGBB` -> CSS-цвет: палитра слоя канваса (`skins/<name>/palette`) живёт числами. */
export const cssColor = (color: number, alpha = 1): string =>
  `rgba(${(color >> 16) & 0xff}, ${(color >> 8) & 0xff}, ${color & 0xff}, ${alpha})`;

/**
 * Контур скруглённого прямоугольника. Свой, а не `ctx.roundRect`: тот есть
 * только с Safari 16, а шаблон поддерживает и более старые WebView.
 */
export const roundRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void => {
  const r = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
};

/** Многоконечная звезда с центром `cx`/`cy`. */
export const starPath = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  points: number,
  outerRadius: number,
  innerRadius: number
): void => {
  const step = Math.PI / points;

  ctx.beginPath();

  for (let index = 0; index < points * 2; index++) {
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const angle = index * step - Math.PI / 2;

    ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
  }

  ctx.closePath();
};

/** Мягкий световой блик - полупрозрачный белый эллипс. */
export const drawHighlight = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radiusX: number,
  radiusY: number,
  alpha: number,
  rotation = 0
): void => {
  ctx.save();
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, radiusX, radiusY, rotation, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

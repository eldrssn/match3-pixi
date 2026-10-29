/**
 * Конфиг текста сцены в словаре Phaser-эталона (`GAME_CONFIG.*TextConfig`):
 * CSS-строки размера и цвета, `fontStyle`, обводка толщиной.
 */
export interface IRuntimeTextConfig {
  fontFamily: string;
  fontSize: string;
  color: string;
  fontStyle?: string;
  align?: string;
  stroke?: string;
  strokeThickness?: number;
  /** Разрешение печати (`getTextResolution`) - геттер у конфига. */
  readonly resolution: number;
}

/** Стиль текста Pixi (`TextStyleOptions`) - ровно те поля, что нужны шапке. */
export interface IRuntimeTextStyle {
  fontFamily: string;
  fontSize: number;
  fill: string;
  fontWeight: 'bold' | 'normal';
  align?: 'left' | 'center' | 'right';
  stroke?: { color: string; width: number };
}

const ALIGNS = ['left', 'center', 'right'] as const;

const isAlign = (value: string | undefined): value is NonNullable<IRuntimeTextStyle['align']> =>
  ALIGNS.some((align) => align === value);

/**
 * Перевод конфига эталона в стиль Pixi: размер - число px, цвет - `fill`,
 * `fontStyle: 'bold'` - `fontWeight`, обводка - `{ color, width }`. Конфиги
 * остаются одной таблицей (`GAME_CONFIG`), а не второй копией под Pixi.
 */
export const toRuntimeTextStyle = (
  config: IRuntimeTextConfig,
  overrides: Partial<Pick<IRuntimeTextConfig, 'fontSize'>> = {}
): IRuntimeTextStyle => {
  const fontSize = Number.parseFloat(overrides.fontSize ?? config.fontSize);
  const style: IRuntimeTextStyle = {
    fontFamily: config.fontFamily,
    fontSize: Number.isFinite(fontSize) ? fontSize : 16,
    fill: config.color,
    fontWeight: config.fontStyle?.includes('bold') ? 'bold' : 'normal',
  };

  if (isAlign(config.align)) {
    style.align = config.align;
  }

  if (config.stroke && config.strokeThickness) {
    style.stroke = { color: config.stroke, width: config.strokeThickness };
  }

  return style;
};

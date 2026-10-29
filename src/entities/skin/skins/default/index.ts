import type { ISkinManifest } from '../../model/types';
import { DEFAULT_ELEMENTS } from './elements';
import { FX_COLORS, HUD_COLORS, RAINBOW_COLORS, STAR_DIM_COLOR, STAR_LIT_COLOR } from './palette';
import { DEFAULT_SOUNDS } from './sounds';
import { DEFAULT_TIMING } from './timing';
import { DEFAULT_TEXTURES } from './textures';

/**
 * Манифест скина по умолчанию. Папка скина самодостаточна: файлы текстур
 * (`images/`), иконки DOM (`icons/`), процедурное рисование (`art/`), цвета
 * (`palette.ts`), описание элементов (`elements.ts`), звуки (`sounds.ts`) и
 * темп доски (`timing.ts`).
 * Заменить скин - положить рядом другую папку с таким же манифестом и
 * переключить одну строку в `model/activeSkin.ts`.
 */
export const DEFAULT_SKIN: ISkinManifest = {
  name: 'default',
  elements: DEFAULT_ELEMENTS,
  textures: DEFAULT_TEXTURES,
  colors: {
    rainbow: RAINBOW_COLORS,
    starLit: STAR_LIT_COLOR,
    starDim: STAR_DIM_COLOR,
    fx: FX_COLORS,
    hud: HUD_COLORS,
  },
  fonts: {
    game: 'Nunito',
  },
  sounds: DEFAULT_SOUNDS,
  timing: DEFAULT_TIMING,
};

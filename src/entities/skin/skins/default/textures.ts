import type { ICanvasArt, ISkinTextureFile, ISkinTextures } from '../../model/types';
import { BOARD_TEXTURES } from './art/boardArt';
import { FX_TEXTURES } from './art/fxArt';
import { HUD_TEXTURES } from './art/hudArt';
import bombUrl from './images/bomb.webp?url';
import cargoUrl from './images/cargo.webp?url';
import cargoCrackedUrl from './images/cargo2.webp?url';
import chainUrl from './images/chain.webp?url';
import chipBlueUrl from './images/chip_blue.webp?url';
import chipGreenUrl from './images/chip_green.webp?url';
import chipPinkUrl from './images/chip_pink.webp?url';
import chipRedUrl from './images/chip_red.webp?url';
import chipVioletUrl from './images/chip_violet.webp?url';
import chipYellowUrl from './images/chip_yellow.webp?url';
import iceUrl from './images/ice.webp?url';
import iceCrackedUrl from './images/ice2.webp?url';
import propellerUrl from './images/propeller.webp?url';
import rocketUrl from './images/rocket.webp?url';
import stoneUrl from './images/stone.webp?url';
import { CELL_TEXTURE_WIDTH } from './metrics';

/** Кадр предмета клетки: все файлы этого скина нарезаны в `CELL_TEXTURE_WIDTH`. */
const cellFile = (url: string): ISkinTextureFile => ({ url, width: CELL_TEXTURE_WIDTH });

/**
 * Текстуры-файлы скина: фишки, блокеры и спецфишки (`images/`). URL - через
 * Vite-импорт `?url`: файл живёт в папке скина и едет в сборку с хешем, а база
 * (`VITE_CDN_BASE_URL` -> `base`) подставляется сборкой. Прогрев
 * (`warmGameAssets`) и загрузчик рантайма берут один и тот же URL отсюда.
 *
 * Ключ - имя текстуры в рантайме, на него ссылается описание элемента
 * (`elements.ts`). Чтобы заменить процедурную текстуру картинкой, добавьте
 * файл под её ключом (`tile`, `goalPannel`, `slime`, ...) с его шириной -
 * холст под этим ключом рисоваться не будет.
 */
export const DEFAULT_TEXTURE_FILES = {
  yellow: cellFile(chipYellowUrl),
  red: cellFile(chipRedUrl),
  pink: cellFile(chipPinkUrl),
  violet: cellFile(chipVioletUrl),
  green: cellFile(chipGreenUrl),
  blue: cellFile(chipBlueUrl),

  cargo: cellFile(cargoUrl),
  cargo2: cellFile(cargoCrackedUrl),
  stone: cellFile(stoneUrl),
  ice: cellFile(iceUrl),
  ice2: cellFile(iceCrackedUrl),
  chain: cellFile(chainUrl),

  rocket: cellFile(rocketUrl),
  bomb: cellFile(bombUrl),
  propeller: cellFile(propellerUrl),
} as const satisfies Record<string, ISkinTextureFile>;

/** Процедурные текстуры скина: доска, интерфейс партии, эффекты (`art/`). */
export const DEFAULT_TEXTURE_ART: Readonly<Record<string, ICanvasArt>> = {
  ...BOARD_TEXTURES,
  ...HUD_TEXTURES,
  ...FX_TEXTURES,
};

/** Ключи, на которые может сослаться описание элемента этого скина. */
export type TDefaultElementTextureKey =
  keyof typeof DEFAULT_TEXTURE_FILES | keyof typeof BOARD_TEXTURES;

export const DEFAULT_TEXTURES: ISkinTextures = {
  cellWidth: CELL_TEXTURE_WIDTH,
  files: DEFAULT_TEXTURE_FILES,
  art: DEFAULT_TEXTURE_ART,
};

/**
 * Скин и описание элементов: как элемент выглядит и как называется.
 *
 * Баррель свободен от движка отрисовки и React: его читают и DOM (редактор, модалки,
 * подсказки механик), и рантайм партии. Правила доски сюда не входят -
 * `entities/game` скин не импортирует.
 */
export { SKIN } from './model/activeSkin';
export {
  findElementTexture,
  getElementBoard,
  getElementDestroyTint,
  getElementHitSound,
  getElementIcon,
  getElementLabel,
  getElementStageTexture,
  getElementStageTint,
  getElementTexture,
  getElementView,
  getMechanicTip,
  getSkinElement,
  listElementTextureKeys,
  listSkinSpineViews,
  listSkinTextureFiles,
  resolveSpineIdle,
  resolveStageTexture,
  resolveStageTint,
  skinTextureWidth,
  type ISkinTextureFileEntry,
} from './model/registry';
export { ROCKET_BEAM_FRAME_COUNT, RUNTIME_TEXTURE_KEYS } from './model/textureKeys';
export type { ISoundVoice, TSoundCue, TSoundRecipe } from './model/sound';
export type { IBoardTiming, TBoardTimingOverride } from './model/timing';
export type {
  ICanvasArt,
  IMechanicTip,
  ISkinAxisTool,
  ISkinColors,
  ISkinElement,
  ISkinElementBoard,
  ISkinElementEditor,
  ISkinFonts,
  ISkinFrameClip,
  ISkinFxColors,
  ISkinHudColors,
  ISkinManifest,
  ISkinSpineAtlas,
  ISkinSpineView,
  ISkinTextureFile,
  ISkinTextures,
  TBoardlessElementId,
  TDrawableElementId,
  TEditorToolArea,
  TEditorToolGroup,
  TSkinCellView,
  TSkinCellViewKind,
  TSkinElementOf,
  TSkinElements,
} from './model/types';

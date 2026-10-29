import {
  isMinigameElementId,
  MINIGAME_ELEMENT_IDS,
  type TLevelMechanic,
  type TMinigameElementId,
} from '@/entities/game';
import { SKIN } from './activeSkin';
import type { TSoundCue } from './sound';
import type {
  IMechanicTip,
  ISkinElement,
  ISkinElementBoard,
  ISkinManifest,
  ISkinSpineView,
  TDrawableElementId,
  TSkinCellView,
  TSkinElementOf,
} from './types';

/**
 * Реестр элементов: чтение описаний активного скина по коду формата. Это
 * единственная дорога, которой DOM (палитра, цели, подсказки, карточка
 * уровня) и рантайм партии (текстуры, частицы) узнают, как элемент выглядит и
 * называется.
 */

/** Описание элемента по коду формата. */
export const getSkinElement = <K extends TMinigameElementId>(id: K): TSkinElementOf<K> =>
  SKIN.elements[id];

/** Описание по любой строке (код цели, клетки JSON): неизвестный код - `null`. */
const findSkinElement = (id: string | undefined): ISkinElement | null =>
  id && isMinigameElementId(id) ? SKIN.elements[id] : null;

/** Подпись элемента: та же у палитры, цели и карточки. Неизвестный код - `null`. */
export const getElementLabel = (id: string | undefined): string | null =>
  findSkinElement(id)?.label ?? null;

/** Иконка элемента для DOM. Неизвестный код - `null`. */
export const getElementIcon = (id: string | undefined): string | null =>
  findSkinElement(id)?.icon ?? null;

/** Подсказка механики при первой встрече. */
export const getMechanicTip = (mechanic: TLevelMechanic): IMechanicTip =>
  SKIN.elements[mechanic].tip;

/** Вид элемента на доске. */
export const getElementBoard = (id: TDrawableElementId): ISkinElementBoard =>
  SKIN.elements[id].board;

/** Ключ текстуры покоя: спрайт, иконка цели в шапке, копия в полёте к цели. */
export const getElementTexture = (id: TDrawableElementId): string => getElementBoard(id).texture;

/** Текстура покоя по любой строке (код цели): без вида на доске или чужой код - `null`. */
export const findElementTexture = (id: string): string | null =>
  findSkinElement(id)?.board?.texture ?? null;

/**
 * Текстура стадии по оставшейся прочности: `stages[hp - 1]`, прочность выше
 * последней стадии - последняя, без стадий - текстура покоя.
 */
export const resolveStageTexture = (board: ISkinElementBoard, hp: number): string => {
  const { stages } = board;

  if (!stages || stages.length === 0) {
    return board.texture;
  }

  const stage = Math.min(Math.max(Math.floor(hp), 1), stages.length);

  return stages[stage - 1];
};

export const getElementStageTexture = (id: TDrawableElementId, hp: number): string =>
  resolveStageTexture(getElementBoard(id), hp);

/**
 * Тинт стадии по оставшейся прочности: `stageTints[hp - 1]`, выше последней
 * записи - последняя; без тинтов или `null` в записи - без тинта.
 */
export const resolveStageTint = (board: ISkinElementBoard, hp: number): number | null => {
  const { stageTints } = board;

  if (!stageTints || stageTints.length === 0) {
    return null;
  }

  const stage = Math.min(Math.max(Math.floor(hp), 1), stageTints.length);

  return stageTints[stage - 1] ?? null;
};

/** Тинт стадии по любой строке (код клетки); без вида на доске - `null`. */
export const getElementStageTint = (id: string, hp: number): number | null => {
  const look = findSkinElement(id)?.board;

  return look ? resolveStageTint(look, hp) : null;
};

const SPRITE_VIEW: TSkinCellView = { kind: 'sprite' };

/** Вид клетки элемента; без своего вида (или без вида на доске) - спрайт. */
export const getElementView = (id: string): TSkinCellView =>
  findSkinElement(id)?.board?.view ?? SPRITE_VIEW;

/**
 * Виды клеток `spine` скина - по одному на пару «скелет + атлас». Пусто -
 * рантайм Spine (ленивый чанк `spine`) партии не нужен и не грузится.
 */
export const listSkinSpineViews = (skin: ISkinManifest = SKIN): ISkinSpineView[] => {
  const views = new Map<string, ISkinSpineView>();

  MINIGAME_ELEMENT_IDS.forEach((id) => {
    const view = skin.elements[id].board?.view;

    if (view?.kind === 'spine') {
      views.set(`${view.skeleton}\n${view.atlas.url}`, view);
    }
  });

  return [...views.values()];
};

/** Анимация покоя скелета по оставшейся прочности: стадия, иначе `idle`, иначе нет. */
export const resolveSpineIdle = (view: ISkinSpineView, hp: number): string | null => {
  const { stages, idle } = view.animations;

  if (stages && stages.length > 0) {
    return stages[Math.min(Math.max(Math.floor(hp), 1), stages.length) - 1];
  }

  return idle ?? null;
};

/** Цвет частиц разрушения элемента; нет записи или цвета - `null`. */
export const getElementDestroyTint = (id: string): number | null =>
  findSkinElement(id)?.board?.destroyTint ?? null;

/** Звук удара по элементу; удар молчит - `null`. */
export const getElementHitSound = (id: string): TSoundCue | null =>
  findSkinElement(id)?.board?.hitSound ?? null;

/** Все текстуры, на которые ссылаются описания элементов скина (покой и стадии). */
export const listElementTextureKeys = (skin: ISkinManifest = SKIN): string[] => {
  const keys = new Set<string>();

  for (const id of MINIGAME_ELEMENT_IDS) {
    const look: ISkinElementBoard | null = skin.elements[id].board;

    if (look) {
      keys.add(look.texture);
      look.stages?.forEach((key) => keys.add(key));
    }
  }

  return [...keys];
};

export interface ISkinTextureFileEntry {
  key: string;
  url: string;
  /** Спрайт-лист: загрузчик режет файл на кадры этого размера. */
  sheet?: { frameWidth: number; frameHeight: number };
}

/**
 * Файлы текстур скина для загрузчика рантайма и браузерного прогрева: одна
 * функция на оба потребителя, чтобы URL у них не разошлись.
 */
export const listSkinTextureFiles = (
  skin: ISkinManifest = SKIN
): readonly ISkinTextureFileEntry[] =>
  Object.entries(skin.textures.files).map(([key, file]) => ({
    key,
    url: file.url,
    ...(file.frameHeight === undefined
      ? {}
      : { sheet: { frameWidth: file.width, frameHeight: file.frameHeight } }),
  }));

/**
 * Ширина текстуры - знаменатель масштаба «дизайн-px / ширина текстуры». Файл
 * важнее холста (как и при загрузке), поэтому переопределённая картинкой
 * текстура другого разрешения сохраняет размер на экране.
 *
 * Неизвестный ключ - исключение, а не `NaN` в масштабе: модуль, который его
 * спросил, ломается на импорте, а не рисует невидимый спрайт.
 */
export const skinTextureWidth = (key: string, skin: ISkinManifest = SKIN): number => {
  const width = skin.textures.files[key]?.width ?? skin.textures.art[key]?.width;

  if (width === undefined) {
    throw new Error(`[skin:${skin.name}] нет текстуры «${key}»`);
  }

  return width;
};

import { describe, expect, it } from 'vitest';
import {
  LEVEL_MECHANICS,
  MINIGAME_CHIP_IDS,
  MINIGAME_ELEMENT_IDS,
  MINIGAME_GOAL_IDS,
} from '@/entities/game';
import { SKIN } from './activeSkin';
import {
  getElementDestroyTint,
  getElementIcon,
  getElementLabel,
  getElementStageTexture,
  getElementTexture,
  getMechanicTip,
  listElementTextureKeys,
  listSkinSpineViews,
  listSkinTextureFiles,
  resolveSpineIdle,
  resolveStageTexture,
  resolveStageTint,
  skinTextureWidth,
} from './registry';
import { RUNTIME_TEXTURE_KEYS } from './textureKeys';
import type { ISkinManifest, ISkinSpineView, TSkinCellView } from './types';

const FILE_KEYS = Object.keys(SKIN.textures.files);
const ART_KEYS = Object.keys(SKIN.textures.art);
const ALL_KEYS = new Set([...FILE_KEYS, ...ART_KEYS]);

describe('активный скин', () => {
  it('описывает каждый код формата подписью и иконкой', () => {
    for (const id of MINIGAME_ELEMENT_IDS) {
      expect(getElementLabel(id), id).toBeTruthy();
      expect(getElementIcon(id), id).toBeTruthy();
    }
  });

  it('даёт подписи без повторов: по подписи автор отличает элементы в палитре', () => {
    const labels = MINIGAME_ELEMENT_IDS.map((id) => getElementLabel(id));

    expect(new Set(labels).size).toBe(labels.length);
  });

  it('даёт каждой механике подсказку', () => {
    for (const mechanic of LEVEL_MECHANICS) {
      const tip = getMechanicTip(mechanic);

      expect(tip.title, mechanic).toBeTruthy();
      expect(tip.text, mechanic).toBeTruthy();
    }
  });

  it('держит каждую цель уровня с иконкой: её рисуют карточки и шапка партии', () => {
    for (const id of MINIGAME_GOAL_IDS) {
      expect(getElementIcon(id), id).toBeTruthy();
    }
  });

  it('регистрирует каждую текстуру элементов и рантайма - файлом или холстом', () => {
    const required = [...listElementTextureKeys(), ...RUNTIME_TEXTURE_KEYS];

    expect(required.filter((key) => !ALL_KEYS.has(key))).toEqual([]);
  });

  it('не возит файлов, на которые никто не ссылается', () => {
    // Файл под ключом холста - переопределение, под ключом элемента или
    // рантайма - нужная текстура; всё остальное - лишний запрос на старте.
    const used = new Set([...listElementTextureKeys(), ...RUNTIME_TEXTURE_KEYS, ...ART_KEYS]);

    expect(FILE_KEYS.filter((key) => !used.has(key))).toEqual([]);
  });

  it('рисует элементы в ширину кадра клетки: на неё делит общий BASE_SCALE доски', () => {
    // Подложка - не предмет: она в размер плитки поля, масштаб - от своей ширины.
    const items = listElementTextureKeys().filter(
      (key) => !(SKIN.elements.floor.board.stages ?? []).includes(key)
    );

    expect(items.filter((key) => skinTextureWidth(key) !== SKIN.textures.cellWidth)).toEqual([]);
  });

  it('у каждого цвета фишки своя текстура и свой цвет частиц', () => {
    const textures = MINIGAME_CHIP_IDS.map((id) => getElementTexture(id));
    const tints = MINIGAME_CHIP_IDS.map((id) => getElementDestroyTint(id));

    expect(new Set(textures).size).toBe(MINIGAME_CHIP_IDS.length);
    expect(tints.every((tint) => tint !== null)).toBe(true);
  });

  it('отдаёт загрузчику и прогреву один и тот же URL файла', () => {
    const files = listSkinTextureFiles();

    expect(files.map(({ key }) => key)).toEqual(FILE_KEYS);
    expect(files.every(({ url }) => url.length > 0)).toBe(true);
  });
});

describe('getElementLabel / getElementIcon', () => {
  it('не знает чужих кодов', () => {
    expect(getElementLabel('unknown')).toBeNull();
    expect(getElementIcon(undefined)).toBeNull();
    expect(getElementDestroyTint('')).toBeNull();
  });
});

describe('resolveStageTexture', () => {
  const look = { texture: 'box', stages: ['box-cracked', 'box'] };

  it('выбирает стадию по оставшейся прочности', () => {
    expect(resolveStageTexture(look, 1)).toBe('box-cracked');
    expect(resolveStageTexture(look, 2)).toBe('box');
  });

  it('держит последнюю стадию для прочности выше неё и первую - для нуля', () => {
    expect(resolveStageTexture(look, 3)).toBe('box');
    expect(resolveStageTexture(look, 0)).toBe('box-cracked');
  });

  it('без стадий отдаёт текстуру покоя', () => {
    expect(resolveStageTexture({ texture: 'stone' }, 1)).toBe('stone');
  });

  it('у ящика скина по умолчанию треснувшая стадия - последний слой', () => {
    expect(getElementStageTexture('cargo', 1)).not.toBe(getElementStageTexture('cargo', 2));
    expect(getElementStageTexture('cargo', 3)).toBe(getElementStageTexture('cargo', 2));
  });
});

describe('resolveStageTint', () => {
  it('берёт тинт стадии тем же индексом, что текстуру, и держит последний выше', () => {
    const look = { texture: 'box', stageTints: [null, null, 0x123456] };

    expect(resolveStageTint(look, 1)).toBeNull();
    expect(resolveStageTint(look, 3)).toBe(0x123456);
    expect(resolveStageTint(look, 5)).toBe(0x123456);
  });

  it('без тинтов - без тинта', () => {
    expect(resolveStageTint({ texture: 'stone' }, 2)).toBeNull();
  });
});

describe('skinTextureWidth', () => {
  const skin = {
    ...SKIN,
    name: 'test',
    textures: {
      cellWidth: 100,
      files: { tile: { url: '/tile.png', width: 64 } },
      art: { tile: { width: 200, height: 200, draw: () => undefined } },
    },
  } satisfies ISkinManifest;

  it('берёт ширину файла раньше холста: картинка переопределяет рисование', () => {
    expect(skinTextureWidth('tile', skin)).toBe(64);
  });

  it('падает на неизвестном ключе, а не отдаёт NaN в масштаб', () => {
    expect(() => skinTextureWidth('missing', skin)).toThrow('missing');
  });
});

describe('вид клетки spine', () => {
  const spineView = {
    kind: 'spine',
    skeleton: '/spine/chip.json',
    atlas: { url: '/spine/chip.atlas', pages: { 'chip.png': '/spine/chip-abc.png' } },
    width: 120,
    animations: { idle: 'idle', stages: ['crack2', 'crack1'], hit: 'hit', destroy: 'pop' },
  } satisfies TSkinCellView;

  const withSpine = (ids: readonly string[]): ISkinManifest => ({
    ...SKIN,
    elements: Object.fromEntries(
      Object.entries(SKIN.elements).map(([id, element]) => [
        id,
        ids.includes(id) && element.board
          ? { ...element, board: { ...element.board, view: spineView } }
          : element,
      ])
    ) as unknown as ISkinManifest['elements'],
  });

  it('скин по умолчанию не использует Spine - рантайм Spine не нужен', () => {
    expect(listSkinSpineViews()).toEqual([]);
  });

  it('один скелет у нескольких элементов - одна загрузка', () => {
    expect(listSkinSpineViews(withSpine(['red', 'blue', 'stone']))).toEqual([spineView]);
  });

  it('покой по прочности: стадия, выше последней - последняя, без стадий - idle', () => {
    expect(resolveSpineIdle(spineView, 1)).toBe('crack2');
    expect(resolveSpineIdle(spineView, 5)).toBe('crack1');

    const plain: ISkinSpineView = { ...spineView, animations: { idle: 'idle' } };

    expect(resolveSpineIdle(plain, 3)).toBe('idle');
    expect(resolveSpineIdle({ ...spineView, animations: {} }, 1)).toBeNull();
  });
});

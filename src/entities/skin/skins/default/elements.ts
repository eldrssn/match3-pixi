import type { TMinigameChipId } from '@/entities/game';
import type { TSoundCue } from '../../model/sound';
import type { ISkinElementBoard, ISkinElementEditor, TSkinElements } from '../../model/types';
import dropIconUrl from './icons/drop.svg?url';
import floorIconUrl from './icons/floor.svg?url';
import rainbowIconUrl from './icons/rainbow.svg?url';
import randomIconUrl from './icons/random.svg?url';
import slimeIconUrl from './icons/slime.svg?url';
import holeIconUrl from './images/hole.webp?url';
import { CARGO_REINFORCED_TINT, CHIP_COLORS, FLOOR_LIGHT_COLOR } from './palette';
import { DEFAULT_TEXTURE_FILES as FILES, type TDefaultElementTextureKey } from './textures';

/**
 * Описание элементов скина по умолчанию - одна запись на код формата
 * (`MINIGAME_ELEMENT_IDS`): подпись, иконка для DOM, вид на доске (текстуры по
 * стадиям, цвет частиц), карточка редактора и подсказка механики.
 *
 * Коды - слоты формата уровня, а не цвета или материалы: `yellow` может
 * выглядеть бананом, `cargo` - коробкой. JSON уровней ссылается на коды и от
 * скина не зависит.
 *
 * Иконка - тот же файл, что текстура на доске; у того, что в партии рисуется
 * на холсте (слизь, кристалл, подложка, радуга) или не рисуется вовсе («?»,
 * дыра), - свой SVG/растр-двойник из `icons/`.
 */

/** Вид на доске с ключами текстур этого скина (опечатка в ключе - ошибка компиляции). */
const board = (
  texture: TDefaultElementTextureKey,
  look: {
    stages?: readonly TDefaultElementTextureKey[];
    stageTints?: readonly (number | null)[];
    destroyTint?: number;
    hitSound?: TSoundCue;
  } = {}
): ISkinElementBoard => ({ texture, ...look });

const CHIP_EDITOR: ISkinElementEditor = {
  group: 'chips',
  layerLabel: 'Предмет',
  description: 'Обычная фишка: матчится в линии от трёх, свапается и падает.',
};

const HELPER_LAYER = 'Предмет';

const chip = (id: TMinigameChipId, label: string) => ({
  label,
  icon: FILES[id].url,
  board: board(id, { destroyTint: CHIP_COLORS[id] }),
  editor: CHIP_EDITOR,
});

export const DEFAULT_ELEMENTS: TSkinElements = {
  // Фишки
  yellow: chip('yellow', 'Жёлтая'),
  red: chip('red', 'Красная'),
  pink: chip('pink', 'Розовая'),
  violet: chip('violet', 'Фиолетовая'),
  green: chip('green', 'Зелёная'),
  blue: chip('blue', 'Синяя'),
  random: {
    label: 'Случайная фишка',
    icon: randomIconUrl,
    board: null,
    editor: {
      group: 'chips',
      layerLabel: 'Предмет',
      description:
        'Цвет выберет партия на старте - из цветов уровня и без готовой тройки. Раскладка каждый раз своя.',
    },
  },

  // Блокеры
  cargo: {
    label: 'Ящик',
    icon: FILES.cargo.url,
    // Третий слой - тот же целый ящик, тонированный в сталь: своего арта у
    // усиленного ящика нет, а читаться он обязан отдельно от двухслойного.
    board: board('cargo', {
      stages: ['cargo2', 'cargo'],
      stageTints: [null, null, CARGO_REINFORCED_TINT],
      destroyTint: 0xd9a066,
      hitSound: 'crack',
    }),
    editor: {
      group: 'blockers',
      layerLabel: 'Предмет',
      description:
        'Неподвижный. Теряет слой от матча рядом и от удара. Повторный клик - следующий слой (1 → 2 → 3).',
    },
    tip: {
      title: 'Ящик',
      text: 'Собирайте фишки рядом с ящиком: каждый матч снимает с него один слой.',
    },
  },
  stone: {
    label: 'Камень',
    icon: FILES.stone.url,
    board: board('stone', { destroyTint: 0x9aa1ad, hitSound: 'crack' }),
    editor: {
      group: 'blockers',
      layerLabel: 'Предмет',
      description: 'Неподвижный. Матч рядом его не берёт - только спецфишки и бустеры.',
    },
    tip: {
      title: 'Камень',
      text: 'Матч рядом камень не берёт. Разбейте его ракетой, бомбой, радугой или бустером.',
    },
  },
  slime: {
    label: 'Слизь',
    icon: slimeIconUrl,
    board: board('slime', { destroyTint: 0x9be35a, hitSound: 'crack' }),
    editor: {
      group: 'blockers',
      layerLabel: 'Предмет',
      description:
        'Снимается матчем рядом и ударом. Ход, который не снял слизь, даёт ей занять соседнюю фишку.',
    },
    tip: {
      title: 'Слизь',
      text: 'Снимайте слизь матчами рядом. Если за ход не тронуть ни одной её клетки, она расползётся.',
    },
  },
  drop: {
    label: 'Опусти вниз',
    icon: dropIconUrl,
    board: board('drop', { destroyTint: 0xffd65c }),
    editor: {
      group: 'blockers',
      layerLabel: 'Предмет',
      description: 'Падает и свапается как фишка, но не матчится. Дошёл до дна колонки - собран.',
    },
    tip: {
      title: 'Кристалл',
      text: 'Опустите кристалл до нижнего края поля - освобождайте клетки под ним, и он соберётся сам.',
    },
  },
  // Дыра - не препятствие, которое снимают в партии, а форма поля: её место
  // в редакторе рядом с ластиком, тоже меняющим клетку целиком.
  HOLE: {
    label: 'Дыра',
    icon: holeIconUrl,
    board: null,
    editor: {
      group: 'tools',
      layerLabel: 'Форма поля',
      description: 'Клетки нет: фишки пролетают насквозь. Стирает клетку целиком.',
    },
  },
  ice: {
    label: 'Лёд',
    icon: FILES.ice.url,
    board: board('ice', { stages: ['ice2', 'ice'], destroyTint: 0xbfe8ff, hitSound: 'crack' }),
    editor: {
      group: 'blockers',
      layerLabel: 'Накладка',
      description:
        'Только поверх фишки. Фишка подо льдом не идёт в линию; лёд держит 2 удара и снимается матчем рядом.',
    },
    tip: {
      title: 'Лёд',
      text: 'Фишка подо льдом не идёт в линию. Разбейте лёд матчами рядом - ему нужно два удара.',
    },
  },
  chain: {
    label: 'Цепь',
    icon: FILES.chain.url,
    board: board('chain', { destroyTint: 0xc4ccda, hitSound: 'crack' }),
    editor: {
      group: 'blockers',
      layerLabel: 'Накладка',
      description:
        'Только поверх фишки. Фишка матчится, но не двигается; цепь снимает один прямой удар.',
    },
    tip: {
      title: 'Цепь',
      text: 'Фишку в цепи нельзя сдвинуть, но она собирается в линию - такой матч снимает цепь.',
    },
  },
  floor: {
    label: 'Подложка',
    icon: floorIconUrl,
    board: board('floor', { stages: ['floor', 'floor2'], destroyTint: FLOOR_LIGHT_COLOR }),
    editor: {
      group: 'blockers',
      layerLabel: 'Подложка',
      description:
        'Под клеткой, 1-2 слоя. Теряет слой, когда на ней гаснет предмет от удара. Повторный клик - следующий слой.',
    },
    tip: {
      title: 'Подложка',
      text: 'Собирайте фишки прямо на подложке: каждый матч на ней снимает слой.',
    },
  },

  // Спецфишки («хэлперы» редактора)
  laser: {
    label: 'Ракета',
    icon: FILES.rocket.url,
    // Одна текстура на обе оси: вертикальная - тот же спрайт, повёрнутый на 90°.
    board: board('rocket', { destroyTint: 0x9fe7ff }),
    editor: {
      group: 'helpers',
      layerLabel: HELPER_LAYER,
      description: 'Бьёт весь ряд или всю колонку.',
      origin: '4 в ряд',
    },
    axes: {
      horizontal: {
        label: 'Ракета ↔',
        description: 'Бьёт весь ряд.',
        origin: '4 в ряд по вертикали',
        area: 'row',
      },
      vertical: {
        label: 'Ракета ↕',
        description: 'Бьёт всю колонку.',
        origin: '4 в ряд по горизонтали',
        area: 'column',
      },
    },
  },
  bomb: {
    label: 'Бомба',
    icon: FILES.bomb.url,
    board: board('bomb', { destroyTint: 0xffc46b }),
    editor: {
      group: 'helpers',
      layerLabel: HELPER_LAYER,
      description: 'Бьёт квадрат 3×3 вокруг себя.',
      origin: 'фигура L или T',
      area: 'square',
    },
  },
  propeller: {
    label: 'Пропеллер',
    icon: FILES.propeller.url,
    board: board('propeller', { destroyTint: 0xd8f4ff }),
    editor: {
      group: 'helpers',
      layerLabel: HELPER_LAYER,
      description: 'Бьёт крест вокруг себя и улетает в клетку, которая ещё нужна цели уровня.',
      origin: 'квадрат 2×2',
      area: 'cross',
    },
  },
  rainbow: {
    label: 'Радуга',
    icon: rainbowIconUrl,
    // Частицы белые: у радуги нет своего цвета.
    board: board('rainbowWheel'),
    editor: {
      group: 'helpers',
      layerLabel: HELPER_LAYER,
      description: 'Снимает все фишки того цвета, с которым её свапнули.',
      origin: '5 в ряд',
      area: 'color',
    },
  },
};

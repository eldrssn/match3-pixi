import type { TLevelMechanic, TMinigameElementId, TMinigameLaserDirection } from '@/entities/game';
import type { ICanvasArt } from '../lib/canvasArt';
import type { TSoundCue, TSoundRecipe } from './sound';
import type { TBoardTimingOverride } from './timing';

/**
 * Контракт скина: всё, что отвечает на вопрос «как выглядит и как называется
 * элемент», плюс оформление партии (текстуры шапки и эффектов, цвета, шрифт,
 * звуки). Правил здесь нет: урон, слои, гравитация и цели - в `entities/game`,
 * и они от скина не зависят.
 *
 * Активный скин один (`model/activeSkin`), его папка - `skins/<name>/`.
 */

export type { ICanvasArt };

/** Текстура рантайма из файла. */
export interface ISkinTextureFile {
  /** URL файла: Vite-импорт `?url`, база (`VITE_CDN_BASE_URL`) уже учтена сборкой. */
  readonly url: string;
  /**
   * Ширина файла в пикселях - знаменатель масштаба «дизайн-px / ширина
   * текстуры» (`skinTextureWidth`). Задаётся явно, а не читается из картинки:
   * масштабы модулей считаются при импорте, до загрузки файлов.
   */
  readonly width: number;
  /**
   * Файл - спрайт-лист: кадры `width × frameHeight` слева направо, сверху
   * вниз. Тогда `width` - ширина одного кадра, а не файла: масштаб считается
   * по кадру. Кадры листа проигрывает вид клетки `frames` (`TSkinCellView`).
   */
  readonly frameHeight?: number;
}

export interface ISkinTextures {
  /**
   * Ширина кадра предмета клетки (фишки, блокеры, спецфишки, колесо радуги),
   * px: знаменатель общего `BASE_SCALE` доски. Все текстуры элементов
   * (`ISkinElementBoard`) обязаны быть этой ширины - это держит тест скина.
   */
  readonly cellWidth: number;
  /** Файлы: ключ текстуры рантайма -> файл. Грузит `widgets/game` `assetsConfig`. */
  readonly files: Readonly<Record<string, ISkinTextureFile>>;
  /**
   * Процедурные текстуры: ключ -> рисование на холсте. Ключ, для которого есть
   * файл, не рисуется - файл важнее: так любая процедурная текстура
   * переопределяется картинкой без правки кода рисования.
   */
  readonly art: Readonly<Record<string, ICanvasArt>>;
}

/** Группа палитры редактора. */
export type TEditorToolGroup = 'chips' | 'helpers' | 'blockers' | 'tools';

/** Какую область бьёт спецфишка - для схемы в карточке редактора. */
export type TEditorToolArea = 'row' | 'column' | 'square' | 'cross' | 'color';

/** Карточка элемента в редакторе: что он делает, человеческими словами. */
export interface ISkinElementEditor {
  readonly group: TEditorToolGroup;
  /** Какой слой клетки он занимает: «Предмет», «Накладка», «Подложка», «Форма поля». */
  readonly layerLabel: string;
  readonly description: string;
  /** Из какой фигуры спецфишка рождается в партии. */
  readonly origin?: string;
  readonly area?: TEditorToolArea;
}

/** Инструмент редактора на одну ось ракеты: своя подпись, описание и схема. */
export interface ISkinAxisTool {
  readonly label: string;
  readonly description: string;
  readonly origin: string;
  readonly area: TEditorToolArea;
}

/** Подсказка механики при первой встрече (`widgets/game` `MechanicTip`). */
export interface IMechanicTip {
  readonly title: string;
  readonly text: string;
}

/**
 * Клип покадровой анимации: кадры спрайт-листа (`ISkinTextureFile.frameHeight`)
 * или ряд отдельных текстур.
 */
export interface ISkinFrameClip {
  /** Лист, из которого берутся кадры; без `frames` - все кадры листа по порядку. */
  readonly texture: string;
  /** Номера кадров листа по порядку проигрывания. */
  readonly frames?: readonly number[];
  readonly frameRate: number;
  /** Повторы: `-1` - бесконечно (покой), по умолчанию один проход. */
  readonly repeat?: number;
}

/** Атлас скелета Spine: файл `.atlas` и, по желанию, картинки его страниц. */
export interface ISkinSpineAtlas {
  /** URL файла `.atlas` (Vite `?url` из папки скина или `public/`). */
  readonly url: string;
  /**
   * Картинки страниц атласа: имя страницы в `.atlas` -> URL (Vite `?url`).
   * Нужны, когда картинки лежат с хешем в имени (сборка Vite): атлас
   * ссылается на страницу по исходному имени файла. Без поля страницы ищутся
   * рядом с `.atlas` по своему имени - так работает только `public/`.
   */
  readonly pages?: Readonly<Record<string, string>>;
}

/**
 * Вид клетки `spine`: скелет и атлас Spine 4.3 (`@esotericsoftware/spine-pixi-v8`)
 * и имена анимаций на крючках вида. Чего нет в `animations`, играется
 * твинами, как у спрайта (нажатие, приземление, пульс, схлопывание).
 *
 * Время скелета - часы рантайма партии: пауза и темп доски (`timeScale`)
 * действуют на анимацию так же, как на твины.
 *
 * Лицензия: Spine Runtimes используются только при лицензии Spine Editor у
 * того, кто выпускает проект (см. README).
 */
export interface ISkinSpineView {
  readonly kind: 'spine';
  /** URL скелета: `.json` или `.skel` (Vite `?url`). */
  readonly skeleton: string;
  readonly atlas: ISkinSpineAtlas;
  /**
   * Ширина скелета в его единицах, которая встаёт на ширину текстуры покоя
   * элемента: масштаб скелета - `baseScale × ширина текстуры / width`, та же
   * дробь «дизайн-px / ширина», что у спрайта. Перевыгрузка скелета в другом
   * размере правит только это число.
   */
  readonly width: number;
  /** Скин скелета (`skeleton.setSkinByName`); без поля - скин по умолчанию. */
  readonly skin?: string;
  readonly animations: {
    /** Покой: крутится по кругу, пока клетка на доске. */
    readonly idle?: string;
    /**
     * Покой по оставшейся прочности: `stages[hp - 1]`, прочность выше
     * последней записи - последняя. Перекрывает `idle` (блокеры со стадиями).
     */
    readonly stages?: readonly string[];
    /** Появление на старте партии и при доборе на месте (поверх твина масштаба). */
    readonly appear?: string;
    /** Удар без разрушения; после него - снова покой своей стадии. */
    readonly hit?: string;
    /** Разрушение: заменяет схлопывание твином, сноп частиц - на его старте. */
    readonly destroy?: string;
  };
}

/**
 * Как элемент нарисован на доске - вид клетки рантайма
 * (`widgets/game` `CELL_VIEW_KINDS`). Без поля - `sprite`: одна текстура
 * покоя (или стадии) и анимации твинами. `frames` - тот же спрайт плюс
 * покадровые клипы на крючках вида; чего нет в `clips`, играется твинами
 * спрайта. `spine` - скелет Spine (`ISkinSpineView`): рантайм Spine грузится
 * отдельным ленивым чанком, только если такой вид есть в активном скине.
 * Новый вид - ещё один член объединения здесь и фабрика в `CELL_VIEW_KINDS`:
 * без фабрики не скомпилируется.
 */
export type TSkinCellView =
  | { readonly kind: 'sprite' }
  | ISkinSpineView
  | {
      readonly kind: 'frames';
      readonly clips: {
        /** Покой: крутится всё время, пока клетка на доске. */
        readonly idle?: ISkinFrameClip;
        readonly appear?: ISkinFrameClip;
        /** Удар без разрушения. */
        readonly hit?: ISkinFrameClip;
        /** Разрушение: заменяет схлопывание твином. */
        readonly destroy?: ISkinFrameClip;
      };
    };

export type TSkinCellViewKind = TSkinCellView['kind'];

/** Вид элемента на доске рантайма. */
export interface ISkinElementBoard {
  /**
   * Текстура покоя: спрайт на доске, иконка цели в шапке партии и копия,
   * которая летит к ней.
   */
  readonly texture: string;
  /**
   * Текстуры по оставшейся прочности: `[hp1, hp2, ...]`; прочность выше
   * последней стадии - последняя. Без поля - одна текстура на все стадии.
   */
  readonly stages?: readonly string[];
  /**
   * Тинт поверх текстуры стадии - тем же индексом, что `stages`; прочность
   * выше последней записи - последняя. `null` - без тинта. Так стадия без
   * своего арта читается отдельно (усиленный ящик - целый, тонированный в
   * сталь).
   */
  readonly stageTints?: readonly (number | null)[];
  /** Вид клетки; без поля - спрайт (`sprite`). */
  readonly view?: TSkinCellView;
  /** Цвет частиц разрушения, `0xRRGGBB`. Без поля - белый. */
  readonly destroyTint?: number;
  /** Звук удара по элементу (блокеры, накладки). Без поля - удар молчит. */
  readonly hitSound?: TSoundCue;
}

/** Описание элемента: одна запись на код формата (`MINIGAME_ELEMENT_IDS`). */
export interface ISkinElement {
  /** Подпись: палитра и поле редактора, `alt` иконки цели, карточка уровня. */
  readonly label: string;
  /** Иконка для DOM: палитра редактора, цели на карточках, подсказка механики. */
  readonly icon: string;
  /** Вид на доске; `null` - элемент на доске не рисуется («?», дыра). */
  readonly board: ISkinElementBoard | null;
  readonly editor: ISkinElementEditor;
  /** Подсказка механики - обязательна у механик (`LEVEL_MECHANICS`). */
  readonly tip?: IMechanicTip;
  /** Инструменты по осям - обязательны у ракеты (`laser` + `direction`). */
  readonly axes?: Readonly<Record<TMinigameLaserDirection, ISkinAxisTool>>;
}

/**
 * Элементы без вида на доске: «?» на старте партии становится фишкой цвета,
 * дыра - это отсутствие клетки.
 */
export type TBoardlessElementId = 'random' | 'HOLE';

/** Элементы, которые рантайм рисует спрайтом. */
export type TDrawableElementId = Exclude<TMinigameElementId, TBoardlessElementId>;

/**
 * Запись элемента с обязательными для его кода полями: вид на доске у
 * рисуемых, подсказка у механик, оси у ракеты. Новый код формата без записи
 * в скине, механика без подсказки - ошибка компиляции, а не пустое место в
 * партии.
 */
export type TSkinElementOf<K extends TMinigameElementId> = ISkinElement &
  (K extends TBoardlessElementId
    ? { readonly board: null }
    : { readonly board: ISkinElementBoard }) &
  (K extends TLevelMechanic ? { readonly tip: IMechanicTip } : unknown) &
  (K extends 'laser'
    ? { readonly axes: Readonly<Record<TMinigameLaserDirection, ISkinAxisTool>> }
    : unknown);

export type TSkinElements = { readonly [K in TMinigameElementId]: TSkinElementOf<K> };

/** Цвета слоя канваса (`0xRRGGBB`), которые читает рантайм. */
export interface ISkinColors {
  /** Радуга по кругу: лучи взрыва радуги. */
  readonly rainbow: readonly number[];
  /** Горящая и тусклая звезда шкалы очков. */
  readonly starLit: number;
  readonly starDim: number;
  readonly fx: ISkinFxColors;
  readonly hud: ISkinHudColors;
}

/** Цвета эффектов доски (`0xRRGGBB`). */
export interface ISkinFxColors {
  /** Частицы элемента без своего `destroyTint`. */
  readonly burstDefault: number;
  /** Вспышка частиц на рождении спецфишки. */
  readonly specialSpawn: number;
  /** Подсветка клетки под наведённым бустером (аддитивно). */
  readonly cellBright: number;
  /** Подсветка спецфишки - выхода из тупика. */
  readonly specialHint: number;
  /** Вспышка ракеты в момент выстрела. */
  readonly rocketFiring: number;
  /** Ударная волна бомбы: кольцо и частицы. */
  readonly shockwave: number;
  /** Искры в центре взрыва бомбы. */
  readonly blastSpark: number;
  /** Взлёт и посадка пропеллера. */
  readonly takeoff: number;
  /** Рамка выбранной первым тапом фишки. */
  readonly selection: number;
  /** Затемнение доски на поражении и под интро цели. */
  readonly dim: number;
  /** Вспышка кадра (радуга, порталы, финал победы). */
  readonly flash: number;
}

/** Цвета интерфейса партии на холсте. */
export interface ISkinHudColors {
  /** Шкала очков: дорожка, заливка, обводка звёзд. */
  readonly scoreTrack: number;
  readonly scoreFill: number;
  readonly starOutline: number;
  /** Кружок под счётчиком цели и бустера. */
  readonly badge: number;
  /** Тексты канваса - CSS-строки. */
  readonly goalText: string;
  readonly goalDoneText: string;
  readonly lowMovesText: string;
}

export interface ISkinFonts {
  /**
   * Семейство шрифта текстов канваса партии. Сам шрифт подключает CSS
   * (`shared/styles/_fonts.scss`): канвас рисует только уже загруженный
   * `@font-face`.
   */
  readonly game: string;
}

export interface ISkinManifest {
  /** Имя папки скина - для диагностики. */
  readonly name: string;
  readonly elements: TSkinElements;
  readonly textures: ISkinTextures;
  readonly colors: ISkinColors;
  readonly fonts: ISkinFonts;
  /** Переопределение звуков рантайма по событию; чего нет - звучит рецепт по умолчанию. */
  readonly sounds: Readonly<Partial<Record<TSoundCue, TSoundRecipe>>>;
  /**
   * Переопределение темпа доски: любые группы и числа, остальное - как в
   * рантайме (`widgets/game/configs/timing.ts`). Слияние глубокое и одно
   * (`mergeBoardTiming`).
   */
  readonly timing?: TBoardTimingOverride;
}

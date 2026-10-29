import type { Container, Sprite } from 'pixi.js';
import type { TSkinCellView, TSkinCellViewKind } from '@/entities/skin';
import type { IMotionTween, RuntimeMotion } from '../../../motion/RuntimeMotion';
import type { CellId, ICellRuntime } from '../cellsTypes';

/**
 * Объект клетки на доске, который двигает сущность: позиция, масштаб,
 * прозрачность. Не `Sprite`: у будущего Spine это объект скелета, а
 * сущностям (переезд, падение, смещение за пальцем) от вида нужен только
 * `Container`.
 */
export type TCellDisplay = Container;

/** Деформация спрайта на прямом участке падения - доля базового масштаба. */
export interface ICellFallScale {
  scaleX: number;
  scaleY: number;
}

/** Что видит анимация разрушения элемента (`ICellLook.destroy`). */
export interface ICellDestroyContext {
  motion: RuntimeMotion;
  display: TCellDisplay;
  baseScale: number;
  /** Сноп частиц цвета элемента в точке спрайта. */
  burst: () => void;
}

/**
 * Вид элемента, общий для любого вида клетки: какой текстурой и в каком
 * масштабе он стоит в клетке и как уходит с доски. Задаёт сущность
 * (`BoardEntity.look`): это знание элемента, а не способа рисования - тот же
 * ящик одинаково тонируется сталью и в спрайте, и в покадровом виде.
 */
export interface ICellLook {
  /** Ключ текстуры покоя по оставшейся прочности (стадии из скина). */
  texture: (hp: number) => string;
  /** Тинт стадии; `null` - без тинта. */
  tint?: (hp: number) => number | null;
  /** Масштаб текстуры под клетку: «дизайн-px / ширина текстуры». */
  baseScale: number;
  /**
   * Покой поверх текстуры: поворот ракеты, вращение радуги. Вернувшийся твин
   * вид снимает вместе со спрайтом.
   */
  decorate?: (display: Sprite, motion: RuntimeMotion) => IMotionTween | null;
  /** Фильтр текстуры `nearest` - так рисуются кадры фишек атласа. */
  nearestFilter?: boolean;
  /**
   * Разрушение; без поля - замах и схлопывание фишки (`collapseMotion`).
   * Синхронное (`void`) снимает спрайт в том же ударе.
   */
  destroy?: (context: ICellDestroyContext) => Promise<void> | void;
}

/** Где и что рисует вид. */
export interface ICellViewPlace {
  runtime: ICellRuntime;
  container: Container;
  id: CellId;
}

/**
 * Вид клетки - вся её внешность на крючках жизненного цикла. Сущность
 * (`BoardEntity`) владеет клеткой на доске: координатами, переездами,
 * падением по пути и вводом (`CellInputController`), а как клетка при этом
 * выглядит и чем отвечает на события - решает вид.
 *
 * Вид по умолчанию - `SpriteCellView` (текстура и твины). Покадровый -
 * `FrameCellView`. Вид выбирает скин (`ISkinElementBoard.view`), фабрику -
 * реестр `CELL_VIEW_KINDS`.
 */
export interface ICellView {
  /** Объект на доске; `null` - не нарисован или уже снят. */
  readonly display: TCellDisplay | null;
  /** Масштаб покоя, от которого считаются все деформации. */
  readonly baseScale: number;
  /** Ключ текстуры покоя для копии, летящей к панели целей. */
  readonly restTexture: string;

  /** Рисует клетку невидимой (`alpha 0`) в точке доски. */
  create(x: number, y: number, hp: number): void;
  /** Снимает объект и всё, что на нём крутится. */
  dispose(): void;

  /** Появление на старте партии и при доборе на месте. */
  appear(): Promise<void>;
  /** Выскок родившейся спецфишки. Не ожидается: доигрывает поверх оседания. */
  spawn(): void;
  /** Состояние покоя: украшение текстуры, клип покоя. Повторный вызов безопасен. */
  idle(): void;
  /** Палец на клетке. */
  press(): void;
  /** Палец отпущен: масштаб покоя (позицию не трогает). */
  release(): void;
  /** Пульс подсказки простоя (`modules/IdleHint`). */
  pulse(isOn: boolean): void;
  /** Подсветка: наведённый бустер. */
  bright(isOn: boolean): void;
  /** Подсветка спецфишки - выхода из тупика. */
  highlight(isOn: boolean): void;
  /** Тинт поверх покоя (вспышка ракеты в момент выстрела); `null` - снять. */
  tint(color: number | null): void;
  /** Удар без разрушения: стадия по оставшейся прочности. */
  hit(hpLeft: number): void;
  /**
   * Разрушение. Снимает объект сущность - следом, через `dispose`; `void` -
   * анимации нет, снимать можно сразу.
   */
  destroy(): Promise<void> | void;
  /** Тихий уход без частиц: поглощение слизью, место предуровневого бустера. */
  vanish(): Promise<void>;
  /** Деформация на прямом участке падения длиной `rows` строк. */
  fallScale(rows: number): ICellFallScale;
  /** Приземление: squash и распрямление. Не ожидается. */
  land(): void;
  /** Гасит собственные твины масштаба (нажатие, squash, пульс). */
  stopMotion(): void;
}

/** Фабрика вида по описанию из скина. */
export type TCellViewFactory<K extends TSkinCellViewKind = TSkinCellViewKind> = (
  place: ICellViewPlace,
  look: ICellLook,
  spec: Extract<TSkinCellView, { kind: K }>
) => ICellView;

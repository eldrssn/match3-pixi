import type { Container } from 'pixi.js';
import type { IBoardCellPos, TBoardPiece } from '@/entities/game';
import type { IBoardPoint } from '../lib/boardGeometry';

/**
 * Удары камеры по силе: имена - те же, что у таблицы `CAMERA_PUNCH`
 * Phaser-эталона (`lib/boardFx`), чтобы из места вызова читалось «какой это
 * удар», а сила и длительность жили одной таблицей в реализации.
 */
export type TCameraPunch = 'cascade' | 'strike' | 'colorSweep' | 'shockwave' | 'defeat';

/** Хвост одного падения: догоняет позицию спрайта из `onUpdate` твина. */
export interface IFallTrail {
  track: (x: number, y: number) => void;
}

/** Точка клетки, над которой играет эффект бустера, и угол её спрайта (градусы). */
export interface IBoosterFxAnchor {
  x: number;
  y: number;
  angle: number;
}

/** Куда летит копия собранной цели: точка сцены и мировой масштаб иконки. */
export interface IGoalFlightTarget {
  x: number;
  y: number;
  scale: number;
}

/** Границы поля для эффектов, которые не рисуют за краем доски. */
export interface IBoardBounds {
  colCount: number;
  rowCount: number;
}

/**
 * Эффекты доски - всё, что рисуется поверх клеток и не принадлежит ни одной
 * из них: частицы, вспышки, тряска, лучи ракет, волна бомбы, полёт пропеллера,
 * лучи радуги, эффекты бустеров, полёт копии к цели, затемнение поражения.
 *
 * Хореография хода (что ждётся и сколько) живёт в анимациях шагов и
 * сущностях и от реализации эффектов не зависит: промис каждого эффекта
 * обязан резолвиться через ту же длительность, что у Phaser-эталона
 * (`lib/specialFx`, `lib/boosterFx`, `lib/boardFx`), а эффекты без промиса -
 * не задерживать ход вовсе. Поэтому реализация (`fx/createBoardFx`) меняется,
 * не трогая ни шага: темп хода, события доски и исход от неё не зависят.
 *
 * Координаты - дизайн-координаты контейнера доски (`lib/boardGeometry`),
 * как у спрайтов клеток.
 */
export interface IBoardFx {
  /** Сноп частиц цвета элемента: разрушение, рождение спецфишки, сбор. */
  emitDestroyBurst(x: number, y: number, tint: number): void;
  /** Хвост падения на `rows` строк; `null` - короткое падение или низкое качество. */
  createFallTrail(rows: number, startY: number, tint: number): IFallTrail | null;
  punchCamera(punch: TCameraPunch): void;
  /** Белая вспышка кадра. */
  flashBoard(): void;
  /** Попап «×N» каскада. Не ждётся. */
  showComboPopup(x: number, y: number, iteration: number): void;
  /** Затемнение доски на поражении. */
  dimBoard(bounds: IBoardBounds): Promise<void>;

  /** Два луча ракеты из точки по оси `angleDeg` (кадры `laser1`..`laserN`). */
  playBeamSequence(point: IBoardPoint, angleDeg: number): Promise<void>;
  /** Ракета без своего спрайта: луч по строке или колонке через клетку. */
  playLineBlast(at: IBoardCellPos, direction: 'horizontal' | 'vertical'): Promise<void>;
  /** Строки и колонки через клетку одним залпом (ракета+ракета, ракета+бомба). */
  playCrossBlast(at: IBoardCellPos, width: number, bounds: IBoardBounds): Promise<void>;
  /** Бомба: ударная волна до края зоны. */
  playAreaBlast(at: IBoardCellPos, radius: number): Promise<void>;
  /** Взлёт пропеллера: короткое кольцо по кресту. */
  playTakeoff(at: IBoardCellPos): Promise<void>;
  /** Полёт пропеллера дугой к цели; промис - до прилёта. */
  playPropellerFlight(
    from: IBoardCellPos,
    to: IBoardCellPos,
    carried: TBoardPiece['id'] | null
  ): Promise<void>;
  /** Лучи радуги к фишкам её цвета. */
  playColorRays(at: IBoardCellPos, targets: readonly IBoardCellPos[]): Promise<void>;
  /** Радуга+радуга: волна через всё поле. */
  playBoardBlast(at: IBoardCellPos, bounds: IBoardBounds): Promise<void>;

  /** Бустер «шар»: волны по строкам `rows`, шар по строке `ballRow`. */
  playRowsWave(ballRow: number, rows: readonly number[]): Promise<void>;
  /** Бустер «луч» по клетке. */
  playBeamStrike(anchor: IBoosterFxAnchor): Promise<void>;
  /** Бустер «лазер» над фишкой: встречно вращающиеся порталы. */
  playPortalSweep(anchor: IBoosterFxAnchor): Promise<void>;

  /**
   * Копия засчитанного в цель спрайта летит к своей иконке на панели целей.
   * `null` у цели - середина верха безопасной зоны. Не ждётся.
   */
  flyToGoalPanel(source: Container | null, texture: string, target: IGoalFlightTarget | null): void;

  /** Гасит то, что эффекты держат между вызовами (общие эмиттеры). */
  destroy(): void;
}

import { Container } from 'pixi.js';
import { listGoalEvents, scoreBoardSteps } from '@/entities/game';
import type { BoardEngine, IBoardCellPos, TBoardPiece, TBoardStep } from '@/entities/game';
import type { SoundEngine } from '../audio/SoundEngine';
import type { IBoardHud } from '../hud/boardHud';
import { emitBoardEvents } from '../model/boardEventBus';
import { listStepBoardEvents } from '../model/boardEvents';
import { useGameStore } from '../store/GameStore';
import { CascadeAccents } from './CascadeAccents';
import type { BoardEntity } from './cells/BoardEntity';
import type { ICellRuntime } from './cells/cellsTypes';
import { createEntityFromPiece } from './cells/EntityFactory';
import { LayerEntity, type TLayerId } from './cells/LayerEntity';
import { DEFAULT_STEP_ANIMATIONS } from './steps/defaultStepAnimations';
import { resolveStepAnimations } from './steps/resolveStepAnimations';
import { STEP_ANIMATION_OVERRIDES } from './steps/stepAnimationOverrides';
import type {
  IStepAnimationContext,
  IStepBoard,
  TStepAnimation,
  TStepAnimations,
} from './steps/stepAnimationTypes';

/**
 * Анимации шагов партии: по умолчанию с переопределениями проекта. Скин и
 * переопределения одни на сборку, поэтому слияние - одно, при импорте.
 */
const STEP_ANIMATIONS: TStepAnimations = resolveStepAnimations(
  DEFAULT_STEP_ANIMATIONS,
  STEP_ANIMATION_OVERRIDES
);

interface IBoardStepPlayerOptions {
  runtime: ICellRuntime;
  hud: IBoardHud;
  colCount: number;
  rowCount: number;
  /** Звук партии; без него проигрывание идёт молча. */
  sound: SoundEngine | null;
  /**
   * Спрайт ушёл с доски (удар, превращение, сбор, слизь, предуровневый
   * бустер). Владелец забывает свои ссылки на него (подсветка спецфишки в
   * тупике, выбор первого тапа), иначе держал бы снятый спрайт.
   */
  onEntityDestroyed: (entity: BoardEntity) => void;
}

/**
 * Проигрыватель протокола хода (`TBoardStep`) и зеркало доски спрайтами.
 *
 * Спрайты лежат по клеткам: `grid[col][row]` - первый индекс колонка (X,
 * слева направо), второй строка (Y, сверху вниз), как у движка и редактора;
 * `entity.x` - колонка, `entity.y` - строка.
 *
 * Зеркало догоняет движок по мере проигрывания шагов: пока ход анимируется,
 * движок уже стоит в конце хода, а `grid` - там, где сейчас анимация. На
 * свободной доске они совпадают клетка в клетку (`assertInSync` в dev).
 *
 * Слои клетки - отдельные слои контейнера доски: подложки под фишками,
 * накладки над ними, эффекты - поверх всего (`container`). Спрайты слоёв
 * (`LayerEntity`) живут своими картами по паспортам.
 *
 * Решений здесь нет: что разрушить, куда упасть и какого цвета добор, движок
 * уже записал в шаг. Как шаг выглядит, решает его анимация из реестра
 * (`steps/defaultStepAnimations`, переопределения - `steps/stepAnimationOverrides`):
 * проигрыватель даёт ей зеркало доски (`IStepBoard`) и ждёт её целиком. Ввод,
 * занятость доски и исход партии - у `GameLogic`.
 */
export class BoardStepPlayer implements IStepBoard {
  private readonly runtime: ICellRuntime;
  private readonly hud: IBoardHud;
  private readonly colCount: number;
  private readonly rowCount: number;
  private readonly onEntityDestroyed: (entity: BoardEntity) => void;

  /** Слои контейнера доски снизу вверх: подложки, предметы, накладки. */
  private readonly floorLayer = new Container({ label: 'floorLayer' });
  private readonly pieceLayer = new Container({ label: 'pieceLayer' });
  private readonly overlayLayer = new Container({ label: 'overlayLayer' });

  private grid: (BoardEntity | null)[][] = [];
  /** Спрайт по паспорту фишки движка (`TBoardPiece.uid`). */
  private readonly entities = new Map<number, BoardEntity>();
  /** Спрайты накладок и подложек по паспортам. */
  private readonly layers = new Map<number, LayerEntity>();
  /**
   * Партию выключили. Проигрывание, пережившее уничтожение, обрывается на
   * следующем шаге, а не анимирует снятые спрайты.
   */
  private isDestroyed = false;
  /** Что видят анимации шагов: ядро, эффекты, звук, акценты и сам проигрыватель. */
  private readonly context: IStepAnimationContext;

  constructor(
    container: Container,
    { runtime, hud, colCount, rowCount, sound, onEntityDestroyed }: IBoardStepPlayerOptions
  ) {
    this.runtime = runtime;
    this.hud = hud;
    this.colCount = colCount;
    this.rowCount = rowCount;
    this.onEntityDestroyed = onEntityDestroyed;

    // Слои добавляются в контейнер раньше любых эффектов, поэтому эффекты
    // (лучи, попапы, частицы) всегда ложатся поверх доски.
    container.addChild(this.floorLayer, this.pieceLayer, this.overlayLayer);

    this.context = {
      core: runtime.core,
      container,
      fx: runtime.fx,
      hud,
      colCount,
      rowCount,
      sound,
      accents: new CascadeAccents(runtime.fx, { colCount, rowCount }),
      board: this,
      isDestroyed: () => this.isDestroyed,
    };
  }

  /** Спрайты стартовой доски движка - предметы и слои, с анимацией появления. */
  build(engine: BoardEngine): void {
    for (let col = 0; col < this.colCount; col++) {
      this.grid[col] = [];

      for (let row = 0; row < this.rowCount; row++) {
        const pos = { col, row };
        const piece = engine.pieceAt(pos);
        const entity = piece ? this.createEntity(piece, col, row) : null;
        const floor = engine.floorAt(pos);
        const overlay = engine.overlayAt(pos);

        this.grid[col][row] = entity;

        void entity?.appearAnimation();

        if (floor) {
          void this.createLayer(this.floorLayer, floor.uid, { ...floor, col, row }).appear();
        }

        if (overlay) {
          void this.createLayer(this.overlayLayer, overlay.uid, { ...overlay, col, row }).appear();
        }
      }
    }
  }

  // ---------------------------------------------------------------- чтение

  cellAt(col: number, row: number): BoardEntity | null {
    return this.grid[col]?.[row] ?? null;
  }

  entity(uid: number): BoardEntity | undefined {
    return this.entities.get(uid);
  }

  /**
   * Сущность всё ещё стоит в своей клетке, то есть жива. Гейт отложенного
   * ввода: за время ожидания клетку мог снести чужой каскад.
   */
  isOnBoard(entity: BoardEntity): boolean {
    return this.grid[entity.x]?.[entity.y] === entity;
  }

  /** Все спрайты на доске, колонка за колонкой. */
  entitiesOnBoard(): BoardEntity[] {
    return this.grid.flatMap((column) =>
      column.filter((entity): entity is BoardEntity => entity !== null)
    );
  }

  /** Контейнер предметов доски: рамка выбора ложится поверх него и накладок. */
  get piecesContainer(): Container {
    return this.pieceLayer;
  }

  /**
   * Dev-страховка: на свободной доске спрайты обязаны стоять ровно там, где
   * фишки движка. Расхождение - баг проигрывания шагов, и без проверки он
   * проявился бы много ходов спустя как «фишка не свапается» или «дыра в
   * поле». В production-сборке проверки нет.
   */
  assertInSync(engine: BoardEngine): void {
    if (!import.meta.env.DEV || this.isDestroyed) {
      return;
    }

    for (let col = 0; col < this.colCount; col++) {
      for (let row = 0; row < this.rowCount; row++) {
        const piece = engine.pieceAt({ col, row });
        const expected = piece ? this.entities.get(piece.uid) : undefined;

        if ((expected ?? null) !== this.cellAt(col, row)) {
          console.error(`GameLogic: sprite grid is out of sync with the engine at ${col}:${row}`);

          return;
        }
      }
    }
  }

  // ------------------------------------------------------- проигрывание

  /**
   * Проигрывает протокол хода по порядку.
   *
   * Каждый шаг ждётся целиком: урон по линии не начнётся раньше выстрела
   * лазера, падение - раньше барьера после дестроя, следующее звено каскада -
   * раньше паузы перед ним.
   */
  async play(steps: readonly TBoardStep[]): Promise<void> {
    // Очки считаются тем же чистым правилом, что у бота (`boardScore`), и
    // начисляются по мере проигрывания: счётчик растёт вместе с анимацией, а
    // не скачком в конце хода.
    const points = scoreBoardSteps(steps);

    for (const [index, step] of steps.entries()) {
      if (this.isDestroyed) {
        return;
      }

      this.registerGoals(step);
      emitBoardEvents(listStepBoardEvents(step));
      await (STEP_ANIMATIONS[step.type] as TStepAnimation)(this.context, step);

      if (!this.isDestroyed) {
        useGameStore.getState().addScore(points[index]);
      }
    }
  }

  /**
   * Цели уровня по шагу: то же правило, что у бота и теста каталога
   * (`listGoalEvents`), а не учёт в `destroy()` спрайтов. Две реализации
   * разошлись бы на первом новом слое, и уровни, откалиброванные ботом, в
   * партии стали бы легче или тяжелее, чем он показал.
   *
   * До проигрывания шага: копия засчитанного спрайта взлетает к панели целей,
   * пока он ещё на доске (спецфишка гасит свой спрайт синхронно, прямо в
   * ударе). Панель перерисовывается за шаг, а не за клетку: лазер по строке
   * снимает восемь фишек разом, и восемь пульсов подряд гасили бы друг друга.
   */
  private registerGoals(step: TBoardStep): void {
    const events = listGoalEvents(step);

    if (events.length === 0) {
      return;
    }

    for (const { id, uid } of events) {
      if (useGameStore.getState().decreaseGoal(id)) {
        (this.entities.get(uid) ?? this.layers.get(uid))?.flyCopyToGoalPanel(
          this.hud.getGoalTarget(id)
        );
      }
    }

    this.hud.refreshGoals();
  }

  // ------------------------------------------- зеркало доски для анимаций

  layer(uid: number): LayerEntity | undefined {
    return this.layers.get(uid);
  }

  forgetLayer(uid: number): void {
    this.layers.delete(uid);
  }

  spawn(piece: Readonly<TBoardPiece>, col: number, row: number): BoardEntity {
    const entity = this.createEntity(piece, col, row);

    this.grid[col][row] = entity;

    return entity;
  }

  /**
   * Сущность уходит с доски: клетка грида освобождается (если сущность ещё в
   * ней), паспорт забывается, владелец снимает свои ссылки (`onEntityDestroyed`).
   * Один путь на все способы ухода - удар, превращение, сбор, поглощение
   * слизью, предуровневый бустер.
   */
  detach(uid: number): BoardEntity | undefined {
    const entity = this.entities.get(uid);

    if (!entity) {
      return undefined;
    }

    this.vacate(entity);
    this.entities.delete(uid);
    this.onEntityDestroyed(entity);

    return entity;
  }

  place(entity: BoardEntity, col: number, row: number): void {
    entity.x = col;
    entity.y = row;
    this.grid[col][row] = entity;
  }

  vacate(entity: BoardEntity, at: IBoardCellPos = { col: entity.x, row: entity.y }): void {
    if (this.grid[at.col]?.[at.row] === entity) {
      this.grid[at.col][at.row] = null;
    }
  }

  /** Спрайт фишки движка в клетке; регистрируется по паспорту. */
  private createEntity(piece: Readonly<TBoardPiece>, col: number, row: number): BoardEntity {
    const entity = createEntityFromPiece(piece, {
      runtime: this.runtime,
      container: this.pieceLayer,
      col,
      row,
    });

    this.entities.set(piece.uid, entity);

    return entity;
  }

  /** Спрайт накладки или подложки в своём слое контейнера; регистрируется по паспорту. */
  private createLayer(
    container: Container,
    uid: number,
    layer: { id: TLayerId; hp: number; col: number; row: number }
  ): LayerEntity {
    const entity = new LayerEntity(this.runtime, container, layer);

    this.layers.set(uid, entity);

    return entity;
  }

  /**
   * Выключение вместе с партией. Твины часов рантайма к этому моменту уже
   * погашены (`GameRuntimeCore.destroy` гасит часы раньше модулей), поэтому
   * спрайты снимает контейнер доски целиком; здесь снимаются только ссылки,
   * чтобы дорезолвившееся проигрывание не трогало мёртвые объекты.
   */
  destroy(): void {
    this.isDestroyed = true;
    this.grid = [];
    this.entities.clear();
    this.layers.clear();
  }
}

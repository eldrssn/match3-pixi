import { Container } from 'pixi.js';
import { BoardEngine, type TBoardDeadEndOutcome } from '@/entities/game';
import { createSeededRandom } from '@/shared/lib/random';
import type { SoundEngine } from '../audio/SoundEngine';
import { GAME_CONFIG } from '../configs/GAME_CONFIG';
import { getLevelConfig, getRuntimeSeed } from '../configs/levelConfig';
import { getRenderQuality } from '../configs/renderQuality';
import { BOARD_TIMING } from '../configs/timing';
import type { GameRuntimeCore } from '../core/GameRuntimeCore';
import type { IRuntimeViewport, ISwapRequest } from '../core/RuntimeEvents';
import type { IBoardFx } from '../fx/boardFx';
import { createBoardFx } from '../fx/createBoardFx';
import type { IBoardHud } from '../hud/boardHud';
import { resolveBoardDesignSize, resolveBoardFitScale } from '../lib/boardFit';
import { canShowIdleHint } from '../lib/canShowIdleHint';
import { playEndOfGameScene } from '../lib/endOfGameScene';
import type { IPendingInputGate } from '../lib/pendingBoardInput';
import { runGuarded } from '../lib/runGuarded';
import { resolveTapAction } from '../lib/tapSelection';
import { destroyDisplay } from '../motion/displayMotion';
import { useGameStore, type TGameBoosterKind } from '../store/GameStore';
import { useLevelConfigStore, type LevelConfig } from '../store/levelConfigStore';
import { BoardStepPlayer } from './BoardStepPlayer';
import { BoosterMode } from './BoosterMode';
import { BoardEntity } from './cells/BoardEntity';
import { CellInputController } from './cells/CellInputController';
import type { ICellRuntime } from './cells/cellsTypes';
import { ChipEntity } from './cells/ChipEntity';
import { SpecialEntity } from './cells/SpecialEntity';
import { GameBoardBackground } from './GameBoardBackground';
import { IdleBreathing } from './IdleBreathing';
import { IdleHint } from './IdleHint';
import { PendingBoardInput } from './PendingBoardInput';
import { SelectionMarker } from './SelectionMarker';
import { SwapDragController } from './SwapDragController';

/** Пауза перед разбором тупика после хода (`refreshBoardState`). */
const BOARD_SETTLE_DELAY_MS = BOARD_TIMING.cascade.settleDelayMs;

/** Пауза после сборки доски перед предуровневыми бустерами - как у эталона. */
const BOARD_BUILT_PAUSE_MS = 250;

interface IGameLogicOptions {
  /** Звук партии; без него партия идёт молча. */
  sound: SoundEngine | null;
  /** Шапка партии: счётчик ходов, панель целей, интро цели. */
  hud: IBoardHud;
  /** Эффекты доски; по умолчанию - `fx/createBoardFx` поверх контейнера доски. */
  createFx?: (container: Container) => IBoardFx;
}

/**
 * Рантайм доски: ввод, проигрывание хода и всё, что вокруг него.
 *
 * Правила доски живут не здесь, а в чистом движке `BoardEngine`
 * (`entities/game/engine`): он разыгрывает свап, каскад, урон, гравитацию,
 * добор, спецфишки, бустеры и перемешку целиком и синхронно и отдаёт протокол
 * шагов. Проигрывает его `BoardStepPlayer` (анимации, эффекты, зеркало доски
 * спрайтами), выбор цели бустера ведёт `BoosterMode`. Сам `GameLogic` -
 * оркестратор хода: жест и буфер ввода, занятость доски, заряд бустера,
 * подсказки простоя, тупик, исход и финальная сцена.
 *
 * Ось доски одна во всём рантайме: `grid[col][row]` - первый индекс колонка
 * (X), второй строка (Y), `entity.x` - колонка, `entity.y` - строка.
 *
 * Ядро приходит явно (`GameRuntimeCore`): глобала, который после `await` мог
 * указать на ядро следующей партии, у Pixi-рантайма нет. Флаг `isDestroyed`
 * остаётся - стор (`GameStore`) синглтон, и сценарий, переживший уничтожение
 * партии, не должен писать в него за следующую.
 */
export class GameLogic {
  private readonly core: GameRuntimeCore;
  private readonly hud: IBoardHud;
  private readonly fx: IBoardFx;
  /** Звук партии; без него партия идёт молча. */
  private readonly sound: SoundEngine | null;
  /**
   * Спрайты доски и проигрывание шагов движка: зеркало грида движка, которое
   * догоняет его по мере анимации хода.
   */
  private readonly player: BoardStepPlayer;
  /** Выбор цели бустера: режим кнопок и клеток. */
  private readonly boosterMode: BoosterMode;
  /** Движок доски; появляется вместе с доской (`createBoard`). */
  private engine: BoardEngine | null = null;
  /** Число колонок доски (ось X). */
  private readonly colCount: number;
  /** Число строк доски (ось Y). */
  private readonly rowCount: number;
  private readonly gridContainer = new Container({ label: 'GameBoard' });
  private readonly levelConfig: LevelConfig | null;
  private gridDesignWidth = 0;
  private gridDesignHeight = 0;
  /** Ужатие поля крупнее 6×6 под область сцены (`lib/boardFit`). */
  private boardFitScale = 1;
  private background: GameBoardBackground | null = null;

  /**
   * Доска занята асинхронным каскадом (свап, спецфишка, бустер): анимации,
   * урон, падение, генерация. Наружу - только чтение (`isBoardBusy`).
   */
  private isProcessing = false;

  /**
   * Две причины ускорить рантайм: темп сцены (финал) и ждущий в буфере ход.
   * Хранятся порознь, а на часы идёт большая: иначе буфер, взведённый во время
   * финала, перезаписал бы его темп своим, а сброс буфера - вернул бы к 1.
   */
  private sceneTimeScale = 1;
  private hasPendingInput = false;

  /**
   * Партию выключили (`destroy()`). Асинхронный сценарий может пережить её:
   * после каждого `await` сценарий сверяется с этим флагом, а аварийные
   * выходы (`releaseBoard`, `failSceneStart`) на мёртвой доске в стор не
   * пишут - стор к этому моменту принадлежит уже следующей партии.
   */
  private isDestroyed = false;

  private readonly unsubscribers: (() => void)[] = [];

  /** Выбор первого тапа хода двумя тапами и рамка над ним. */
  private readonly selection: SelectionMarker;
  /** Подсказка простоя: пульс валидного хода после паузы без действий. */
  private readonly idleHint: IdleHint;
  /** Дыхание фишек в покое - на том же жизненном цикле, что подсказка простоя. */
  private readonly idleBreathing: IdleBreathing;
  /** Слежение пары за пальцем (`modules/SwapDragController`). */
  private readonly swapDrag: SwapDragController;
  /** Тап спецфишки и свайп, сделанные во время чужого каскада. */
  private readonly pendingInput: PendingBoardInput;

  /**
   * Спецфишка, подсвеченная как единственный выход из тупика. Держим ссылку,
   * чтобы снять подсветку, когда ходы на доске снова появились.
   */
  private highlightedSpecial: SpecialEntity | null = null;

  /** Доска занята каскадом: новый ход или бустер начинать нельзя. */
  public get isBoardBusy(): boolean {
    return this.isProcessing;
  }

  constructor(core: GameRuntimeCore, { sound, hud, createFx }: IGameLogicOptions) {
    this.core = core;
    this.hud = hud;
    this.sound = sound;
    this.levelConfig = getLevelConfig();
    this.colCount = this.levelConfig?.grid.length || 0;
    this.rowCount = this.levelConfig?.grid[0]?.length || 0;

    core.layers.get('GameBoard').addChild(this.gridContainer);
    // Слой фишек появится с проигрывателем шагов ниже - эффекты берут его геттером.
    this.fx =
      createFx?.(this.gridContainer) ??
      createBoardFx(core, this.gridContainer, () => this.player.piecesContainer);

    const runtime: ICellRuntime = { core, fx: this.fx };

    this.player = new BoardStepPlayer(this.gridContainer, {
      runtime,
      hud,
      colCount: this.colCount,
      rowCount: this.rowCount,
      sound,
      // Подсвеченная или выбранная фишка ушла с доски - держать её не на чем.
      onEntityDestroyed: (entity) => {
        if (entity === this.highlightedSpecial) {
          this.clearSpecialHighlight();
        }

        if (entity === this.selection.entity) {
          this.clearSelection();
        }
      },
    });

    // Рамка выбора - поверх слоёв доски: `BoardStepPlayer` кладёт их в
    // контейнер в своём конструкторе, то есть раньше.
    this.selection = new SelectionMarker(core.motion, this.gridContainer);
    this.pendingInput = new PendingBoardInput({
      resolveGate: (entity) => this.resolvePendingInputGate(entity),
      replaySpecial: (special) => this.handleSpecialActivateRequest(special),
      replaySwap: (row, col, targetRow, targetCol) =>
        this.handleSwapRequest({ row, col, targetRow, targetCol }),
      // Пока в буфере ждёт ход игрока, доска доигрывает текущий каскад
      // быстрее; буферизованный ход стартует уже в обычном темпе.
      onPendingChange: (hasPending) => {
        this.hasPendingInput = hasPending;
        this.syncRuntimeTimeScale();
      },
    });

    // До первого `setProcessing`: `initAnimation` сразу ставит занятие, и
    // `setProcessing` вызывает disarm/arm у подсказки простоя.
    this.idleHint = new IdleHint(core.motion, core.app.stage, () => this.resolveIdleHintPair());
    this.idleBreathing = new IdleBreathing(core.motion, () => this.pickBreathingChip());
    // Слежение пары за пальцем: вторую половину пары контроллер ищет по гриду
    // спрайтов, который держит `BoardStepPlayer`, - доступ колбэком.
    this.swapDrag = new SwapDragController(core.events, (col, row) => this.player.cellAt(col, row));
    this.boosterMode = new BoosterMode({
      events: core.events,
      motion: core.motion,
      stage: core.app.stage,
      isBoardBusy: () => this.isProcessing,
      getEntities: () => this.player.entitiesOnBoard(),
      onTargetPicked: this.handleBoosterTarget,
    });

    this.initStates();

    this.unsubscribers.push(
      useGameStore.subscribe((state, previous) => {
        if (previous.outOfMoves === 'pending' && state.outOfMoves !== 'pending') {
          this.handleOutOfMovesDecision(state.outOfMoves === 'declined');
        }
      }),
      core.events.on('swapRequest', this.handleSwapRequest),
      core.events.on('cellTap', this.handleCellTap),
      // Взяли бустер - тапы по доске теперь цели бустера, а не ход.
      core.events.on('boosterStart', this.clearSelection),
      core.events.on('resize', this.handleResize),
      // Замок ввода закрылся посреди жеста (слой хоста поверх доски): пара
      // уезжает домой, иначе клетка осталась бы «в руке» до конца партии.
      core.input.addResetHook(() => CellInputController.cancelActiveDrag())
    );

    runGuarded('initAnimation', () => this.initAnimation(), this.failSceneStart);
  }

  /**
   * Единственная точка смены `isProcessing`: на освобождении рантайма надо
   * дослать отложенный ввод игрока. Освобождение доски перезапускает отсчёт
   * подсказки простоя, занятие - гасит её.
   *
   * Порядок на освобождении важен: подсказка армится ДО флаша. Флаш
   * отложенного ввода синхронно доходит до нового `setProcessing(true)`
   * (`runGuarded` зовёт сценарий синхронно, а тот поднимает занятость до
   * первого `await`) - стой `arm` после флаша, он перетёр бы вложенный
   * `disarm`, и подсказка оказалась бы заармлена на занятой доске.
   */
  private setProcessing(isProcessing: boolean): void {
    this.isProcessing = isProcessing;

    // Выбор первого тапа на занятой доске устаревает: фишка вот-вот уедет.
    if (isProcessing) {
      this.clearSelection();
    }

    // Зеркалим в стор: клетка под пальцем читает занятость доски оттуда
    // (`CellInputController.onGlobalPointerMove`).
    useGameStore.getState().setBoardBusy(isProcessing);

    if (!isProcessing) {
      this.assertGridInSync();
      this.idleHint.arm();
      this.idleBreathing.arm();
      this.pendingInput.flush();
    } else {
      this.idleHint.disarm();
      this.idleBreathing.disarm();
    }
  }

  /**
   * Состояние партии для правил отложенного ввода (`lib/pendingBoardInput`).
   * «Сущность жива в гриде» решается по её же `x/y`: гравитация держит их
   * актуальными.
   */
  private resolvePendingInputGate(entity: BoardEntity): IPendingInputGate {
    const { isGameEnded, runtimeFailure } = useGameStore.getState();

    return {
      isEntityOnBoard: this.player.isOnBoard(entity),
      isGameEnded,
      hasRuntimeFailure: runtimeFailure !== null,
    };
  }

  /**
   * Аварийная разблокировка доски после упавшего сценария: исключение
   * оставило бы флаг поднятым, а доску - навсегда неинтерактивной. Сценарий
   * всё равно уже сломан, поэтому честнее вернуть игроку управление.
   */
  private releaseBoard = (): void => {
    if (this.isDestroyed) {
      return;
    }

    // Исход ждёт флага финальной сцены, а доиграть её на упавшем сценарии уже
    // некому: без этого партия зависла бы законченной, но без исхода.
    if (useGameStore.getState().isGameEnded) {
      useGameStore.getState().setFinaleFinished();
    }

    this.setProcessing(false);
  };

  /**
   * Стартовая сборка доски сорвалась - партию продолжать нечем. Типичная
   * причина - движок бросает на неизвестном `id` ячейки уровня. Отказ
   * рантайма ведёт в тот же сценарий, что битые текстуры: хост получает
   * `onError` (`useGameRuntimeEvents`).
   */
  private failSceneStart = (): void => {
    if (this.isDestroyed) {
      return;
    }

    this.releaseBoard();
    useGameStore.getState().failRuntime('board');
  };

  /**
   * Вступление партии: цель уровня и сборка поля.
   *
   * Удержания цели дожидаемся - пока она по центру, показывать под ней
   * нечего; а её полёт в шапку и сборку доски пускаем **параллельно**: поле
   * собирается под летящей целью. Последовательные «долетела -> посветлело ->
   * собралась» складывались бы в лишние ~500 мс.
   */
  private async initAnimation(): Promise<void> {
    this.setProcessing(true);

    await this.hud.playIntroHold();

    if (this.isDestroyed) {
      return;
    }

    const outro = this.hud.playIntroOutro();

    this.background = this.core.registerModule('gameBoard', new GameBoardBackground(this.core));

    const board = (async () => {
      await this.background?.initGameBoard();

      if (this.isDestroyed) {
        return;
      }

      await this.createBoard();
    })();

    // Обе ветки ждём вместе: весь `initAnimation` прикрыт `runGuarded`, и
    // упавший твин обязан дойти до `failSceneStart`.
    await Promise.all([outro, board]);

    if (this.isDestroyed) {
      return;
    }

    await this.placePreBoosters();

    if (this.isDestroyed) {
      return;
    }

    // Музыка - с первым ходом, а не под интро: заставка цели звучит тишиной.
    this.sound?.startMusic();
    useGameStore.getState().setIntroFinished();
    this.setProcessing(false);
  }

  /**
   * Предуровневые бустеры, выбранные хостом до партии, встают на собранную
   * доску - видно, куда, до первого хода (`BoardEngine.placeStartSpecials`).
   */
  private async placePreBoosters(): Promise<void> {
    const { preBoosters } = useLevelConfigStore.getState().partyOptions;

    if (preBoosters.length === 0) {
      return;
    }

    await this.player.play(this.requireEngine().placeStartSpecials(preBoosters));
  }

  /**
   * Контейнер доски: экран плюс ужатие поля крупнее 6×6 (`lib/boardFit`) - тот
   * же множитель, что у подложки (`GameBoardBackground`). Позиция - левый
   * верхний угол грида так, чтобы его центр встал в центр безопасной зоны
   * минус `offsetY` (в дизайн-px, как у подложки: оба контейнера обязаны
   * сдвигаться на одну величину).
   */
  private handleResize = ({ width, layout }: IRuntimeViewport): void => {
    if (this.isDestroyed || this.gridDesignWidth === 0) {
      return;
    }

    const boardScale = layout.scale * this.boardFitScale;
    const scaledWidth = this.gridDesignWidth * boardScale;
    const scaledHeight = this.gridDesignHeight * boardScale;

    this.gridContainer.scale.set(boardScale);
    this.gridContainer.position.set(
      (width - scaledWidth) / 2,
      layout.centerY - scaledHeight / 2 - GAME_CONFIG.boardContainer.offsetY * layout.scale
    );
  };

  /**
   * Доска партии: движок из уровня и зерна партии, спрайт на каждую его
   * фишку. Движок строится здесь, а не в конструкторе: на неизвестной клетке
   * уровня он бросает, а этот шаг прикрыт `runGuarded` старта.
   */
  private async createBoard(): Promise<void> {
    const level = this.levelConfig;

    if (!level) {
      throw new Error('GameLogic: level config is missing');
    }

    const engine = BoardEngine.fromLevel(level.grid, {
      colors: level.colors,
      random: createSeededRandom(getRuntimeSeed()),
      // Пропеллер летит в то, что ещё нужно цели уровня: любой слой клетки.
      // Стор опрашивается в момент полёта - закрытая цель перестаёт тянуть
      // пропеллеры на себя.
      isPriorityTarget: (ids) =>
        useGameStore.getState().goals.some((goal) => !goal.isCompleted && ids.includes(goal.id)),
    });

    this.engine = engine;
    this.player.build(engine);

    const boardSize = resolveBoardDesignSize(this.colCount, this.rowCount);

    this.gridDesignWidth = boardSize.width;
    this.gridDesignHeight = boardSize.height;
    this.boardFitScale = resolveBoardFitScale(this.colCount, this.rowCount);
    this.handleResize(this.core.viewport);

    await this.core.motion.delay(BOARD_BUILT_PAUSE_MS);
  }

  private initStates(): void {
    const store = useGameStore.getState();

    store.initMovesCount(this.levelConfig?.moves || 0);
    store.initGoals(this.levelConfig?.levelGoals || []);
    this.hud.init();
  }

  /**
   * Исход партии решается один раз и ровно один: победа исключает поражение.
   *
   * Без `else` закрытые последним ходом цели перетирались бы веткой «ходы
   * закончились». Ранний выход по `isGameEnded` - по той же причине: проверка
   * идёт после каждого хода, и повторный `setIsGameEnded` перезаписал бы уже
   * принятый исход.
   */
  private checkGameEndConditions(): void {
    const { isGameEnded, movesCount, areAllGoalsCompleted } = useGameStore.getState();

    if (isGameEnded) {
      return;
    }

    if (areAllGoalsCompleted()) {
      useGameStore.getState().setIsGameEnded(true);
      return;
    }

    if (movesCount > 0) {
      return;
    }

    // Ходы кончились, цели нет. Хост, который слушает `onOutOfMoves`, решает
    // сам - добавить ходов или сдаться; партия ждёт (near-miss). Без него, и
    // после его отказа, - поражение.
    const { outOfMoves, offerContinue } = useGameStore.getState();

    if (useLevelConfigStore.getState().partyOptions.offersContinue && outOfMoves === 'none') {
      offerContinue();
      return;
    }

    if (outOfMoves !== 'pending') {
      useGameStore.getState().setIsGameEnded(false);
    }
  }

  /**
   * Свап от игрока. Обёртка синхронная: шина не ждёт промис обработчика и не
   * ловит его ошибку - без `runGuarded` сбой внутри цикла матчей стал бы
   * unhandled rejection и оставил доску заблокированной.
   */
  private handleSwapRequest = (request: ISwapRequest): void => {
    runGuarded('swapRequest', () => this.runSwapRequest(request), this.releaseBoard);
  };

  private async runSwapRequest({ row, col, targetRow, targetCol }: ISwapRequest): Promise<void> {
    // Палец мог довести фишку почти до соседней клетки, а ход при этом не
    // состояться вовсе: доска занялась каскадом, сосед - край доски или
    // блокер. Смещение уже передано анимации свапа (`commitSwap`), и без
    // явного возврата фишка осталась бы стоять мимо клетки.
    const dragged = this.player.cellAt(col, row);

    // Свайп - самостоятельный ход: выбор первого тапа к нему не относится.
    this.clearSelection();

    // Второй рубеж «с выбранным бустером фишки не двигаются» (первый - в
    // клетке: жест в бустер-режиме не начинается). Мультитач: палец уже вёл
    // фишку, а вторым тапнули кнопку бустера. Ход отклоняем, пару
    // возвращаем руками. Ходы кончились и партия ждёт хоста - свайп тоже не
    // ход и в буфер не идёт.
    if (this.boosterMode.isActive || this.isAwaitingContinue()) {
      this.swapDrag.releasePartner(true);
      void dragged?.returnHome();

      return;
    }

    if (this.isProcessing) {
      // Доска занята каскадом - свайп не теряем, а буферизуем до освобождения
      // (`PendingBoardInput`). Домой возвращаем сразу: буферизованный ход
      // переиграется с нуля, по доске, которая к тому моменту уже другая.
      // Партия кончилась (идёт финал) - хода больше не будет, в буфер не идёт.
      this.swapDrag.releasePartner(true);

      if (dragged) {
        if (!useGameStore.getState().isGameEnded) {
          this.pendingInput.bufferSwap(dragged, { col, row }, targetCol - col, targetRow - row);
        }

        void dragged.returnHome();
      }

      return;
    }

    if (
      targetCol >= 0 &&
      targetCol < this.colCount &&
      targetRow >= 0 &&
      targetRow < this.rowCount
    ) {
      const tile = this.player.cellAt(col, row);
      const neighbor = this.player.cellAt(targetCol, targetRow);

      if (!tile || !neighbor) {
        void dragged?.returnHome();

        return;
      }

      this.setProcessing(true);
      try {
        await this.swapTiles(tile, neighbor);
      } finally {
        this.setProcessing(false);
      }

      return;
    }

    // Свайп за пределы доски: соседа нет вовсе.
    void dragged?.returnHome();
  }

  /**
   * Отклонённый свап: пара уезжает и возвращается заметно быстрее валидного,
   * без перелёта на возврате, и в конце коротко дрожит. Две полные анимации
   * свапа с перелётом сделали бы первую половину промаха неотличимой от
   * принятого хода.
   */
  private async playRejectedSwap(
    tile: BoardEntity,
    neighbor: BoardEntity,
    tileCoords: { visualX: number; visualY: number },
    neighborCoords: { visualX: number; visualY: number }
  ): Promise<void> {
    // `scaleToDistance` делает отказ честным на обеих ногах: палец мог довести
    // пару почти до конца - тогда «туда» уже произошло руками.
    const rejectMotion = {
      durationMs: BOARD_TIMING.swap.rejectMs,
      ease: 'Quad.easeOut',
      scaleToDistance: true,
    };

    await Promise.all([
      tile.moveToCoords(neighborCoords.visualX, neighborCoords.visualY, rejectMotion),
      neighbor.moveToCoords(tileCoords.visualX, tileCoords.visualY, rejectMotion),
    ]);

    await Promise.all([
      tile.moveToCoords(tileCoords.visualX, tileCoords.visualY, rejectMotion),
      neighbor.moveToCoords(neighborCoords.visualX, neighborCoords.visualY, rejectMotion),
    ]);

    await Promise.all([tile.playRejectShake(), neighbor.playRejectShake()]);
  }

  /**
   * Ход игрока: движок решает, ход ли это, рантайм показывает исход.
   * Валидность решается ДО анимации: `trySwap` синхронный, так что «спросить
   * заранее» не стоит ни кадра, а отказ можно сделать короче.
   */
  private async swapTiles(tile: BoardEntity, neighbor: BoardEntity): Promise<void> {
    const tileCoords = tile.getVisualCoords();
    const neighborCoords = neighbor.getVisualCoords();

    const outcome = this.requireEngine().trySwap(
      { col: tile.x, row: tile.y },
      { col: neighbor.x, row: neighbor.y }
    );

    // Блокер, дыра или спецфишка с блокером - ход невозможен. Пару надо
    // вернуть в свои клетки: палец мог увести фишку к соседу-блокеру на
    // четверть клетки (`GAME_CONFIG.dragFollowTiles.blocked`).
    if (outcome.kind === 'blocked') {
      await Promise.all([tile.returnHome(), neighbor.returnHome()]);

      return;
    }

    if (outcome.kind === 'rejected') {
      this.sound?.play('reject');
      await this.playRejectedSwap(tile, neighbor, tileCoords, neighborCoords);

      return;
    }

    // Ход списывается здесь, до анимации, а не в конце каскада: иначе счётчик
    // падал бы через секунду после свайпа. Проверка конца партии живёт в
    // `refreshBoardState`, то есть после всего каскада.
    this.spendMove();

    await this.player.play(outcome.steps);
    await this.refreshBoardState();
  }

  /**
   * Ход израсходован. Отделено от `refreshBoardState`: бустер тратит свой
   * заряд, а не ход игрока, но ему тоже нужен пересчёт целей и исхода.
   */
  private spendMove(): void {
    this.hud.decreaseMoves();
    useGameStore.getState().countMove();
  }

  /**
   * Перерисовка панели целей и проверка исхода партии. Прогресс целей уже в
   * сторе (его пишет `BoardStepPlayer` по шагам хода, `listGoalEvents`);
   * читателей два - начало `refreshBoardState` и хвост ветки перемешки.
   */
  private refreshGoalsPanelAndOutcome(): void {
    this.hud.refreshGoals();
    this.checkGameEndConditions();
  }

  /**
   * Пересчёт состояния доски без списания хода. Проигрывание могло
   * оборваться на уничтожении партии - тогда пересчёт обязан молчать: исход
   * мёртвой доски записался бы новой партии ложным поражением.
   */
  private async refreshBoardState(): Promise<void> {
    if (this.isDestroyed) {
      return;
    }

    this.refreshGoalsPanelAndOutcome();

    // Ходы кончились, и партия ждёт решения хоста: выходим сразу, до паузы.
    // Хост тут же показывает свой слой, партия встаёт на паузу, и ожидание на
    // её часах шло бы потом параллельно с `handleOutOfMovesDecision`.
    if (this.isAwaitingContinue()) {
      return;
    }

    await this.core.motion.delay(BOARD_SETTLE_DELAY_MS);

    if (this.isDestroyed) {
      return;
    }

    // Разбор тупика и шаффл - дела живой партии: на законченной доска сразу
    // уходит в финальную сцену.
    if (useGameStore.getState().isGameEnded) {
      await this.playEndOfGameSceneIfReady();
      return;
    }

    if (this.isAwaitingContinue()) {
      return;
    }

    await this.resolveDeadEnd(this.requireEngine().resolveDeadEnd());
  }

  /**
   * Исход тупика по его виду (`BoardEngine.resolveDeadEnd`): подсказка
   * спецфишкой, проигранная перемешка или честное поражение. Стрелки, а не
   * методы: реестру нужен `this` логики.
   */
  private readonly deadEndHandlers: {
    readonly [K in TBoardDeadEndOutcome['kind']]: (
      deadEnd: Extract<TBoardDeadEndOutcome, { kind: K }>
    ) => Promise<void> | void;
  } = {
    hasMove: () => {
      // Ходы вернулись сами (каскад, новые фишки) - подсказка больше не нужна.
      this.clearSpecialHighlight();
    },

    specialHint: ({ uid }) => {
      // Уже подсвеченную спецфишку держим: подсказка не должна прыгать по
      // доске от хода к ходу, пока выход из тупика всё тот же.
      const special = this.highlightedSpecial ?? this.player.entity(uid);

      if (special instanceof SpecialEntity) {
        this.highlightedSpecial = special;
        special.highlightSpecial();
      }
    },

    shuffled: async ({ steps }) => {
      this.clearSpecialHighlight();
      await this.player.play(steps);

      if (this.isDestroyed) {
        return;
      }

      // После шаффла исход перепроверяем: каскад запасной раскладки мог
      // закрыть последнюю цель уровня.
      this.refreshGoalsPanelAndOutcome();
      await this.playEndOfGameSceneIfReady();
    },

    stuck: async () => {
      // Ход не построить даже вручную: на этой доске его физически нет.
      // Честное поражение лучше зависания на неиграбельной доске.
      console.warn('⚠️ На доске не существует возможных ходов - завершаем партию');
      this.clearSpecialHighlight();
      useGameStore.getState().setIsGameEnded(false);
      await this.playEndOfGameSceneIfReady();
    },
  };

  private async resolveDeadEnd(deadEnd: TBoardDeadEndOutcome): Promise<void> {
    // Запись реестра берётся по виду этого же исхода: сужение по `kind`
    // компилятор через индекс не протаскивает.
    const handle = this.deadEndHandlers[deadEnd.kind] as (
      deadEnd: TBoardDeadEndOutcome
    ) => Promise<void> | void;

    await handle(deadEnd);
  }

  /**
   * Хост решил, что делать с исходом ходов. Добавочные ходы - счётчик
   * показывает их, и доска разбирает тупик, как после обычного хода; отказ -
   * поражение с финальной сценой. Решение приходит из React-слоя в любой
   * момент, поэтому сценарий занимает доску сам.
   */
  private handleOutOfMovesDecision(isDeclined: boolean): void {
    if (this.isDestroyed) {
      return;
    }

    runGuarded(
      'outOfMovesDecision',
      async () => {
        this.setProcessing(true);

        try {
          if (isDeclined) {
            this.checkGameEndConditions();
            await this.playEndOfGameSceneIfReady();

            return;
          }

          this.hud.refreshMoves();
          await this.refreshBoardState();
        } finally {
          this.setProcessing(false);
        }
      },
      this.releaseBoard
    );
  }

  /**
   * Финальная сцена на доске перед карточкой результата. Играет под занятой
   * доской; после неё React видит `isFinaleFinished` и только тогда
   * отправляет исход. Флаг - в `finally`: упавшая сцена не должна оставить
   * партию законченной без результата. Повторный вызов сцену не
   * перезапускает: `refreshBoardState` зовётся после каждого хода.
   */
  private async playEndOfGameSceneIfReady(): Promise<void> {
    const { isGameEnded, isGameWin, isFinaleFinished } = useGameStore.getState();

    if (!isGameEnded || isFinaleFinished) {
      return;
    }

    // Музыка уступает место концовке: фанфара победы или спуск поражения.
    this.sound?.stopMusic();

    try {
      if (isGameWin) {
        await this.playVictoryBonus();
      }

      if (this.isDestroyed) {
        return;
      }

      this.sound?.play(isGameWin ? 'win' : 'lose');
      await playEndOfGameScene(this.core.motion, this.fx, {
        isWin: isGameWin,
        colCount: this.colCount,
        rowCount: this.rowCount,
      });
    } finally {
      if (!this.isDestroyed) {
        useGameStore.getState().setFinaleFinished();
      }
    }
  }

  /**
   * Финальный бонус победы: оставшиеся ходы становятся ракетами и стреляют,
   * затем срабатывают спецфишки, оставшиеся на доске (`BoardEngine.playFinale`).
   * Темп ускорен - это кульминация перед карточкой результата.
   */
  private async playVictoryBonus(): Promise<void> {
    const steps = this.requireEngine().playFinale(useGameStore.getState().movesCount);

    if (steps.length === 0) {
      return;
    }

    this.clearSpecialHighlight();
    this.setSceneTimeScale(BOARD_TIMING.finale.speedUp);

    try {
      await this.player.play(steps);
    } finally {
      if (!this.isDestroyed) {
        this.setSceneTimeScale(1);
      }
    }
  }

  /**
   * Снимает подсветку спецфишки - выхода из тупика. Подсветка - бесконечный
   * твин, поэтому снимается не только по клику: иначе каждый ход в тупике
   * добавлял бы на тот же спрайт ещё один.
   */
  private clearSpecialHighlight(): void {
    if (!this.highlightedSpecial) {
      return;
    }

    this.highlightedSpecial.unhighlightSpecial();
    this.highlightedSpecial = null;
  }

  /**
   * Открыты ли «idle»-эффекты доски: состояние партии собирается здесь, само
   * правило - чистое `lib/canShowIdleHint`.
   */
  private resolveIdleGatesOpen(): boolean {
    const { isGameEnded, runtimeFailure } = useGameStore.getState();

    return canShowIdleHint({
      isBoardBusy: this.isProcessing,
      isGameEnded,
      hasRuntimeFailure: runtimeFailure !== null,
      isAwaitingContinue: this.isAwaitingContinue(),
    });
  }

  /**
   * Ходы кончились, и партия ждёт решения хоста (`onOutOfMoves`) или уже
   * получила отказ: ход, тап и бустер не принимаются.
   */
  private isAwaitingContinue(): boolean {
    return useGameStore.getState().outOfMoves !== 'none';
  }

  /**
   * Пара для подсказки простоя (`IdleHint`): гейт состояния плюс лучший ход
   * движка (`BoardEngine.findBestMove`) - самая ценная фигура или комбинация,
   * а не первый найденный ход.
   */
  private resolveIdleHintPair(): BoardEntity[] | null {
    if (!this.resolveIdleGatesOpen()) {
      return null;
    }

    const swapPair = this.engine?.findBestMove();

    if (!swapPair) {
      return null;
    }

    const pair = swapPair
      .map((cell) => this.player.cellAt(cell.col, cell.row))
      .filter((entity): entity is BoardEntity => entity !== null);

    return pair.length === swapPair.length ? pair : null;
  }

  // ------------------------------------------------------- ход двумя тапами

  /**
   * Тап по клетке (`cellTap`): выбор фишки, второй тап хода, взрыв спецфишки
   * или снятие выбора (`lib/tapSelection`). Накладки и блокеры знает движок,
   * поэтому «можно ли двигать» спрашивается у него.
   */
  private handleCellTap = (entity: BoardEntity): void => {
    const engine = this.engine;

    if (!engine || this.boosterMode.isActive || this.isAwaitingContinue()) {
      this.clearSelection();
      return;
    }

    const pos = { col: entity.x, row: entity.y };
    const piece = engine.pieceAt(pos);
    const isSpecial = entity instanceof SpecialEntity;
    const selected = this.selection.entity;
    const action = resolveTapAction(selected ? { col: selected.x, row: selected.y } : null, {
      ...pos,
      isSpecial,
      canSwap: piece !== null && engine.canSwapAt(pos),
    });

    this.tapActions[action](entity, selected);
  };

  /**
   * Действие тапа по его виду (`resolveTapAction`) - реестр, а не `switch`.
   */
  private readonly tapActions: Record<
    ReturnType<typeof resolveTapAction>,
    (entity: BoardEntity, selected: BoardEntity | null) => void
  > = {
    select: (entity) => {
      // На занятой доске выбирать нечего: фишка вот-вот уедет. Свайп в этот
      // момент буферизуется, а тап - нет: он ещё не ход.
      if (!this.isProcessing) {
        this.selection.select(entity);
      }
    },
    swap: (entity, selected) => {
      this.clearSelection();

      if (selected) {
        this.handleSwapRequest({
          row: selected.y,
          col: selected.x,
          targetRow: entity.y,
          targetCol: entity.x,
        });
      }
    },
    activate: (entity) => {
      this.clearSelection();

      if (entity instanceof SpecialEntity) {
        this.handleSpecialActivateRequest(entity);
      }
    },
    clear: () => {
      this.clearSelection();
    },
    none: () => undefined,
  };

  private clearSelection = (): void => {
    this.selection.clear();
  };

  /**
   * Случайная фишка для дыхания доски (`IdleBreathing`) - только
   * `ChipEntity`, с общими гейтами. Дыхание - чистая косметика, поэтому
   * `Math.random`, а не зерно партии: отбери оно числа у движка, та же партия
   * с тем же зерном разошлась бы от того, сколько секунд игрок думал.
   */
  private pickBreathingChip(): ChipEntity | null {
    if (!this.resolveIdleGatesOpen() || getRenderQuality() === 'low') {
      return null;
    }

    const chips = this.player
      .entitiesOnBoard()
      .filter((entity): entity is ChipEntity => entity instanceof ChipEntity);

    return chips.length > 0 ? chips[Math.floor(Math.random() * chips.length)] : null;
  }

  private requireEngine(): BoardEngine {
    if (!this.engine) {
      throw new Error('GameLogic: board engine is not ready');
    }

    return this.engine;
  }

  /** Сверка зеркала спрайтов с движком на свободной доске (dev, `BoardStepPlayer.assertInSync`). */
  private assertGridInSync(): void {
    if (this.engine && !this.isDestroyed) {
      this.player.assertInSync(this.engine);
    }
  }

  /**
   * Единственная точка смены темпа рантайма - ускорение под буферизованный
   * ввод и финал. Твины, задержки и страховочные таймеры живут на одних часах
   * (`RuntimeMotion`), поэтому темп меняется у всех разом: разъедься они,
   * страховка срабатывала бы раньше честного конца и рвала каскад.
   */
  private syncRuntimeTimeScale(): void {
    const pendingTimeScale = this.hasPendingInput ? BOARD_TIMING.input.pendingSpeedUp : 1;

    this.core.motion.setTimeScale(Math.max(this.sceneTimeScale, pendingTimeScale));
  }

  private setSceneTimeScale(timeScale: number): void {
    this.sceneTimeScale = timeScale;
    this.syncRuntimeTimeScale();
  }

  // --------------------------------------------------------------- спецфишки

  /**
   * Активация спецфишки игроком: одиночный тап. Флаг занятости здесь именно
   * **ставится**: за вызовом идёт вся цепочка (взрыв, задетые спецфишки,
   * урон, падение, следующие звенья каскада). Тап - это ход, как в Royal
   * Match (бот-проверка каталога считает так же).
   */
  public handleSpecialActivateRequest = (special: SpecialEntity): void => {
    runGuarded('specialActivate', () => this.runSpecialActivateRequest(special), this.releaseBoard);
  };

  private async runSpecialActivateRequest(special: SpecialEntity): Promise<void> {
    if (this.isAwaitingContinue()) {
      return;
    }

    if (this.isProcessing) {
      // Доска занята чужим каскадом - запрос не теряем, а откладываем до
      // освобождения (`PendingBoardInput`). После конца партии хода не будет.
      if (!useGameStore.getState().isGameEnded) {
        this.pendingInput.bufferSpecial(special);
      }

      return;
    }

    this.clearSpecialHighlight();

    this.setProcessing(true);
    try {
      const steps = this.requireEngine().activateSpecialAt({ col: special.x, row: special.y });

      if (!steps) {
        return;
      }

      this.spendMove();
      await this.player.play(steps);
      await this.refreshBoardState();
    } finally {
      this.setProcessing(false);
    }
  }

  // ----------------------------------------------------------------- бустеры

  /**
   * Игрок выбрал клетку-цель бустера (`BoosterMode`). Доска занимается на всё
   * применение: заряд, ход движка и его проигрывание.
   */
  private handleBoosterTarget = (cell: BoardEntity): void => {
    runGuarded('boosterCellUp', () => this.runBoosterTarget(cell), this.releaseBoard);
  };

  private async runBoosterTarget(cell: BoardEntity): Promise<void> {
    this.setProcessing(true);
    try {
      await this.applyBooster(cell);
      cell.unbrightCell();
    } finally {
      this.setProcessing(false);
    }
  }

  /**
   * Бустер по клетке: заряд, режим, ход движка и его проигрывание.
   * Применимость решает движок (`canApplyBooster`) и до списания заряда:
   * неприменимый бустер просто снимает режим, заряд остаётся у игрока.
   */
  private async applyBooster(cell: BoardEntity): Promise<void> {
    const kind = this.boosterMode.kind;

    if (!kind) {
      return;
    }

    const engine = this.requireEngine();
    const target = { col: cell.x, row: cell.y };

    if (this.isAwaitingContinue() || !engine.canApplyBooster(kind, target)) {
      this.boosterMode.stop();
      return;
    }

    const isConsumed = this.consumeBooster(kind);

    this.boosterMode.stop();

    if (!isConsumed) {
      return;
    }

    const steps = engine.applyBooster(kind, target);

    if (!steps) {
      return;
    }

    await this.player.play(steps);
    await this.refreshBoardState();
  }

  private consumeBooster(kind: TGameBoosterKind): boolean {
    const isUsed = useGameStore.getState().useBooster(kind);

    if (isUsed) {
      this.core.events.emit('boosterInventoryChanged');
    }

    return isUsed;
  }

  /**
   * Выключение доски вместе с партией (`GameRuntimeCore.destroy` -> модули).
   *
   * `isProcessing` поднимается намеренно и навсегда: асинхронное
   * проигрывание хода могло остаться в полёте, и, дорезолвившись уже после
   * уничтожения, оно не должно трогать мёртвую доску. Поднимается полем, а
   * не `setProcessing`: тот зеркалит занятость в `GameStore`, а стор к этому
   * моменту принадлежит следующей партии. По той же причине первым делом
   * ставится `isDestroyed`.
   */
  public destroy(): void {
    this.isDestroyed = true;
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.unsubscribers.length = 0;

    this.swapDrag.destroy();
    this.clearSelection();
    // Бустер-режим мог остаться активным: его подписки живут и на шине, и на
    // корне сцены, и на отложенном таймере.
    this.boosterMode.destroy();
    this.idleHint.destroy();
    this.idleBreathing.destroy();

    this.pendingInput.clear();
    this.swapDrag.releasePartner(false);
    // Жест мог остаться открытым (отпускание в WKWebView иногда не доходит):
    // без сброса статик унёс бы ссылку на клетку этой партии в следующую.
    BoardEntity.resetActiveDrag();
    this.sceneTimeScale = 1;
    this.hasPendingInput = false;
    this.syncRuntimeTimeScale();

    this.isProcessing = true;
    this.highlightedSpecial = null;
    this.player.destroy();
    this.engine = null;
    this.selection.destroy();
    this.fx.destroy();
    destroyDisplay(this.core.motion, this.gridContainer);
  }
}

import { Application, UPDATE_PRIORITY } from 'pixi.js';
import { readSoundMuted } from '../audio/soundPreference';
import { SoundEngine } from '../audio/SoundEngine';
import { getRenderDpr, resetRenderCanvasSize, setRenderCanvasSize } from '../configs/renderScale';
import { resolveRendererPreference, toRendererKind } from '../configs/renderer';
import { resetSceneInsets, setSceneInsets, type ISceneInsets } from '../configs/sceneInsets';
import { destroyApplication } from '../core/destroyApplication';
import { GameRuntimeCore } from '../core/GameRuntimeCore';
import { getStartBoosters } from '../configs/levelConfig';
import { createBoardHud } from '../hud/createBoardHud';
import { BoostersContainer } from '../modules/BoostersContainer';
import { BoosterButton } from '../modules/boosters/BoosterButton';
import { BOOSTER_BUTTONS } from '../modules/boosters/boosterButtons';
import { BoardEntity } from '../modules/cells/BoardEntity';
import { ExitButton } from '../modules/ExitButton';
import { GameGoalsPannel } from '../modules/GameGoalsPannel';
import { GameLogic } from '../modules/GameLogic';
import { MovesCounter } from '../modules/MovesCounter';
import { PerfMonitor } from '../modules/PerfMonitor';
import { ScoreMeter } from '../modules/ScoreMeter';
import { SoundToggle } from '../modules/SoundToggle';
import { useComboPhraseStore } from '../store/comboPhraseStore';
import { useGameStore } from '../store/GameStore';
import { useLevelConfigStore } from '../store/levelConfigStore';
import { loadSpineSupport, type ISpineSupport } from '../spine/spineSupport';
import { loadSkinTextures } from '../textures/loadSkinTextures';
import { registerProceduralTextures } from '../textures/proceduralTextures';
import { TextureRegistry } from '../textures/TextureRegistry';
import { runGuarded } from './runGuarded';
import { waitGameFonts } from './waitGameFonts';
import { watchRendererContext } from './watchRendererContext';

/** CSS-размер доски, в которую встаёт канвас. */
export interface ICanvasCssSize {
  width: number;
  height: number;
}

/**
 * Живой рантайм партии глазами экрана (`useGameRuntime`): пауза, ввод, ресайз
 * и уничтожение. Ссылки на движок отрисовки наружу нет - экрану она не нужна.
 */
export interface IGameRuntime {
  /** Уничтожает рантайм; повторный вызов - no-op. */
  destroy: () => void;
  /**
   * Приостанавливает партию (проп `paused` у `GameScreen`): тикер Pixi, часы и
   * твины рантайма, музыку. Пришедшая до готовности сцены пауза не теряется -
   * применится, как только сцена отрисует первый кадр.
   */
  setPaused: (isPaused: boolean) => void;
  /**
   * Отключает ввод рантайма, не трогая ход партии: пока поверх доски висит
   * DOM-слой (спиннер загрузки, слой хоста), тап не должен доходить до доски.
   * Владелец замка - `core/RuntimeInput`.
   */
  setInputEnabled: (isEnabled: boolean) => void;
  /**
   * Канвас под новый CSS-размер доски. Отступы сцены к вызову уже выставлены
   * (`setSceneInsets`), DPR берётся текущий (`getRenderDpr`: перф-гейт мог его
   * опустить).
   */
  resize: (size: ICanvasCssSize) => void;
}

export interface IBootGameRuntimeOptions {
  /**
   * Каким создавать ввод рантайма.
   *
   * По умолчанию `true`: у рантайма, чьим вводом никто не управляет,
   * выключенный на старте ввод включить было бы некому. `false` передаёт экран
   * партии: там владелец есть (`useGameRuntime`), и ему нужно закрыть окно
   * между созданием сцены и её готовностью.
   */
  isInputEnabledOnBoot?: boolean;
  /** Стартовые отступы сцены от краёв канваса (CSS px, `configs/sceneInsets`). */
  insets?: ISceneInsets;
  /**
   * Стартовый CSS-размер доски. Нужен до `Application.init`: иначе Pixi поднял
   * бы контекст и бэкбуфер под дефолтный размер и тут же пересоздавал их.
   */
  canvasSize?: ICanvasCssSize | null;
}

/**
 * Последний поднятый и ещё не уничтоженный рантайм. Живой рантайм в
 * приложении обязан быть один: `GameStore`, `renderScale` и `sceneInsets` -
 * синглтоны, и две живые партии писали бы в них наперебой. Хост за это
 * отвечает (новая партия - новый `key`), а здесь - страховка с громким
 * предупреждением.
 */
let liveRuntime: IGameRuntime | null = null;

/**
 * Поднимает Pixi-рантайм партии в переданном DOM-узле.
 *
 * Единственное место, где создаётся `Application` и ядро партии
 * (`GameRuntimeCore`): экран партии и превью редактора зовут именно его.
 *
 * Последовательность: сброс стора и модульных значений прошлой партии ->
 * параллельно `Application.init` (WebGPU с откатом на WebGL, прозрачный фон,
 * `resolution` = DPR + `autoDensity`) и загрузка файлов скина -> подписка на
 * потерю контекста -> процедурные текстуры -> ядро, слои и модули -> первый
 * отрисованный кадр снимает `isGameLoaded`.
 *
 * Init асинхронный, поэтому `destroy` может прийти раньше него: тогда рантайм
 * помечается уничтоженным, а приложение гасится, как только init вернётся, -
 * уничтожать `Application` до конца `init` Pixi не умеет.
 */
export const bootGameRuntime = (
  container: HTMLElement,
  { isInputEnabledOnBoot = true, insets, canvasSize = null }: IBootGameRuntimeOptions = {}
): IGameRuntime => {
  if (liveRuntime) {
    console.warn('[game] поднят второй рантайм партии - прошлый уничтожается');
    liveRuntime.destroy();
  }

  // Стор сбрасывается со стартовым качеством отрисовки: его уже выставил
  // `setRuntimeLevelConfig` - до замера канваса, от которого зависит DPR.
  useGameStore.getState().resetStore();
  // Хайп-фраза каскада живёт в модульном сторе, а её таймер - в React-баннере.
  // Экран мог размонтироваться, пока фраза висела, - без сброса следующая
  // партия открылась бы с чужой фразой на первом кадре.
  useComboPhraseStore.getState().clearComboPhrase();
  // Страховка на старте следующей партии: жест прошлой мог остаться открытым
  // мимо её `GameLogic.destroy` (рантайм погас до сборки доски).
  BoardEntity.resetActiveDrag();

  container.replaceChildren();

  // Модульные значения прошлой партии сюда не доживают: известного размера
  // нет - именно сброс, а не «как было».
  if (canvasSize) {
    const dpr = getRenderDpr();

    setRenderCanvasSize(canvasSize.width * dpr, canvasSize.height * dpr);
  } else {
    resetRenderCanvasSize();
  }

  if (insets) {
    setSceneInsets(insets);
  } else {
    resetSceneInsets();
  }

  let isDestroyed = false;
  let isPaused = false;
  let isInputEnabled = isInputEnabledOnBoot;
  let pendingSize = canvasSize;
  let core: GameRuntimeCore | null = null;
  /** Приложение, у которого `init` уже вернулся: только такое можно гасить. */
  let readyApp: Application | null = null;
  let unwatchContext: () => void = () => undefined;

  /** Пауза ложится на уже собранную сцену; до неё её помнит `isPaused`. */
  const applyPause = (target: GameRuntimeCore) => {
    if (isPaused) {
      target.app.ticker.stop();
      target.motion.pause();
      target.events.emit('pause');
    } else {
      target.motion.resume();
      target.app.ticker.start();
      target.events.emit('resume');
    }
  };

  const boot = async () => {
    const textures = new TextureRegistry();
    const { renderer } = useLevelConfigStore.getState().partyOptions;
    const nextApp = new Application();

    const [, failedKeys, , spine] = await Promise.all([
      nextApp.init({
        preference: resolveRendererPreference(renderer),
        backgroundAlpha: 0,
        antialias: true,
        resolution: getRenderDpr(),
        autoDensity: true,
        width: pendingSize?.width,
        height: pendingSize?.height,
        // Тикер стартует, когда сцена собрана: до этого рисовать нечего.
        autoStart: false,
      }),
      loadSkinTextures(textures),
      // Шрифт текстов холста - до первого текста сцены: Pixi меряет метрики
      // при создании текста и сам их не обновляет.
      waitGameFonts(),
      // Скелеты Spine - только если в скине есть вид клетки `spine`: иначе
      // `null` без запроса чанка `spine`. Отказ - как битый файл текстуры.
      loadSpineSupport().catch((error: unknown): ISpineSupport | 'failed' => {
        console.error('[game] не загрузились скелеты Spine', error);

        return 'failed';
      }),
    ]);

    if (isDestroyed) {
      // Пока шёл init, хост мог поднять следующую партию: её общие пулы Pixi
      // не трогаем.
      destroyApplication(nextApp, { releaseGlobals: liveRuntime === null });
      textures.destroy();

      return;
    }

    readyApp = nextApp;

    unwatchContext = watchRendererContext(nextApp.renderer);
    useGameStore.getState().setRendererKind(toRendererKind(nextApp.renderer.name));

    // Битый файл - не повод играть зелёными квадратами: отказ хосту, сцена
    // не собирается. Приложение доживёт до `destroy` - его зовёт хост.
    if (failedKeys.length > 0 || spine === 'failed') {
      useGameStore.getState().failRuntime('assets');

      return;
    }

    container.append(nextApp.canvas);
    registerProceduralTextures(textures);

    const nextCore = new GameRuntimeCore(nextApp, textures, { isInputEnabled, spine });

    core = nextCore;

    // Звук - первым: кнопка звука и доска берут его при создании. Порядок
    // модулей - как у `MainScene` эталона.
    const sound = nextCore.registerModule(
      'sound',
      new SoundEngine(nextCore.events, { muted: readSoundMuted() })
    );

    nextCore.registerModule('soundToggle', new SoundToggle(nextCore, sound));

    const goals = nextCore.registerModule('gameGoals', new GameGoalsPannel(nextCore));

    nextCore.registerModule('exitButton', new ExitButton(nextCore));

    const moves = nextCore.registerModule('movesCounter', new MovesCounter(nextCore));

    nextCore.registerModule('scoreMeter', new ScoreMeter(nextCore));

    // Стартовое качество уже выставил `setRuntimeLevelConfig`; перф-гейту
    // нужен только режим хоста - решать ли самому.
    nextCore.registerModule(
      'perfMonitor',
      new PerfMonitor(nextApp.ticker, useLevelConfigStore.getState().partyOptions.quality)
    );

    useGameStore.getState().initBoosters(getStartBoosters());

    const boostersContainer = nextCore.registerModule(
      'boostersContainer',
      new BoostersContainer(nextCore)
    );

    BOOSTER_BUTTONS.forEach((config) => {
      nextCore.registerModule(
        `${config.kind}Booster`,
        new BoosterButton(nextCore, boostersContainer.getContainer(), config)
      );
    });

    // Доска - последней: она собирает ходы и цели в стор (`IBoardHud.init`)
    // и подписывается на `boosterStart`, который кнопки эмитят только по
    // клику, то есть заведомо позже.
    nextCore.registerModule(
      'gameLogic',
      new GameLogic(nextCore, { sound, hud: createBoardHud({ goals, moves }) })
    );

    if (pendingSize) {
      nextCore.resize(pendingSize.width, pendingSize.height);
    }

    // Флаг загрузки снимается на первом отрисованном кадре: слушатель ниже
    // приоритетом отрисовки приложения (`LOW`) и срабатывает уже после неё.
    // Пауза, пришедшая во время загрузки, ложится после этого кадра - иначе
    // под карточкой хоста остался бы пустой канвас.
    nextApp.ticker.addOnce(
      () => {
        if (isDestroyed) {
          return;
        }

        useGameStore.getState().setIsGameLoaded();

        if (isPaused) {
          applyPause(nextCore);
        }
      },
      undefined,
      UPDATE_PRIORITY.UTILITY
    );
    nextApp.ticker.start();
  };

  const runtime: IGameRuntime = {
    setPaused: (nextPaused) => {
      if (isPaused === nextPaused) {
        return;
      }

      isPaused = nextPaused;

      // До первого кадра пауза только запоминается (см. `addOnce` в `boot`).
      if (core && useGameStore.getState().isGameLoaded) {
        applyPause(core);
      }
    },
    setInputEnabled: (nextEnabled) => {
      isInputEnabled = nextEnabled;
      core?.input.setEnabled(nextEnabled);
    },
    resize: (size) => {
      pendingSize = size;
      core?.resize(size.width, size.height);
    },
    destroy: () => {
      if (isDestroyed) {
        return;
      }

      isDestroyed = true;
      unwatchContext();

      if (core) {
        core.destroy();
      } else if (readyApp) {
        // Init вернулся, сцены нет (отказ `assets`): гасим приложение сами.
        // Init ещё идёт - приложение погасит сам `boot`, увидев `isDestroyed`.
        destroyApplication(readyApp);
      }

      core = null;
      readyApp = null;
      resetRenderCanvasSize();
      resetSceneInsets();

      if (liveRuntime === runtime) {
        liveRuntime = null;
      }
    },
  };

  liveRuntime = runtime;

  // Сбой до готового приложения - init без единого рендерера (ни WebGPU, ни
  // WebGL в браузере): для хоста это тот же исход, что и невосстановленный
  // контекст, графики нет. Сбой после - сорванная сборка сцены (модуль,
  // текстура), а не графика: `board`.
  runGuarded('boot', boot, () => {
    if (!isDestroyed) {
      useGameStore.getState().failRuntime(readyApp ? 'board' : 'context-lost');
    }
  });

  return runtime;
};

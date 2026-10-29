import { useCallback, useEffect, useMemo, useRef, type CSSProperties, type RefObject } from 'react';
import type {
  IGameStartBooster,
  IMinigameLevelConfig,
  TPreLevelBoosterKind,
} from '@/entities/game';
import { setSceneInsets, ZERO_SCENE_INSETS, type ISceneInsets } from '../configs/sceneInsets';
import type { TRenderQualityMode } from '../configs/renderQuality';
import type { TRendererMode } from '../configs/renderer';
import { bootGameRuntime, type IGameRuntime } from '../lib/bootGameRuntime';
import { measureSceneInsets } from '../lib/measureSceneInsets';
import { resolveCanvasCssSize } from '../lib/resolveCanvasCssSize';
import { resolveInsetStyle } from '../lib/resolveInsetStyle';
import { setRuntimeLevelConfig } from '../lib/setRuntimeLevelConfig';
import { useGameStore } from '../store/GameStore';

interface IUseGameRuntimeOptions {
  level: IMinigameLevelConfig;
  boosters: IGameStartBooster[];
  paused: boolean;
  insets?: Partial<ISceneInsets>;
  seed?: number;
  /** Хост слушает `onOutOfMoves`: на исходе ходов партия ждёт его решения. */
  offersContinue?: boolean;
  preBoosters?: readonly TPreLevelBoosterKind[];
  /** Качество отрисовки: перф-гейт сам или зафиксировано (`?perf=`). */
  quality?: TRenderQualityMode;
  /** Какой рендерер просить у Pixi (`?renderer=` у хоста). */
  renderer?: TRendererMode;
  /** Подпись партии под доской вместо «Уровень N». */
  title?: string;
}

interface IGameRuntimeView {
  /** Узел, в который рантайм кладёт канвас. */
  gameContainerRef: RefObject<HTMLDivElement | null>;
  /** Доска: канвас занимает ровно её. */
  boardRef: RefObject<HTMLDivElement | null>;
  /** Зонд безопасной зоны (`lib/measureSceneInsets`). */
  safeAreaRef: RefObject<HTMLDivElement | null>;
  /** Инлайновые переменные отступов для корня экрана. */
  insetStyle: CSSProperties | undefined;
  /** Играть ещё нельзя: ассеты грузятся или потерян графический контекст. */
  isLoading: boolean;
}

/**
 * Жизненный цикл Pixi-рантайма экрана партии: старт на маунте, уничтожение на
 * размонтировании, подгонка канваса под доску и отступы, пауза и ввод.
 *
 * Одна партия - один маунт: уровень и бустеры читаются один раз, на старте
 * рантайма, и смена пропсов посреди партии её не перезапускает (новая партия -
 * новый `key` у экрана). Живой рантайм в приложении обязан быть один
 * (`useGameStore` - синглтон).
 */
export const useGameRuntime = ({
  level,
  boosters,
  paused,
  insets,
  seed,
  offersContinue = false,
  preBoosters = [],
  quality = 'auto',
  renderer = 'auto',
  title,
}: IUseGameRuntimeOptions): IGameRuntimeView => {
  const isGameLoaded = useGameStore((state) => state.isGameLoaded);
  const renderQuality = useGameStore((state) => state.renderQuality);
  const isContextLost = useGameStore((state) => state.isContextLost);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const safeAreaRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<IGameRuntime | null>(null);
  /** Рантайм отпущен cleanup-ом и будет уничтожен, если маунт не вернётся. */
  const isRuntimeReleasedRef = useRef(false);
  const startConfigRef = useRef({
    level,
    boosters,
    seed,
    offersContinue,
    preBoosters,
    quality,
    renderer,
    title,
  });
  const insetTop = insets?.top;
  const insetBottom = insets?.bottom;
  const insetStyle = useMemo(
    () => resolveInsetStyle(insetTop, insetBottom),
    [insetTop, insetBottom]
  );

  /**
   * Загрузка видна всё время, пока играть ещё нельзя: после старта рантайм грузит
   * полсотни текстур, и до `isGameLoaded` доска пустая. Потерянный
   * графический контекст - тот же случай: чёрный канвас с живой партией под ним
   * (если контекст не вернётся, рантайм сообщит `onError('context-lost')`).
   */
  const isLoading = !isGameLoaded || isContextLost;

  /** Отступы сцены по зонду безопасной зоны; до маунта зонда - нули. */
  const readInsets = useCallback((): ISceneInsets => {
    const board = boardRef.current;
    const safeArea = safeAreaRef.current;

    return board && safeArea ? measureSceneInsets(board, safeArea) : ZERO_SCENE_INSETS;
  }, []);

  const resizeCanvas = useCallback(() => {
    const runtime = runtimeRef.current;
    const size = resolveCanvasCssSize(boardRef.current);

    if (!runtime || !size) {
      return;
    }

    // До ресайза: по отступам рантайм раскладывает мир, а модули читают
    // раскладку уже в обработчике `resize`. Ресайз шлёт событие и при прежнем
    // размере, поэтому смена одних только отступов доходит до модулей тем же
    // путём. DPR рантайм берёт сам - перф-гейт мог его опустить.
    setSceneInsets(readInsets());
    runtime.resize(size);
  }, [readInsets]);

  /**
   * Уничтожает живой рантайм и гасит состояние, которое ему принадлежало.
   *
   * Флаг «ассеты загружены» живёт один рантайм и обязан умереть вместе с ним:
   * иначе лоадер следующей партии успевал мигнуть на чужом `isGameLoaded`.
   */
  const releaseRuntime = useCallback(() => {
    runtimeRef.current?.destroy();
    runtimeRef.current = null;

    useGameStore.getState().resetStore();
  }, []);

  // Окна мало: доска меняет размер и без него (хост пересчитал высоту
  // вьюпорта, сменил отступы в CSS), а зонд безопасной зоны - единственный
  // способ узнать про новые отступы. Окно остаётся ради смены DPR (зум
  // браузера), при которой CSS-размер доски тот же.
  useEffect(() => {
    const handleResize = () => {
      resizeCanvas();
    };

    window.addEventListener('resize', handleResize);

    const observer = new ResizeObserver(handleResize);

    if (boardRef.current) {
      observer.observe(boardRef.current);
    }

    if (safeAreaRef.current) {
      observer.observe(safeAreaRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, [resizeCanvas]);

  // Проп `insets` меняет инлайновые переменные: к эффекту стиль уже применён,
  // и зонд меряется по новым значениям. Перф-гейт, понизивший качество
  // (`renderQuality`), меняет DPR отрисовки - канвас пересобирается тем же
  // путём.
  useEffect(() => {
    resizeCanvas();
  }, [insetStyle, renderQuality, resizeCanvas]);

  useEffect(() => {
    const container = gameContainerRef.current;

    if (!container) {
      return;
    }

    // Уничтожение отложено в микротаску (см. cleanup), а вход в эффект её
    // отменяет: в StrictMode mount -> cleanup -> mount идут одним синхронным
    // блоком, и без этого экран поднимал бы вторую игру поверх ещё не умершей
    // первой.
    isRuntimeReleasedRef.current = false;

    if (!runtimeRef.current) {
      // Уровень, бустеры и зерно кладутся в стор до старта рантайма: он
      // читают их при создании.
      setRuntimeLevelConfig(
        startConfigRef.current.level,
        startConfigRef.current.boosters,
        startConfigRef.current.seed,
        {
          offersContinue: startConfigRef.current.offersContinue,
          preBoosters: startConfigRef.current.preBoosters,
          quality: startConfigRef.current.quality,
          renderer: startConfigRef.current.renderer,
          title: startConfigRef.current.title,
        }
      );

      // Размер канваса передаём сразу: `resizeCanvas` ниже доедет только через
      // кадр, а до него Pixi поднял бы контекст и бэкбуфер под дефолтный
      // размер. Ввод выключен с самого создания рантайма, а включит его эффект
      // ниже - единственный владелец ввода на этом экране, - когда партия
      // реально готова принимать тапы.
      const runtime = bootGameRuntime(container, {
        isInputEnabledOnBoot: false,
        insets: readInsets(),
        canvasSize: resolveCanvasCssSize(boardRef.current),
      });

      runtimeRef.current = runtime;
    }

    // Канвас появляется в DOM после асинхронного `Application.init`: ресайз
    // через кадр и ещё раз через 100 мс страхует доску, которая доехала до
    // своего размера уже после старта (рантайм помнит последний размер и
    // применит его к сцене сам, когда она соберётся).
    const resizeFrame = requestAnimationFrame(() => {
      resizeCanvas();
    });
    const resizeRetryTimeout = window.setTimeout(() => {
      resizeCanvas();
    }, 100);

    return () => {
      cancelAnimationFrame(resizeFrame);
      window.clearTimeout(resizeRetryTimeout);

      isRuntimeReleasedRef.current = true;

      queueMicrotask(() => {
        // Маунт вернулся тем же синхронным блоком (StrictMode) - рантайм не
        // отпущен, уничтожать нечего.
        if (!isRuntimeReleasedRef.current) {
          return;
        }

        releaseRuntime();
      });
    };
  }, [readInsets, releaseRuntime, resizeCanvas]);

  // Пауза и ввод. Ввод гасится и на паузе, и пока идёт загрузка: спиннер
  // поверх канваса чисто визуальный, а Pixi слушает перемещение указателя и на
  // `document`, так что DOM-оверлей реальный тап до сцены не остановит. Пауза
  // до готовности сцены рантаймом запоминается и ложится после первого кадра.
  useEffect(() => {
    const runtime = runtimeRef.current;

    if (!runtime) {
      return;
    }

    runtime.setPaused(paused);
    runtime.setInputEnabled(!paused && !isLoading);
  }, [isLoading, paused]);

  return { gameContainerRef, boardRef, safeAreaRef, insetStyle, isLoading };
};
